/*
  תקציב שנתי לחתימה לבית ספר אחד — ממערכת התקציב (מבט-רשת), בשלושה חלקים:
    א. עלות הוראה  — תקן השעות, ייעוץ ושכר המנהלת, בניכוי ייעול השעות שנבחר
    ב. צהרון       — להשלמה ביד (אין נתוני צהרון במערכת התקציב)
    ג. כל השאר     — הוצאות שוטפות, מבנה ופעילות, סעיף-סעיף

  אחיו של scripts/make-signed-budget.mjs במערכת השכר, שמשרת את שמונת בתי הספר
  שיש להם נתוני העסקה אמיתיים. כאן המקור הוא מודל התקציב עצמו, ולכן הסקריפט
  משרת כל אחד מבתי הספר שבמערכת התקציב — כולל אלה שאינם במערכת השכר
  (קרית ביאליק, הרצליה, חיפה, באר שבע, רעננה-בנות).

  הרצה: node scripts/make-signed-budget.mjs "קרית ביאליק"
  פלט:  Desktop\תקציב לחתימה - <בית ספר>.pdf (+ html)
*/
import fs from 'fs';
import path from 'path';
import os from 'os';

const MATCH = process.argv[2] || 'קרית ביאליק';
const HUB = 'https://ogkwvrerolofujhydhsl.supabase.co/functions/v1/network-budget';
const CODE = process.env.HUB_ACCESS_CODE || 'reshet2026';
const OUT_DIR = path.join(os.homedir(), 'OneDrive', 'Desktop');
// עץ playwright מותקן במחשב הזה — הגרסה חייבת להתאים לדפדפנים שב-ms-playwright
const PW = process.env.PLAYWRIGHT_ENTRY || 'C:/tmp/work/mitzpe-reshet/node_modules/playwright/index.mjs';

const norm = n => String(n || '').replace(/["'\u05f4\u05f3־-]/g, '').replace(/\s+/g, ' ').replace(/תקווה/g, 'תקוה').trim();

// ── שליפה ממבט-רשת ──
const hubRes = await fetch(HUB, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: CODE }),
});
const payload = await hubRes.json();
if (!payload.schools) throw new Error(payload.error || 'מבט-רשת לא החזיר נתונים');
const hub = payload.schools.find(s => norm(s.name).includes(norm(MATCH)));
if (!hub) throw new Error(`לא נמצא בית ספר: ${MATCH}\nקיימים: ${payload.schools.map(s => s.name).join(' · ')}`);
if (!hub.classCount) throw new Error(`${hub.name} — אין כיתות במערכת התקציב, אין ממה להפיק תקציב`);

const raw = hub.raw;
const k = raw.constants;
const nis = v => Number(v || 0).toLocaleString('he-IL');

// ── חלק א: עלות הוראה ──
const principalAnnual = (Number(hub.principalMonthly) || 0) * 12;
const fullClasses = hub.classes.filter(c => c.type === 'full').length;
const halfClasses = hub.classes.length - fullClasses;

const A = { income: [], expenses: [] };
A.income.push({
  name: 'תקן שעות משרד החינוך',
  amount: hub.income.ministry,
  basis: [
    fullClasses ? `${fullClasses === 1 ? 'כיתה מלאה אחת' : `${fullClasses} כיתות מלאות`} × ${k.full_class_ministry_hours} ש׳` : null,
    halfClasses ? `${halfClasses === 1 ? 'כיתה אחת בחצי תקן' : `${halfClasses} כיתות בחצי תקן`} × ${k.half_class_ministry_hours} ש׳` : null,
  ].filter(Boolean).join(' · ') + ` × ${nis(k.ministry_hourly_rate)} ₪ × 12 חודשים`,
});
if (hub.income.grant) A.income.push({
  name: 'תוספת כללית של משרד החינוך',
  amount: hub.income.grant,
  basis: `${nis(k.ministry_grant_per_student)} ₪ × ${hub.students} תלמידים`,
});

