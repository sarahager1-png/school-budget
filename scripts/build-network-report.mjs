// ============================================================
// המסמך המרכז של הרשת — כל 12 בתי הספר בנייר אחד.
//
//   node scripts/build-network-report.mjs          — בתי הספר שלהבות בלבד
//   node scripts/build-network-report.mjs --all     — כולל בתי החינוך
//
// התוצר: reports/network.html — נפתח בדפדפן, מודפס ל-A4, ויש בו מקום להערות.
// המספרים נלקחים מאותו מנוע שמחשב לכל בית ספר בנפרד (calculations.js
// ו-efficiency.js), ולכן כל שורה כאן שווה בדיוק לסכום המסמכים הפרטניים.
// ============================================================
import fs from 'fs';
import path from 'path';
import { collect, totalsFor, REPORT_CSS } from './build-school-report.mjs';
import { buildSuggestionRows, normalizeSuggestionKey } from '../src/lib/efficiency.js';
import { annualAmount } from '../src/lib/calculations.js';
import { nis } from './report-rows.mjs';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));
const outDir = path.join(root, 'reports');

// בתי החינוך רעננה ועפולה אינם נכללים במסמך המרכז של שלהבות. הם מוצגים
// כרגיל במבט רשת ובמסמך הפרטני שלהם — כאן הם יורדים כדי שסכומי הרשת
// יתארו את שלהבות בלבד. --all מחזיר אותם.
const EXCLUDED = ['raanana', 'afula'];
const includeAll = process.argv.includes('--all');
const targets = includeAll ? config.schools : config.schools.filter(s => !EXCLUDED.includes(s.slug));
const excludedNames = includeAll ? [] : config.schools.filter(s => EXCLUDED.includes(s.slug)).map(s => s.name);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');

// סעיפי ההכנסה וההוצאה, באותה חלוקה שבמסמך של בית ספר בודד. כל שדה כאן
// מצטבר על פני כל המוסדות — ולכן סכום הסעיפים שווה לסכום הכולל, בדיוק
// כמו במסמך הפרטני.
const INCOME_LINES = [
  ['שעות תקן — משרד החינוך', t => t.totalMinistryIncome],
  ['תוספת כללית לתלמיד — משרד החינוך', t => t.totalMinistryGrantIncome],
  ['שכר לימוד', t => t.totalStudentIncome],
  ['תל"ן — תשלומי הורים', t => t.totalTalanIncome],
  ['הכנסות נוספות של בתי הספר', t => t.additionalIncome],
];

// סעיף ראשי, ותחתיו הפירוט שמרכיב אותו. סכום הפירוט שווה לסעיף הראשי,
// והבדיקה בסוף הקובץ מוודאת שהסעיפים הראשיים מסתכמים לסה"כ.
const EXPENSE_LINES = [
  ['עלות הוראה בפועל', (t) => t.totalClassActualCost],
  ['ייעוץ', (t) => t.totalCounselingCost],
  ['תוספת חוגים', (t) => t.totalClubsExpense],
  ['הוצאה לתלמיד', (t) => t.totalStudentExpenses],
  ['פיתוח מקצועי', (t) => t.totalProfDev],
  ['שכר', (t) => t.salaryExpenses, [
    ['שכר מנהלות', (t, d) => principalAnnual(d)],
    ['שאר השכר', (t, d) => t.salaryExpenses - principalAnnual(d)],
  ]],
  ['בניין ותחזוקה', (t) => t.buildingExpenses],
  ['פעילויות ואירועים', (t) => t.operationExpenses],
  ['ציוד ותשתיות', (t) => t.summerExpenses],
  ['אחר', (t) => t.miscExpenses],
];

const principalAnnual = (d) => {
  const row = d.state.expenses.find(e => e.name === 'שכר מנהלת');
  return row ? annualAmount(row) : 0;
};

// החיסכון מההצעות שהמנהלת בחרה בפועל. הצעה שנשמרה פעם ואינה קיימת עוד
// במנוע פשוט לא נספרת — בדיוק כמו במסמך של אותו בית ספר.
function chosenSaving(d) {
  if (d.mode === 'simple') return { saving: 0, count: 0, offered: 0 };
  const rows = buildSuggestionRows(d.state.classes, d.state.expenses, d.categories, d.state.constants, d.draftParams || {});
  const keys = d.selectedKeys == null ? null : new Set(d.selectedKeys.map(normalizeSuggestionKey));
  const chosen = rows.filter(r => keys == null || keys.has(r.key));
  return { saving: chosen.reduce((n, r) => n + r.saving, 0), count: chosen.length, offered: rows.length };
}

const schools = [];
for (const s of targets) {
  const d = await collect(s);
  if (d.error) { console.log(`✗ ${s.name} — ${d.error}`); continue; }
  const t = totalsFor(d);
  schools.push({ d, t, eff: chosenSaving(d) });
  console.log(`✓ ${d.name}`);
}

