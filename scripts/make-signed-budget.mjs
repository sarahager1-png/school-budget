/*
  תקציב שנתי לחתימה לבית ספר אחד — ממערכת התקציב (מבט-רשת), בשלושה חלקים:
    א. עלות הוראה  — תקן השעות, ייעוץ ושכר המנהלת, בניכוי ייעול השעות שנבחר
    ב. צהרון       — להשלמה ביד (אין נתוני צהרון במערכת התקציב)
    ג. כל השאר     — הוצאות שוטפות, מבנה ופעילות, סעיף-סעיף

  אחיו של scripts/make-signed-budget.mjs במערכת השכר, שמשרת את שמונת בתי הספר
  שיש להם נתוני העסקה אמיתיים. כאן המקור הוא מודל התקציב עצמו, ולכן הסקריפט
  משרת כל אחד מבתי הספר שבמערכת התקציב — כולל אלה שאינם במערכת השכר
  (קרית ביאליק, הרצליה, חיפה, באר שבע, רעננה-בנות).

  ה-HTML שנוצר הוא מסמך עריכה: "תן לי אפשרות לשינוי" (שרה, 18.9). כל סכום וכל שם
  סעיף ניתנים לשינוי, הסכומים וההפרשים מתחשבים מחדש לבד, ואפשר להוסיף ולמחוק שורות.
  השינויים נשמרים בדפדפן של מי שעורך, וה-PDF מופק מאותו קובץ בלי סרגל העריכה.

  הרצה: node scripts/make-signed-budget.mjs "קרית ביאליק"
  פלט:  Desktop\תקציב לחתימה - <בית ספר>.pdf  +  .html לעריכה
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
for (const r of hoursYieul) {
  A.expenses.push({ name: `בניכוי: ${r.label}`, amount: -Math.round(r.saving), cut: true });
}

const sum = a => a.reduce((s, x) => s + Number(x.amount || 0), 0);
A.inc = sum(A.income);
A.cuts = hoursYieul.reduce((s, r) => s + Number(r.saving || 0), 0);
A.exp = sum(A.expenses);
A.gross = A.exp + A.cuts;

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
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ils = v => (v == null || v === '' ? '' : `${Math.round(v).toLocaleString('he-IL')} ₪`);
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'logo.png')).toString('base64');
const today = new Date().toLocaleDateString('he-IL');
const DISCLAIMER = 'התקציב מתייחס לבית חינוך מוכש״ר. אינו כולל שכר צהרון, מזכירות, אב בית וניקיון שאינם מפורטים בו, ואינו כולל אחזקה, שיפוצים, ריהוט וציוד קבוע שאינם מפורטים בו.';

// כל סכום הוא תא-עריכה: data-v0 הוא נתון המערכת, שאליו מחזיר כפתור האיפוס
let seq = 0;
const amt = (v, extra = '') => {
  const id = `a${++seq}`;
  const val = v == null || v === '' ? '' : Math.round(v);
  return `<span class="amt${val !== '' && val < 0 ? ' neg' : ''}${val === '' ? ' empty' : ''} ${extra}" data-id="${id}" data-v="${val}" data-v0="${val}">${val === '' ? '' : ils(val)}</span>`;
};
const nm = t => {
  const id = `n${++seq}`;
  return `<span class="nm" data-id="${id}" data-t0="${esc(t)}">${esc(t)}</span>`;
};
const lineRows = lines => lines.map(l => `<tr>
  <td>${nm(l.name)}${l.basis ? `<div class="basis">${esc(l.basis)}</div>` : ''}</td>
  <td class="n">${amt(l.amount)}</td><td class="rmcell"></td></tr>`).join('');
const blankRows = names => names.map(n => `<tr>
  <td>${nm(n)}</td><td class="n">${amt(null)}</td><td class="rmcell"></td></tr>`).join('');
const totalRow = (label) => `<tr class="total"><td>${esc(label)}</td><td class="n"><span class="amt tot"></span></td><td class="rmcell"></td></tr>`;
const diffRow = label => `<table class="difftbl"><tr class="diff"><td>${esc(label)}</td><td class="n"><span class="amt dif"></span></td></tr></table>`;

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>תקציב לחתימה — ${esc(hub.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 13mm 14mm 13mm; }
* { box-sizing: border-box; }
body { font-family: Heebo, Arial, sans-serif; color: #1D3461; font-size: 10.5pt; margin: 0; background: #F6F5FB; }
.doc { position: relative; background: #fff; max-width: 190mm; margin: 0 auto; padding: 0 2mm; }
.bh { position: absolute; top: 0; right: 2mm; font-size: 10pt; font-weight: 700; }
header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #4B2E83; padding: 14px 0 10px; }
header img { height: 58px; }
h1 { font-size: 19pt; font-weight: 900; margin: 0; }
.sub { color: #5A5478; font-size: 10pt; margin-top: 2px; }
h2 { font-size: 13pt; font-weight: 900; color: #4B2E83; margin: 18px 0 6px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
h2 .src { font-size: 8.5pt; font-weight: 500; color: #6E6893; }
h3 { font-size: 10pt; font-weight: 700; color: #5A5478; margin: 8px 0 2px; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: 3.5px 6px; text-align: right; vertical-align: top; }
td.n, th.n { text-align: left; white-space: nowrap; font-variant-numeric: tabular-nums; direction: ltr; }
td.rmcell { width: 0; padding: 0; }
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
.amt.empty { display: inline-block; min-width: 110px; border-bottom: 1px solid #1D3461; height: 1em; }
.note { font-size: 8.5pt; color: #5A5478; margin-top: 4px; line-height: 1.5; }
section { break-inside: avoid; }
.sign { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; break-inside: avoid; }
.sign div { border-top: 1px solid #1D3461; padding-top: 4px; font-size: 9.5pt; }
.sign b { display: block; margin-bottom: 30px; font-size: 10.5pt; }
footer { margin-top: 14px; font-size: 8pt; color: #6E6893; border-top: 1px solid #E0DCF0; padding-top: 5px; }

/* ── סרגל העריכה — על המסך בלבד ── */
.bar { position: sticky; top: 0; z-index: 9; background: #4B2E83; color: #fff; padding: 9px 14px;
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap; font-size: 10pt; }
.bar b { font-weight: 700; margin-inline-end: 6px; }
.bar button { font-family: inherit; font-size: 10pt; font-weight: 700; border: 0; border-radius: 7px;
  padding: 7px 13px; cursor: pointer; background: #fff; color: #4B2E83; }
.bar button.on { background: #CBFF4D; color: #24203A; }
.bar button.ghost { background: rgba(255,255,255,.16); color: #fff; }
.bar .msg { font-weight: 500; opacity: .85; margin-inline-start: auto; }
.hint { display: none; background: #FFF9DB; border: 1px solid #F2E3A0; border-radius: 8px;
  padding: 9px 12px; margin: 10px 0 0; font-size: 10pt; line-height: 1.6; }
body.editing .hint { display: block; }
body.editing .amt, body.editing .nm { background: #F3F0FF; border-radius: 5px; padding: 0 4px;
  outline: 1px dashed #B9AEE8; cursor: text; min-width: 34px; display: inline-block; }
body.editing .amt.empty { background: #F3F0FF; }
body.editing .amt:focus, body.editing .nm:focus { outline: 2px solid #4B2E83; background: #fff; }
body.editing .amt.tot, body.editing .amt.dif { background: transparent; outline: 0; cursor: default; }
.rm { display: none; }
body.editing .rm { display: inline-block; border: 0; background: #FEE4E2; color: #B42318;
  border-radius: 50%; width: 20px; height: 20px; line-height: 1; cursor: pointer; font-size: 11px; font-weight: 700; }
.addrow { display: none; }
body.editing .addrow { display: inline-block; margin-top: 5px; border: 1px dashed #B9AEE8;
  background: #fff; color: #4B2E83; border-radius: 7px; padding: 3px 10px; font-size: 9pt;
  font-weight: 700; cursor: pointer; font-family: inherit; }
@media print {
  body { background: #fff; }
  .doc { max-width: none; margin: 0; padding: 0; }
  .bar, .hint, .rm, .addrow { display: none !important; }
  .bh { position: fixed; }
  td.rmcell { display: none; }
}
@media (max-width: 720px) {
  .two { grid-template-columns: 1fr; }
  .sign { grid-template-columns: 1fr; }
  h1 { font-size: 15pt; }
  header { gap: 9px; }
  header img { height: 34px; }
  header > div { min-width: 0; }
  /* בטבלת הסיכום עמודת השם נמחקת מול שלוש עמודות מספרים — מצמצמים כדי שלא תיחתך למילה
     בשורה, ומוותרים על הפירוט בסוגריים (הוא חוזר בהערה של חלק א) */
  .summary { font-size: 8pt; }
  .summary td, .summary th { padding: 3px 3px; }
  .summary .basis { display: none; }
  .summary tr.grand td { font-size: 9pt; }
  /* פס המילוי הריק (שורת הצהרון) מרחיב את עמודת ההפרש ואיתה את כל העמוד */
  .amt.empty { min-width: 74px; }
  .summary .amt.empty { min-width: 50px; }
  /* פריט גריד מקבל min-width:auto, ולכן טבלה עם מספר ב-nowrap מרחיבה את העמודה
     ואת כל העמוד. min-width:0 מחזיר את הגלישה לתוך התא */
  .two > div { min-width: 0; }
  .lines td:first-child { overflow-wrap: anywhere; }
  .bar { padding: 7px 10px; gap: 6px; }
  .bar button { padding: 6px 10px; font-size: 9.5pt; }
  .bar .msg { margin-inline-start: 0; }
}
</style></head><body>

<div class="bar">
  <b>תקציב לחתימה</b>
  <button id="edit">✎ לשנות נתונים</button>
  <button id="print" class="ghost">🖨 הדפסה / שמירה כ-PDF</button>
  <button id="save" class="ghost">⬇ שמירת עותק</button>
  <button id="reset" class="ghost">↺ חזרה לנתוני המערכת</button>
  <span class="msg" id="msg"></span>
</div>

<div class="doc">
<div class="bh">ב״ה</div>
<header>
  <img src="${logo}" alt="">
  <div>
    <h1>תקציב שנתי לחתימה — ${esc(hub.name)}</h1>
    <div class="sub">${esc(hub.yearLabel)} · ${hub.students} תלמידים · ${hub.classCount} כיתות · נכון ל-${today}</div>
  </div>
</header>

<div class="hint">
  <b>מצב שינוי פעיל.</b> אפשר ללחוץ על כל סכום ועל כל שם סעיף ולכתוב אחרת. הסכומים,
  ההפרשים וטבלת הסיכום למעלה מתעדכנים לבד. ✕ מוחק שורה, ו"הוספת שורה" מוסיפה סעיף חדש.
  כשמסיימים — "הדפסה / שמירה כ-PDF". השינויים נשמרים במחשב הזה בלבד ואינם נכנסים למערכת התקציב.
</div>

<table class="summary">
  <tr><th>חלק</th><th class="n">הכנסות</th><th class="n">הוצאות</th><th class="n">הפרש</th></tr>
  <tr><td>א. עלות הוראה${A.cuts ? ' <span class="basis">(אחרי ייעול השעות שנבחר)</span>' : ''}</td>
      <td class="n"><span class="amt tot" data-of="A" data-side="inc"></span></td>
      <td class="n"><span class="amt tot" data-of="A" data-side="exp"></span></td>
      <td class="n"><span class="amt dif" data-of="A"></span></td></tr>
  <tr><td>ב. צהרון</td>
      <td class="n"><span class="amt tot" data-of="B" data-side="inc"></span></td>
      <td class="n"><span class="amt tot" data-of="B" data-side="exp"></span></td>
      <td class="n"><span class="amt dif" data-of="B"></span></td></tr>
  <tr><td>ג. הוצאות שוטפות, מבנה ופעילות</td>
      <td class="n"><span class="amt tot" data-of="C" data-side="inc"></span></td>
      <td class="n"><span class="amt tot" data-of="C" data-side="exp"></span></td>
      <td class="n"><span class="amt dif" data-of="C"></span></td></tr>
  <tr class="grand"><td>סה״כ בית הספר</td>
      <td class="n"><span class="amt tot" data-of="ALL" data-side="inc"></span></td>
      <td class="n"><span class="amt tot" data-of="ALL" data-side="exp"></span></td>
      <td class="n"><span class="amt dif" data-of="ALL"></span></td></tr>
</table>

<section data-part="A">
<h2>א. עלות הוראה <span class="src">ממערכת התקציב · תקן שעות, ייעוץ ושכר מנהלת · שנתי</span></h2>
<div class="two">
  <div><h3>הכנסות</h3><table class="lines" data-side="inc">${lineRows(A.income)}${totalRow('סה״כ הכנסות')}</table>
    <button class="addrow">＋ הוספת שורת הכנסה</button></div>
  <div><h3>הוצאות</h3><table class="lines" data-side="exp">${lineRows(A.expenses)}${totalRow('סה״כ הוצאות')}</table>
    <button class="addrow">＋ הוספת שורת הוצאה</button></div>
</div>
${diffRow('הפרש עלות הוראה')}
${A.cuts ? `<div class="note">עלות ההוראה לפני ייעול: ${ils(A.gross)}. ${hoursYieul.length} מרכיבי ייעול השעות שנבחרו במערכת התקציב מקטינים אותה ב-${ils(A.cuts)}.</div>` : ''}
<div class="note">עלות ההוראה כאן היא תחשיב תקן של מערכת התקציב, ולא שכר בפועל ממערכת השכר — ${esc(hub.name)} אינו מבתי הספר שנתוני ההעסקה שלהם מנוהלים במערכת השכר. לפיכך היא אינה כוללת כרית ביטחון 10% ומילוי מקום 5%, שבבתי הספר שבמערכת השכר מחושבים מעל השכר בפועל.</div>
</section>

<section data-part="B">
<h2>ב. צהרון <span class="src">להשלמה ביד · מחוץ לתקן ההוראה</span></h2>
<div class="two">
  <div><h3>הכנסות</h3><table class="lines" data-side="inc">${blankRows(['תשלומי הורים לצהרון', 'הכנסות נוספות לצהרון'])}${totalRow('סה״כ הכנסות')}</table>
    <button class="addrow">＋ הוספת שורת הכנסה</button></div>
  <div><h3>הוצאות</h3><table class="lines" data-side="exp">${blankRows(['שכר עובדות הצהרון', 'עלויות מעביד והפרשות סוציאליות', 'הוצאות תפעול הצהרון'])}${totalRow('סה״כ הוצאות')}</table>
    <button class="addrow">＋ הוספת שורת הוצאה</button></div>
</div>
${diffRow('הפרש צהרון')}
<div class="note">אין נתוני צהרון במערכת התקציב של בית הספר ואין לו נתוני העסקה במערכת השכר — החלק הזה מושלם ביד.</div>
</section>

<section data-part="C">
<h2>ג. הוצאות שוטפות, מבנה ופעילות <span class="src">ממערכת התקציב · שנתי</span></h2>
<div class="two">
  <div><h3>הכנסות</h3><table class="lines" data-side="inc">${lineRows(C.income)}${totalRow('סה״כ הכנסות')}</table>
    <button class="addrow">＋ הוספת שורת הכנסה</button></div>
  <div>${C.groups.map(([g, l]) => `<h3>${esc(g)}</h3><table class="lines" data-side="exp">${lineRows(l)}</table>
    <button class="addrow">＋ הוספת שורה ל${esc(g)}</button>`).join('')}
    <table data-side="exp"><tr class="total"><td>סה״כ הוצאות</td><td class="n"><span class="amt tot"></span></td><td class="rmcell"></td></tr></table>
    ${principalAnnual ? `<div class="note">שכר המנהלת (${ils(principalAnnual)} בשנה) נכלל בעלות ההוראה בחלק א ולכן אינו מופיע כאן.</div>` : ''}</div>
</div>
${diffRow('הפרש הוצאות שוטפות')}
</section>

<div class="note" style="margin-top:14px">${DISCLAIMER}</div>

<div class="sign">
  <div><b>מנהלת בית הספר</b>שם: ____________________ &nbsp; תאריך: __________<br><br>חתימה: ____________________</div>
  <div><b>השליח</b>שם: ____________________ &nbsp; תאריך: __________<br><br>חתימה: ____________________</div>
</div>
<footer>הופק ממערכת התקציב של רשת חינוך חב״ד · ${today} · סכומים שנתיים בשקלים</footer>
</div>

<script>
(function () {
  var KEY = 'signed-budget:' + ${JSON.stringify(hub.name)};
  var body = document.body, msg = document.getElementById('msg');

  function parse(t) {
    var s = String(t).replace(/[^0-9.\\-]/g, '');
    if (s === '' || s === '-') return null;
    var n = Number(s);
    return isFinite(n) ? Math.round(n) : null;
  }
  function fmt(v) { return v == null ? '' : v.toLocaleString('he-IL') + ' \\u20aa'; }
  function show(el, v) {
    el.dataset.v = v == null ? '' : v;
    el.textContent = fmt(v);
    el.classList.toggle('empty', v == null);
    el.classList.toggle('neg', v != null && v < 0);
    el.classList.toggle('pos', false);
  }
  function val(el) { return el.dataset.v === '' ? null : Number(el.dataset.v); }

  // סכום צד (inc/exp) בחלק אחד: כל השורות שאינן שורת סה״כ
  function sideSum(part, side) {
    var tables = part.querySelectorAll('table[data-side="' + side + '"]');
    var any = false, total = 0;
    tables.forEach(function (t) {
      t.querySelectorAll('tr:not(.total) .amt').forEach(function (a) {
        var v = val(a);
        if (v != null) { any = true; total += v; }
      });
    });
    return any ? total : null;
  }

  function recalc() {
    var all = { inc: null, exp: null };
    document.querySelectorAll('section[data-part]').forEach(function (part) {
      var key = part.dataset.part, s = {};
      ['inc', 'exp'].forEach(function (side) {
        var t = sideSum(part, side);
        s[side] = t;
        part.querySelectorAll('table[data-side="' + side + '"] tr.total .amt.tot')
          .forEach(function (c) { show(c, t); });
        var head = document.querySelector('.summary .amt.tot[data-of="' + key + '"][data-side="' + side + '"]');
        if (head) show(head, t);
        if (t != null) all[side] = (all[side] || 0) + t;
      });
      var d = (s.inc == null && s.exp == null) ? null : (s.inc || 0) - (s.exp || 0);
      part.querySelectorAll('.amt.dif').forEach(function (c) { show(c, d); });
      var hd = document.querySelector('.summary .amt.dif[data-of="' + key + '"]');
      if (hd) show(hd, d);
    });
    ['inc', 'exp'].forEach(function (side) {
      var c = document.querySelector('.summary .amt.tot[data-of="ALL"][data-side="' + side + '"]');
      if (c) show(c, all[side]);
    });
    var g = document.querySelector('.summary .amt.dif[data-of="ALL"]');
    if (g) show(g, (all.inc == null && all.exp == null) ? null : (all.inc || 0) - (all.exp || 0));
  }

  function store() {
    var d = { amt: {}, nm: {}, add: [] };
    document.querySelectorAll('.amt[data-id]').forEach(function (a) { d.amt[a.dataset.id] = a.dataset.v; });
    document.querySelectorAll('.nm[data-id]').forEach(function (n) { d.nm[n.dataset.id] = n.textContent; });
    document.querySelectorAll('tr[data-added]').forEach(function (tr) {
      var t = tr.closest('table');
      d.add.push({
        part: tr.closest('section[data-part]').dataset.part,
        side: t.dataset.side,
        idx: [].indexOf.call(tr.closest('section').querySelectorAll('table[data-side="' + t.dataset.side + '"]'), t),
        name: tr.querySelector('.nm').textContent,
        v: tr.querySelector('.amt').dataset.v
      });
    });
    try { localStorage.setItem(KEY, JSON.stringify(d)); msg.textContent = 'השינויים נשמרו במחשב הזה'; } catch (e) {}
  }

  function addRow(table, name, v, restoring) {
    var tr = document.createElement('tr');
    tr.dataset.added = '1';
    tr.innerHTML = '<td><span class="nm" contenteditable="' + body.classList.contains('editing') + '"></span></td>' +
      '<td class="n"><span class="amt empty" data-v="" contenteditable="' + body.classList.contains('editing') + '"></span></td>' +
      '<td class="rmcell"><button class="rm" title="מחיקת השורה">✕</button></td>';
    tr.querySelector('.nm').textContent = name || 'סעיף חדש';
    // הדפסן מוסיף tbody לבד, ולכן השורה נכנסת אל ההורה של שורת הסה״כ ולא אל ה-table
    var tot = table.querySelector('tr.total');
    if (tot) tot.parentNode.insertBefore(tr, tot);
    else (table.tBodies[0] || table).appendChild(tr);
    show(tr.querySelector('.amt'), v == null || v === '' ? null : Number(v));
    if (!restoring) { recalc(); tr.querySelector('.nm').focus(); }
    return tr;
  }

  function restore() {
    var d;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (!d) return;
    document.querySelectorAll('.amt[data-id]').forEach(function (a) {
      if (d.amt && d.amt[a.dataset.id] !== undefined) {
        show(a, d.amt[a.dataset.id] === '' ? null : Number(d.amt[a.dataset.id]));
      }
    });
    document.querySelectorAll('.nm[data-id]').forEach(function (n) {
      if (d.nm && d.nm[n.dataset.id] !== undefined) n.textContent = d.nm[n.dataset.id];
    });
    (d.add || []).forEach(function (r) {
      var sec = document.querySelector('section[data-part="' + r.part + '"]');
      if (!sec) return;
      var t = sec.querySelectorAll('table[data-side="' + r.side + '"]')[r.idx || 0];
      if (t) addRow(t, r.name, r.v, true);
    });
    msg.textContent = 'נטענו שינויים ששמרת כאן';
  }

  // ── עריכה ──
  function setEditable(on) {
    document.querySelectorAll('.amt:not(.tot):not(.dif), .nm').forEach(function (el) {
      el.contentEditable = on ? 'true' : 'false';
    });
    document.querySelectorAll('.rmcell').forEach(function (td) {
      if (on && !td.querySelector('.rm') && td.closest('tr') && !td.closest('tr').classList.contains('total')) {
        td.innerHTML = '<button class="rm" title="מחיקת השורה">✕</button>';
      }
    });
  }
  document.getElementById('edit').addEventListener('click', function () {
    var on = !body.classList.contains('editing');
    body.classList.toggle('editing', on);
    this.classList.toggle('on', on);
    this.textContent = on ? '✓ סיימתי לשנות' : '✎ לשנות נתונים';
    setEditable(on);
    if (!on) store();
  });
  document.getElementById('print').addEventListener('click', function () {
    body.classList.remove('editing');
    document.getElementById('edit').classList.remove('on');
    document.getElementById('edit').textContent = '✎ לשנות נתונים';
    setEditable(false); store();
    setTimeout(function () { window.print(); }, 60);
  });
  document.getElementById('save').addEventListener('click', function () {
    body.classList.remove('editing'); setEditable(false); store();
    document.querySelectorAll('.amt[data-v], .nm').forEach(function (el) {
      if (el.classList.contains('amt')) el.setAttribute('data-v0', el.dataset.v);
    });
    var blob = new Blob(['<!doctype html>' + document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'תקציב לחתימה - ${esc(hub.name)} - מעודכן.html';
    a.click();
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (!confirm('לחזור לנתונים המקוריים ממערכת התקציב? כל השינויים שנעשו כאן יימחקו.')) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  });

  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('rm')) { e.target.closest('tr').remove(); recalc(); store(); }
    if (e.target.classList.contains('addrow')) {
      var wrap = e.target.previousElementSibling;
      while (wrap && wrap.tagName !== 'TABLE') wrap = wrap.previousElementSibling;
      if (wrap) addRow(wrap, '', null, false);
      store();
    }
  });
  document.addEventListener('blur', function (e) {
    var el = e.target;
    if (!el.classList) return;
    if (el.classList.contains('amt') && !el.classList.contains('tot') && !el.classList.contains('dif')) {
      show(el, parse(el.textContent)); recalc(); store();
    } else if (el.classList.contains('nm')) { store(); }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.isContentEditable) { e.preventDefault(); e.target.blur(); }
  });

  restore();
  recalc();
})();
</script>
</body></html>`;

const base = path.join(OUT_DIR, `תקציב לחתימה - ${hub.name}`);
fs.writeFileSync(base + '.html', html);
const { chromium } = await import(`file:///${PW}`);
// Chrome המותקן במחשב, כדי לא להיות תלויים בהתאמה בין גרסת playwright לדפדפנים שהורדו
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({ path: base + '.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(JSON.stringify({
  school: hub.name,
  A: { income: A.inc, grossExpenses: A.gross, cuts: A.cuts, expenses: A.exp },
  C: { income: C.inc, expenses: C.exp },
  balance: A.inc + C.inc - A.exp - C.exp,
  html: base + '.html',
  pdf: base + '.pdf',
}, null, 1));