A.expenses.push({
  name: 'עלות הוראה — תקן השעות בפועל',
  amount: hub.expenses.teaching,
  basis: `${hub.classCount} כיתות × ${k.actual_weekly_hours} ש׳ × ${nis(k.actual_hourly_rate)} ₪ × 12 חודשים${k.ofek_salary ? ' (תעריף אופק חדש)' : ''}`,
});
if (hub.expenses.counselingCost) A.expenses.push({
  name: 'מרכיב ייעוץ',
  amount: hub.expenses.counselingCost,
  basis: `${k.counseling_hours_per_class} ש׳ לכיתה × ${hub.classCount} כיתות × ${nis(k.actual_hourly_rate)} ₪ × 12 חודשים`,
});
if (principalAnnual) A.expenses.push({
  name: 'שכר מנהלת',
  amount: principalAnnual,
  basis: `${nis(hub.principalMonthly)} ₪ × 12 חודשים`,
});

// ייעול השעות שנבחר — הפחתה ישירה מעלות ההוראה (המודל כאן הוא תקן, לא שכר בפועל)
const HOURS_YIEUL = /^(הורדת \d+ שעות הוראה|קבלת שבת|שעות פרטניות|שעות הוראה של המנהלת|צירוף כיתות|חיבור כיתות|סגירת כיתה)/;
const yieulRows = hub.efficiency?.saved === true ? (hub.efficiency.rows || []) : [];
const hoursYieul = yieulRows.filter(r => HOURS_YIEUL.test(r.label));
const moneyYieul = yieulRows.filter(r => !HOURS_YIEUL.test(r.label));

const sum = a => a.reduce((s, x) => s + Number(x.amount || 0), 0);
A.inc = sum(A.income);
A.gross = sum(A.expenses);
A.cuts = hoursYieul.reduce((s, r) => s + Number(r.saving || 0), 0);
A.exp = A.gross - A.cuts;

// ── חלק ג: כל השאר ──
const catById = new Map(raw.categories.map(c => [c.id, c]));
const annualOf = e => Number(e.amount || 0) * (e.period === 'monthly' ? 12 : 1);
const GROUPS = { salary: 'שכר ושירותים', building: 'מבנה ואחזקה', events: 'פעילויות ואירועים', equipment: 'ציוד ותשתיות', profdev: 'פיתוח מקצועי', other: 'ביטוח ואחר' };
const groups = new Map();
const addLine = (group, name, amount, basis) => {
  if (!amount) return;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ name: String(name).trim(), amount: Math.round(amount), basis });
};
for (const e of raw.expenses) {
  if (/שכר מנהלת/.test(e.name)) continue; // כבר בחלק א
  const kind = catById.get(e.category_id)?.kind || 'other';
  addLine(GROUPS[kind] || GROUPS.other, e.name, annualOf(e),
    e.period === 'monthly' ? `${nis(Math.round(e.amount))} ₪ × 12 חודשים` : 'סכום שנתי');
}
addLine('תלמידים ופעילות', 'הוצאות פר תלמיד', hub.expenses.studentExp,
  `${nis(k.expense_per_student)} ₪ × ${hub.students} תלמידים · כולל אירועים, ערבי הורים, פיתוח מקצועי ושכפולים`);
addLine('תלמידים ופעילות', 'חוגים', hub.expenses.clubsExpense,
  `${nis(k.clubs_monthly_expense_per_class)} ₪ לכיתה לחודש × ${hub.classCount} כיתות × 10 חודשי פעילות`);
if (hub.expenses.profDev) addLine('תלמידים ופעילות', 'פיתוח מקצועי', hub.expenses.profDev);