const sum = (f) => schools.reduce((n, x) => n + (Number(f(x)) || 0), 0);
const totalIncome = sum(x => x.t.totalIncome);
const totalExpenses = sum(x => x.t.totalExpenses);
const balance = totalIncome - totalExpenses;
const students = sum(x => x.t.totalStudents);
const classCount = sum(x => x.d.state.classes.length);
const savings = sum(x => x.eff.saving);
const yearLabel = schools[0]?.d.yearLabel ?? '';

const row = (label, value, items = []) => `
      <tr class="line${items.length ? ' group' : ''}">
        <td>${esc(label)}</td>
        <td class="num muted-cell">${nis(value / 12)}</td>
        <td class="num">${nis(value)}</td>
      </tr>${items.map(([l, v]) => `
      <tr class="sub">
        <td>${esc(l)}</td>
        <td class="num muted-cell">${nis(v / 12)}</td>
        <td class="num">${nis(v)}</td>
      </tr>`).join('')}`;

const schoolRows = schools.map(({ d, t, eff }) => `
      <tr>
        <td>${esc(d.name)}${d.state.classes.length === 0 ? ' <span class="tag">טרם הוזנו נתונים</span>' : ''}</td>
        <td class="num">${d.state.classes.length}</td>
        <td class="num">${t.totalStudents}</td>
        <td class="num pos">${nis(t.totalIncome)}</td>
        <td class="num neg">${nis(t.totalExpenses)}</td>
        <td class="num ${t.balance < 0 ? 'neg' : 'pos'}">${nis(t.balance)}</td>
        <td class="num">${pct(t.totalIncome, t.totalExpenses)}</td>
        <td class="num">${t.totalStudents ? nis(t.balance / t.totalStudents) : '—'}</td>
        <td class="num">${eff.saving ? nis(eff.saving) : '—'}</td>
      </tr>`).join('');