const C = { income: [], groups: [...groups.entries()] };
for (const x of raw.income || []) C.income.push({ name: x.name, amount: Math.round(annualOf(x)) });
if (hub.income.perStudent + hub.income.talan > 0) C.income.push({
  name: 'שכר לימוד ותל״ן',
  amount: Math.round(hub.income.perStudent + hub.income.talan),
  basis: `(${nis(k.income_per_student)} + ${nis(k.income_per_student_talan)}) ₪ × ${hub.students} תלמידים × 80% גבייה`,
});
for (const r of moneyYieul) C.income.push({ name: r.label, amount: Math.round(r.saving) });
C.inc = sum(C.income);
C.exp = C.groups.reduce((s, [, l]) => s + sum(l), 0);

// ── בדיקות שלמות מול מבט-רשת ──
const moneyYieulTotal = moneyYieul.reduce((s, r) => s + Number(r.saving || 0), 0);
const checks = [
  ['הכנסות', A.inc + C.inc - moneyYieulTotal, hub.income.total],
  ['הוצאות (לפני ייעול)', A.gross + C.exp, hub.expenses.total],
  ['מאזן (אחרי ייעול)', A.inc + C.inc - A.exp - C.exp,
    hub.efficiency?.saved ? hub.efficiency.projectedBalance : hub.balance],
];
for (const [label, mine, theirs] of checks) {
  if (Math.abs(Math.round(mine) - Math.round(theirs)) > 2) {
    throw new Error(`אי-התאמה ב${label}: ${Math.round(mine)} מול ${Math.round(theirs)} במבט-רשת`);
  }
}

// ── HTML ──
const ils = v => (v == null ? '' : `${Math.round(v).toLocaleString('he-IL')} ₪`);
const signed = v => `<span class="${v < 0 ? 'neg' : 'pos'}">${ils(v)}</span>`;
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'logo.png')).toString('base64');
const lineRows = lines => lines.map(l => `<tr><td>${l.name}${l.basis ? `<div class="basis">${l.basis}</div>` : ''}</td><td class="n">${ils(l.amount)}</td></tr>`).join('');
const cutRows = rows => rows.map(r => `<tr><td>בניכוי: ${r.label}</td><td class="n neg">−${ils(r.saving)}</td></tr>`).join('');
const today = new Date().toLocaleDateString('he-IL');
const DISCLAIMER = 'התקציב מתייחס לבית חינוך מוכש״ר. אינו כולל שכר צהרון, מזכירות, אב בית וניקיון שאינם מפורטים בו, ואינו כולל אחזקה, שיפוצים, ריהוט וציוד קבוע שאינם מפורטים בו.';

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>תקציב לחתימה — ${hub.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 13mm 14mm 13mm; }
* { box-sizing: border-box; }
body { font-family: Heebo, Arial, sans-serif; color: #1D3461; font-size: 10.5pt; margin: 0; }
/* fixed ולא absolute — כך ב״ה חוזר בראש כל עמוד מודפס, לא רק בעמוד הראשון */
.bh { position: fixed; top: 0; right: 0; font-size: 10pt; font-weight: 700; }
header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #4B2E83; padding: 14px 0 10px; }
header img { height: 58px; }
h1 { font-size: 19pt; font-weight: 900; margin: 0; }
.sub { color: #5A5478; font-size: 10pt; margin-top: 2px; }
h2 { font-size: 13pt; font-weight: 900; color: #4B2E83; margin: 18px 0 6px; display: flex; align-items: baseline; gap: 8px; }
h2 .src { font-size: 8.5pt; font-weight: 500; color: #6E6893; }
h3 { font-size: 10pt; font-weight: 700; color: #5A5478; margin: 8px 0 2px; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: 3.5px 6px; text-align: right; vertical-align: top; }
td.n, th.n { text-align: left; white-space: nowrap; font-variant-numeric: tabular-nums; direction: ltr; }
.lines tr td { border-bottom: 1px dashed #E0DCF0; }
.basis { font-size: 8pt; color: #6E6893; }
tr.total td { font-weight: 900; border-top: 1.5px solid #1D3461; border-bottom: none; }
tr.diff td { font-weight: 900; background: #F5F3FC; font-size: 11pt; }
.neg { color: #B42318; } .pos { color: #067647; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.summary { margin-top: 12px; border: 1.5px solid #4B2E83; border-radius: 8px; overflow: hidden; }
.summary th { background: #4B2E83; color: #fff; font-weight: 700; }
.summary td { border-bottom: 1px solid #E0DCF0; }
.summary tr.grand td { background: #EDE9FB; font-weight: 900; font-size: 11.5pt; border: none; }
.fill { display: inline-block; min-width: 110px; border-bottom: 1px solid #1D3461; height: 1em; }
.note { font-size: 8.5pt; color: #5A5478; margin-top: 4px; line-height: 1.5; }
section { break-inside: avoid; }
.sign { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; break-inside: avoid; }
.sign div { border-top: 1px solid #1D3461; padding-top: 4px; font-size: 9.5pt; }
.sign b { display: block; margin-bottom: 30px; font-size: 10.5pt; }
footer { margin-top: 14px; font-size: 8pt; color: #6E6893; border-top: 1px solid #E0DCF0; padding-top: 5px; }
</style></head><body>
<div class="bh">ב״ה</div>
<header>
  <img src="${logo}" alt="">
  <div>
    <h1>תקציב שנתי לחתימה — ${hub.name}</h1>
    <div class="sub">${hub.yearLabel} · ${hub.students} תלמידים · ${hub.classCount} כיתות · נכון ל-${today}</div>
  </div>
</header>

<table class="summary">
  <tr><th>חלק</th><th class="n">הכנסות</th><th class="n">הוצאות</th><th class="n">הפרש</th></tr>
  <tr><td>א. עלות הוראה${A.cuts ? ' <span class="basis">(אחרי ייעול השעות שנבחר)</span>' : ''}</td><td class="n">${ils(A.inc)}</td><td class="n">${ils(A.exp)}</td><td class="n">${signed(A.inc - A.exp)}</td></tr>
  <tr><td>ב. צהרון</td><td class="n"><span class="fill"></span></td><td class="n"><span class="fill"></span></td><td class="n"><span class="fill"></span></td></tr>
  <tr><td>ג. הוצאות שוטפות, מבנה ופעילות</td><td class="n">${ils(C.inc)}</td><td class="n">${ils(C.exp)}</td><td class="n">${signed(C.inc - C.exp)}</td></tr>
  <tr class="grand"><td>סה״כ בית הספר <span class="basis">(לפני הצהרון)</span></td><td class="n">${ils(A.inc + C.inc)}</td><td class="n">${ils(A.exp + C.exp)}</td><td class="n">${signed(A.inc + C.inc - A.exp - C.exp)}</td></tr>
</table>

<section>
<h2>א. עלות הוראה <span class="src">ממערכת התקציב · תקן שעות, ייעוץ ושכר מנהלת · שנתי</span></h2>
<div class="two">
  <div><h3>הכנסות</h3><table class="lines">${lineRows(A.income)}<tr class="total"><td>סה״כ הכנסות</td><td class="n">${ils(A.inc)}</td></tr></table></div>
  <div><h3>הוצאות</h3><table class="lines">${lineRows(A.expenses)}${A.cuts ? cutRows(hoursYieul) : ''}<tr class="total"><td>סה״כ הוצאות</td><td class="n">${ils(A.exp)}</td></tr></table></div>
</div>
<table><tr class="diff"><td>הפרש עלות הוראה</td><td class="n">${signed(A.inc - A.exp)}</td></tr></table>
${A.cuts ? `<div class="note">עלות ההוראה לפני ייעול: ${ils(A.gross)}. ${hoursYieul.length} מרכיבי ייעול השעות שנבחרו במערכת התקציב מקטינים אותה ב-${ils(A.cuts)}.</div>` : ''}
<div class="note">עלות ההוראה כאן היא תחשיב תקן של מערכת התקציב, ולא שכר בפועל ממערכת השכר — ${hub.name} אינו מבתי הספר שנתוני ההעסקה שלהם מנוהלים במערכת השכר. לפיכך היא אינה כוללת כרית ביטחון 10% ומילוי מקום 5%, שבבתי הספר שבמערכת השכר מחושבים מעל השכר בפועל.</div>
</section>

<section>
<h2>ב. צהרון <span class="src">להשלמה ביד · מחוץ לתקן ההוראה</span></h2>
<div class="two">
  <div><h3>הכנסות</h3><table class="lines">
    <tr><td>תשלומי הורים לצהרון</td><td class="n"><span class="fill"></span></td></tr>
    <tr><td>הכנסות נוספות לצהרון</td><td class="n"><span class="fill"></span></td></tr>
    <tr class="total"><td>סה״כ הכנסות</td><td class="n"><span class="fill"></span></td></tr></table></div>
  <div><h3>הוצאות</h3><table class="lines">
    <tr><td>שכר עובדות הצהרון</td><td class="n"><span class="fill"></span></td></tr>
    <tr><td>עלויות מעביד והפרשות סוציאליות</td><td class="n"><span class="fill"></span></td></tr>
    <tr><td>הוצאות תפעול הצהרון</td><td class="n"><span class="fill"></span></td></tr>
    <tr class="total"><td>סה״כ הוצאות</td><td class="n"><span class="fill"></span></td></tr></table></div>
</div>
<table><tr class="diff"><td>הפרש צהרון</td><td class="n"><span class="fill"></span></td></tr></table>
<div class="note">אין נתוני צהרון במערכת התקציב של בית הספר ואין לו נתוני העסקה במערכת השכר — החלק הזה מושלם ביד בפגישת האישור.</div>
</section>

<section>
<h2>ג. הוצאות שוטפות, מבנה ופעילות <span class="src">ממערכת התקציב · שנתי</span></h2>
<div class="two">
  <div><h3>הכנסות</h3><table class="lines">${C.income.length ? lineRows(C.income) : '<tr><td>אין הכנסות נוספות</td><td></td></tr>'}<tr class="total"><td>סה״כ הכנסות</td><td class="n">${ils(C.inc)}</td></tr></table></div>
  <div>${C.groups.map(([g, l]) => `<h3>${g}</h3><table class="lines">${lineRows(l)}</table>`).join('')}
    <table><tr class="total"><td>סה״כ הוצאות</td><td class="n">${ils(C.exp)}</td></tr></table>
    ${principalAnnual ? `<div class="note">שכר המנהלת (${ils(principalAnnual)} בשנה) נכלל בעלות ההוראה בחלק א ולכן אינו מופיע כאן.</div>` : ''}</div>
</div>
<table><tr class="diff"><td>הפרש הוצאות שוטפות</td><td class="n">${signed(C.inc - C.exp)}</td></tr></table>
</section>

<div class="note" style="margin-top:14px">${DISCLAIMER}</div>

<div class="sign">
  <div><b>מנהלת בית הספר</b>שם: ____________________ &nbsp; תאריך: __________<br><br>חתימה: ____________________</div>
  <div><b>השליח</b>שם: ____________________ &nbsp; תאריך: __________<br><br>חתימה: ____________________</div>
</div>
<footer>הופק ממערכת התקציב של רשת חינוך חב״ד · ${today} · סכומים שנתיים בשקלים</footer>
</body></html>`;

const base = path.join(OUT_DIR, `תקציב לחתימה - ${hub.name}`);
fs.writeFileSync(base + '.html', html);
const { chromium } = await import(`file:///${PW}`);
// Chrome המותקן במחשב, כדי לא להיות תלויים בהתאמה בין גרסת playwright לדפדפנים שהורדו
const browser = await chromium.launch({ channel: 'chrome' })
  .catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({ path: base + '.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(JSON.stringify({
  school: hub.name,
  A: { income: A.inc, grossExpenses: A.gross, cuts: A.cuts, expenses: A.exp },
  C: { income: C.inc, expenses: C.exp },
  balance: A.inc + C.inc - A.exp - C.exp,
  pdf: base + '.pdf',
}, null, 1));