const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>תקציב הרשת — מסמך מרכז ${esc(yearLabel)}</title>
<style>
  body { margin: 0; background: #eef1f0; }
  .sheet { max-width: 210mm; margin: 24px auto; background: #fff; padding: 20mm 16mm; box-shadow: 0 10px 40px -20px rgba(0,0,0,.45); }
  .back { display: block; max-width: 210mm; margin: 16px auto -8px; font: 14px 'Heebo','Segoe UI',Arial,sans-serif; color: #0d6e63; direction: rtl; }
  .doc-toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 14px; }
  .doc-toolbar button { font: inherit; font-size: 13.5px; padding: 8px 16px; border-radius: 8px; cursor: pointer; background: #0d6e63; color: #fff; border: 0; }
  ${REPORT_CSS}
  .doc .schools-table { font-size: 12.5px; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; padding: 0; box-shadow: none; max-width: none; }
    .back { display: none; }
    .doc .schools-table { font-size: 10.5px; }
  }
</style>
</head>
<body>
<a class="back no-print" href="index.html">← למסמכים של בתי הספר</a>
<div class="sheet"><div class="doc">

  <div class="doc-toolbar no-print"><button onclick="window.print()">הדפסה / שמירה כ-PDF</button></div>

  <div class="doc-head">
    <div class="bh"><span>ב"ה</span><span>${new Date().toLocaleDateString('he-IL')}</span></div>
    <h1>תקציב הרשת — מסמך מרכז</h1>
    <p class="sub-title">רשת חינוך חב"ד · ${esc(yearLabel)}</p>
    <p class="counts">${schools.length} מוסדות · ${classCount} כיתות · ${students} תלמידים</p>
    ${excludedNames.length ? `<p class="scope-note">המסמך מסכם את בתי הספר שלהבות. ${excludedNames.join(' ו')} אינם נכללים בו.</p>` : ''}
  </div>

  <div class="kpis">
    <div class="kpi inc"><span>סה"כ הכנסות</span><b>${nis(totalIncome)}</b></div>
    <div class="kpi exp"><span>סה"כ הוצאות</span><b>${nis(totalExpenses)}</b></div>
    <div class="kpi bal ${balance < 0 ? 'neg' : 'pos'}"><span>${balance < 0 ? 'גירעון' : 'עודף'}</span><b>${nis(balance)}</b></div>
  </div>

  <div class="ratios">
    <div><span>ממוצע תלמידים לכיתה</span><b>${classCount ? (students / classCount).toFixed(1) : '—'}</b></div>
    <div><span>הכנסה לתלמיד</span><b>${students ? nis(totalIncome / students) : '—'}</b></div>
    <div><span>הוצאה לתלמיד</span><b>${students ? nis(totalExpenses / students) : '—'}</b></div>
    <div><span>כיסוי ההוצאות מההכנסות</span><b>${pct(totalIncome, totalExpenses)}</b></div>
    <div><span>גירעון לתלמיד</span><b class="${balance < 0 ? 'neg' : 'pos'}">${students ? nis(balance / students) : '—'}</b></div>
    <div><span>ייעול שנבחר בכל הרשת</span><b class="pos">${nis(savings)}</b></div>
  </div>

  <h2>בתי הספר</h2>
  <div class="table-scroll"><table class="schools-table">
    <thead><tr>
      <th>בית ספר</th><th class="num">כיתות</th><th class="num">תל׳</th>
      <th class="num">הכנסות</th><th class="num">הוצאות</th><th class="num">יתרה</th>
      <th class="num">כיסוי</th><th class="num">יתרה לתלמיד</th><th class="num">ייעול נבחר</th>
    </tr></thead>
    <tbody>
      ${schoolRows}
      <tr class="total">
        <td>סה"כ ${schools.length} מוסדות</td>
        <td class="num">${classCount}</td>
        <td class="num">${students}</td>
        <td class="num pos">${nis(totalIncome)}</td>
        <td class="num neg">${nis(totalExpenses)}</td>
        <td class="num ${balance < 0 ? 'neg' : 'pos'}">${nis(balance)}</td>
        <td class="num">${pct(totalIncome, totalExpenses)}</td>
        <td class="num">${students ? nis(balance / students) : '—'}</td>
        <td class="num pos">${nis(savings)}</td>
      </tr>
    </tbody>
  </table></div>

  <h2>הכנסות הרשת — כל הסעיפים</h2>
  <table>
    <thead><tr><th>סעיף</th><th class="num">ממוצע לחודש</th><th class="num">לשנה</th></tr></thead>
    <tbody>
      ${INCOME_LINES.map(([label, f]) => [label, sum(x => f(x.t, x.d))])
        .filter(([, v]) => Math.round(v) !== 0).map(([label, v]) => row(label, v)).join('')}
      <tr class="total"><td>סה"כ הכנסות</td><td class="num muted-cell">${nis(totalIncome / 12)}</td><td class="num pos">${nis(totalIncome)}</td></tr>
    </tbody>
  </table>

  <h2>הוצאות הרשת — כל הסעיפים</h2>
  <table>
    <thead><tr><th>סעיף</th><th class="num">ממוצע לחודש</th><th class="num">לשנה</th></tr></thead>
    <tbody>
      ${EXPENSE_LINES
        .map(([label, f, kids]) => [label, sum(x => f(x.t, x.d)),
          (kids || []).map(([l, kf]) => [l, sum(x => kf(x.t, x.d))]).filter(([, v]) => Math.round(v) !== 0)])
        .filter(([, v]) => Math.round(v) !== 0)
        .map(([label, v, kids]) => row(label, v, kids)).join('')}
      <tr class="total"><td>סה"כ הוצאות</td><td class="num muted-cell">${nis(totalExpenses / 12)}</td><td class="num neg">${nis(totalExpenses)}</td></tr>
    </tbody>
  </table>

  <table class="bottom-line">
    <tbody><tr class="total">
      <td>${balance < 0 ? 'גירעון שנתי — כלל הרשת' : 'עודף שנתי — כלל הרשת'}</td>
      <td class="num muted-cell">${nis(balance / 12)}</td>
      <td class="num ${balance < 0 ? 'neg' : 'pos'}">${nis(balance)}</td>
    </tr>
    <tr class="total">
      <td>מצב הרשת לאחר יישום הצעות הייעול שנבחרו</td>
      <td class="num muted-cell">${nis((balance + savings) / 12)}</td>
      <td class="num ${balance + savings < 0 ? 'neg' : 'pos'}">${nis(balance + savings)}</td>
    </tr></tbody>
  </table>

  <h2>הערות</h2>
  <div class="notes-lines">
    <p class="no-print">מקום לכתיבה — אפשר להקליד כאן לפני ההדפסה, או להשאיר ריק ולכתוב ביד.</p>
    ${'<div class="line" contenteditable="true"></div>'.repeat(6)}
  </div>

</div></div>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'network.html'), html, 'utf8');

// בדיקת הצלבה: סכום הסעיפים חייב להיות שווה לסכומים הכוללים
const incSum = INCOME_LINES.reduce((n, [, f]) => n + sum(x => f(x.t, x.d)), 0);
const expSum = EXPENSE_LINES.reduce((n, [, f]) => n + sum(x => f(x.t, x.d)), 0);
const d1 = Math.round(incSum - totalIncome), d2 = Math.round(expSum - totalExpenses);
if (d1 || d2) console.log(`  ⚠ הסעיפים אינם מסתכמים: הכנסות ${d1}, הוצאות ${d2}`);

console.log(`\n✓ reports/network.html — ${schools.length} מוסדות · ${students} תלמידים · יתרה ${nis(balance)}`);
