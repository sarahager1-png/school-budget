// ============================================================
// מסמך מרכז לכל בית ספר — תשקיף להנהלה, אינטראקטיבי.
//
//   node scripts/build-school-report.mjs              — כל בתי הספר
//   node scripts/build-school-report.mjs or-akiva     — בית ספר אחד
//
// התוצר: reports/<slug>.html + reports/index.html. כל קובץ עומד בפני עצמו,
// נפתח בדפדפן, מודפס ל-A4 (או נשמר כ-PDF), ויש בו מקום להערות.
//
// במסמך אפשר לשנות מספרי תלמידים, להוסיף ולהוריד סעיפים ולכוון את בסיס
// החישוב — והכול מחושב מחדש מיד. המספרים אינם מחושבים כאן מחדש: הסקריפט
// מטמיע לתוך הקובץ את מנוע החישוב של האפליקציה עצמה (calculations.js
// ו-efficiency.js), ולכן כל שורה זהה למה שהמנהלת רואה במסך.
//
// הנתונים נקראים עם מפתח השירות מ-.env.<slug>.local — קריאה בלבד.
// השינויים במסמך נשמרים בדפדפן שבו נערכו ואינם נכתבים למסד.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { calculateSchoolTotals, calculateSimpleTotals } from '../src/lib/calculations.js';
import { DEFAULT_CONSTANTS } from '../src/data/constants.js';
import { rowsIncome, rowsExpense, sumRows, nis } from './report-rows.mjs';
import { docStateFromRows, docCategories } from './report-data.mjs';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));
const slugs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const targets = slugs.length ? config.schools.filter(s => slugs.includes(s.slug)) : config.schools;
const outDir = path.join(root, 'reports');

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

// הטמעת מודול לתוך הדף: מורידים את שורות ה-import (הכול ממילא באותו סקופ)
// ואת המילה export. אותה שיטה כמו bundle-network-function.mjs.
export function inlineModule(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import\s+[\s\S]*?from\s+'[^']+';\s*$/gm, '')
    .replace(/^export\s+(const|function|class)\s/gm, '$1 ');
}

const ENGINE = [
  'src/data/constants.js',
  'src/lib/categoryKinds.js',
  'src/lib/calculations.js',
  'src/lib/efficiency.js',
  'scripts/report-data.mjs',
  'scripts/report-rows.mjs',
  'scripts/report-client.js',
].map(inlineModule).join('\n\n');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ---------- איסוף נתונים לבית ספר אחד ----------
export async function collect(school) {
  const env = loadEnvFile(path.join(root, `.env.${school.slug}`));
  const local = loadEnvFile(path.join(root, `.env.${school.slug}.local`));
  if (!local.SUPABASE_SERVICE_ROLE_KEY) return { error: `אין מפתח שירות (.env.${school.slug}.local)` };

  const db = createClient(env.VITE_SUPABASE_URL || `https://${school.ref}.supabase.co`,
    local.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const [{ data: schoolRows }, { data: years }] = await Promise.all([
    db.from('schools').select('name,mode').limit(1),
    db.from('budget_years').select('id,label,year,is_active'),
  ]);
  const year = (years || []).find(y => y.is_active) || (years || [])[0];
  if (!year) return { error: 'לא הוגדרה שנת תקציב' };

  const [cls, inc, exp, cats, consts, approval] = await Promise.all([
    db.from('classes').select('id,name,grade_level,student_count,extra_hours').eq('budget_year_id', year.id),
    db.from('income_sources').select('id,name,amount').eq('budget_year_id', year.id),
    db.from('expenses').select('id,name,amount,period,category_id').eq('budget_year_id', year.id),
    db.from('expense_categories').select('id,name,kind'),
    db.from('financial_constants').select('*').eq('budget_year_id', year.id).maybeSingle(),
    db.from('budget_approvals').select('notes,summary,selected_suggestion_keys,principal_name,courier_name')
      .eq('budget_year_id', year.id).maybeSingle(),
  ]);

  return {
    slug: school.slug,
    name: schoolRows?.[0]?.name || school.name,
    mode: schoolRows?.[0]?.mode === 'simple' ? 'simple' : 'full',
    yearId: year.id,
    yearLabel: year.label,
    categories: docCategories(cats.data),
    notes: approval.data?.notes || '',
    principalName: approval.data?.principal_name || '',
    courierName: approval.data?.courier_name || '',
    selectedKeys: approval.data?.selected_suggestion_keys ?? null,
    draftParams: approval.data?.summary?.draftParams || {},
    state: docStateFromRows({
      classes: cls.data, income: inc.data, expenses: exp.data, constants: consts.data,
    }, env.VITE_DISABLE_CLUBS === '1'),
  };
}

export const totalsFor = (d) => (d.mode === 'simple'
  ? Object.assign(calculateSimpleTotals(d.state.incomeSources, d.state.expenses), { totalStudents: 0 })
  : calculateSchoolTotals(d.state.classes, d.state.incomeSources, d.state.expenses, d.state.constants, d.categories));

// ---------- העיצוב ----------
export const REPORT_CSS = `
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  .doc { color: #16211f; direction: rtl; font-family: 'Heebo','Segoe UI',Arial,sans-serif; font-size: 14px; line-height: 1.55; }
  .doc .bh { display: flex; position: static; justify-content: space-between; font-size: 12px; color: #6b7a77; font-weight: 400; }
  .doc h1 { font-size: 25px; margin: 4px 0 2px; font-weight: 800; }
  .doc .sub-title { color: #4b5c59; margin: 0; font-weight: 500; }
  .doc .counts { color: #0d6e63; font-weight: 700; margin: 6px 0 0; }
  .doc-head { text-align: center; border-bottom: 2px solid #0d6e63; padding-bottom: 12px; margin-bottom: 18px; }

  .doc-toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 14px; flex-wrap: wrap; }
  .doc-toolbar button {
    font: inherit; font-size: 13.5px; padding: 8px 16px; border-radius: 8px; cursor: pointer;
    background: #0d6e63; color: #fff; border: 0;
  }
  .doc-toolbar button.warn { background: #fff; color: #b45309; border: 1px solid #f0d9ae; }
  .doc-toolbar button:disabled { opacity: .6; cursor: default; }

  .doc-banner { background: #fef6e7; border: 1px solid #f0d9ae; color: #7a5b16; border-radius: 10px; padding: 8px 12px; margin-bottom: 14px; font-size: 13px; }
  .doc-banner.hidden { display: none; }
  .doc-banner .link { background: none; border: 0; color: #0d6e63; font: inherit; font-weight: 700; cursor: pointer; text-decoration: underline; }

  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { border: 1px solid #dde5e3; border-radius: 10px; padding: 10px 12px; text-align: center; }
  .kpi span { display: block; font-size: 11.5px; color: #6b7a77; }
  .kpi b { font-size: 19px; font-variant-numeric: tabular-nums; }
  .kpi.inc b { color: #14804a; } .kpi.exp b { color: #c02626; }
  .kpi.bal.pos b { color: #0d6e63; } .kpi.bal.neg b { color: #c02626; }

  .doc h2 { font-size: 15px; margin: 22px 0 6px; padding-bottom: 5px; border-bottom: 2px solid #cfe0dc; }
  .doc table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .doc td, .doc th { padding: 5px 4px; border-bottom: 1px solid #eef1f0; vertical-align: top; }
  .doc th { text-align: right; font-size: 11.5px; color: #6b7a77; font-weight: 600; border-bottom: 1px solid #cfe0dc; }
  .doc .num { text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* היררכיה: סעיף ראשי מודגש, והפירוט שמתחתיו נסוג פנימה ובאפור */
  .doc tr.line td { font-weight: 600; }
  .doc tr.group td { background: #f4f8f7; border-top: 1px solid #dde5e3; }
  .doc tr.sub td { color: #6b7a77; font-weight: 400; font-size: 12.5px; padding-right: 26px; border-bottom: 0; padding-top: 1px; padding-bottom: 1px; }
  .doc tr.sub td:first-child { border-inline-start: 0; position: relative; }
  .doc tr.sub td:first-child::before { content: "—"; position: absolute; right: 12px; color: #c3cfcc; }
  .doc tr.total td { font-weight: 800; border-top: 2px solid #cfe0dc; border-bottom: 0; padding-top: 8px; }
  .doc tr.unpicked td { color: #a8b4b1; text-decoration: line-through; }
  .doc .pos { color: #14804a; } .doc .neg { color: #c02626; }

  .doc input.cell {
    font: inherit; text-align: left; border: 1px solid #dde5e3; border-radius: 6px;
    padding: 2px 6px; width: 130px; background: #fbfdfc; font-variant-numeric: tabular-nums;
  }
  .doc input.cell.wide { width: 150px; text-align: right; }
  .doc input.cell.narrow { width: 64px; }
  .doc input.cell:focus { outline: 2px solid #0d6e63; outline-offset: 1px; }
  .doc button.x { border: 0; background: none; color: #c9a0a0; cursor: pointer; font-size: 12px; padding: 0 6px; }
  .doc button.x:hover { color: #c02626; }
  .doc button.add { font: inherit; font-size: 13px; background: none; border: 1px dashed #cfe0dc; color: #0d6e63; border-radius: 8px; padding: 6px 12px; cursor: pointer; margin-bottom: 10px; }

  .ratios { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
  .ratios div { border: 1px solid #e3ebe9; background: #f6f9f8; border-radius: 8px; padding: 7px 10px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .ratios span { font-size: 11.5px; color: #6b7a77; }
  .ratios b { font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .doc .print-val { display: none; }
  .doc .tag { font-size: 10.5px; color: #9a6b00; background: #fef6e7; border: 1px solid #f0d9ae; border-radius: 5px; padding: 0 5px; white-space: nowrap; }
  .doc .scope-note { color: #6b7a77; font-size: 12px; margin: 6px 0 0; }
  .doc .table-note { color: #6b7a77; font-size: 11.5px; margin: 2px 0 12px; line-height: 1.5; }
  .doc .empty-note { color: #6b7a77; font-size: 13px; margin: 0 0 12px; }
  .doc .sug-toggle { margin: 0 0 8px; }
  .doc .link { background: none; border: 0; color: #0d6e63; font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0; }
  .doc .muted-cell { color: #8b9895; font-size: 12.5px; }
  .doc .classes-table { font-size: 12px; }
  .doc .table-scroll { overflow-x: auto; }

  .basis { background: #f6f9f8; border: 1px solid #e3ebe9; border-radius: 10px; padding: 10px 12px; font-size: 12.5px; color: #4b5c59; }
  .basis div { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 3px 0; }

  .notes-lines { border: 1px solid #dde5e3; border-radius: 10px; padding: 10px 12px 4px; }
  .notes-lines p { margin: 0 0 8px; font-size: 12px; color: #6b7a77; }
  .notes-lines .line { border-bottom: 1px solid #dde5e3; height: 26px; }
  .saved-note { white-space: pre-wrap; background: #f6f9f8; border: 1px solid #e3ebe9; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; font-size: 13px; }

  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
  .sign { border: 1px solid #dde5e3; border-radius: 10px; padding: 10px 12px; }
  .sign span { font-size: 12px; color: #6b7a77; }
  .sign .rule { border-bottom: 1px solid #b9c7c4; height: 30px; margin-top: 10px; }

  @media print {
    .no-print { display: none !important; }
    .doc tr.unpicked { display: none; }

    /* input מדפיס ערך גולמי — בהדפסה מוצג במקומו הטקסט המעוצב */
    .doc input.cell { display: none; }
    .doc .print-val { display: inline; }

    /* 12 עמודות על A4 לאורך: גופן וריווח מוקטנים, בלי מספרים שנשברים */
    .doc .classes-table { font-size: 8.5px; }
    .doc .classes-table td, .doc .classes-table th { padding: 2px 2px; }
    .doc .table-scroll { overflow: visible; }

    .doc .page-break { break-before: page; }
    .doc tr { break-inside: avoid; }
    .doc h2 { break-after: avoid; }
    .doc table { break-inside: auto; }
    .signs, .notes-lines, .ratios { break-inside: avoid; }
  }`;

// ---------- הקובץ העצמאי ----------
function documentHtml(d) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>תקציב ${esc(d.name)} — ${esc(d.yearLabel)}</title>
<style>
  body { margin: 0; background: #eef1f0; }
  .sheet { max-width: 210mm; margin: 24px auto; background: #fff; padding: 20mm 16mm; box-shadow: 0 10px 40px -20px rgba(0,0,0,.45); }
  .back { display: block; max-width: 210mm; margin: 16px auto -8px; font: 14px 'Heebo','Segoe UI',Arial,sans-serif; color: #0d6e63; direction: rtl; }
  ${REPORT_CSS}
  @media print { body { background: #fff; } .sheet { margin: 0; padding: 0; box-shadow: none; max-width: none; } .back { display: none; } }
</style>
</head>
<body>
<a class="back no-print" href="index.html">← לכל בתי הספר</a>
<div class="sheet"><div class="doc" id="doc"></div></div>
<script type="module">
${ENGINE}

const DATA = ${JSON.stringify({
    name: d.name, yearLabel: d.yearLabel, mode: d.mode, categories: d.categories,
    notes: d.notes, principalName: d.principalName, courierName: d.courierName,
    selectedKeys: d.selectedKeys, draftParams: d.draftParams, state: d.state,
  })};

// השינויים נשמרים בדפדפן הזה בלבד — הקובץ מקומי ואין לו גישה למסד.
const KEY = 'report-${d.slug}-${d.yearId}';
const clone = (o) => JSON.parse(JSON.stringify(o));
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }

mountReport(document.getElementById('doc'), {
  ...DATA,
  state: saved?.state || clone(DATA.state),
  selectedKeys: saved?.selectedKeys ?? DATA.selectedKeys,
  original: clone(DATA.state),
  onSave: (S) => {
    try { localStorage.setItem(KEY, JSON.stringify({ state: S, selectedKeys: S.selectedKeys ?? null })); }
    catch { throw new Error('הדפדפן חוסם שמירה'); }
  },
});
</script>
</body>
</html>`;
}

function indexHtml(built) {
  const today = new Date().toLocaleDateString('he-IL');
  const rows = built.map(b => b.error
    ? `<tr><td>${esc(b.name)}</td><td colspan="5" class="muted">${esc(b.error)}</td></tr>`
    : `<tr>
        <td><a href="${b.slug}.html">${esc(b.name)}</a></td>
        <td class="num">${b.classes}</td>
        <td class="num">${b.students}</td>
        <td class="num pos">${nis(b.income)}</td>
        <td class="num neg">${nis(b.expenses)}</td>
        <td class="num ${b.balance < 0 ? 'neg' : 'pos'}">${nis(b.balance)}</td>
      </tr>`).join('');
  const ok = built.filter(b => !b.error);
  const sum = (f) => ok.reduce((n, b) => n + f(b), 0);

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מסמכי התקציב — כל בתי הספר</title>
<style>
  body { margin: 0; background: #eef1f0; color: #16211f; direction: rtl; font-family: 'Heebo','Segoe UI',Arial,sans-serif; }
  .sheet { max-width: 900px; margin: 32px auto; background: #fff; border-radius: 14px; padding: 28px 30px; box-shadow: 0 10px 40px -22px rgba(0,0,0,.4); }
  h1 { font-size: 24px; margin: 0 0 4px; }
  p.lede { color: #4b5c59; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: right; font-size: 12px; color: #6b7a77; border-bottom: 1px solid #cfe0dc; padding: 6px 4px; }
  td { padding: 8px 4px; border-bottom: 1px solid #eef1f0; }
  .num { text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pos { color: #14804a; } .neg { color: #c02626; } .muted { color: #8b9895; }
  a { color: #0d6e63; font-weight: 600; text-decoration: none; }
  a:hover { text-decoration: underline; }
  tr.total td { font-weight: 800; border-top: 2px solid #cfe0dc; }
</style>
</head>
<body>
<div class="sheet">
  <h1>מסמכי התקציב — כל בתי הספר</h1>
  <p class="lede"><a href="network.html"><b>← המסמך המרכז של הרשת</b></a> — כל בתי הספר שלהבות בנייר אחד.</p>
  <p class="lede">הופק ${today}. כל שורה נפתחת למסמך מלא של אותו בית ספר — אפשר לשנות בו תלמידים וסעיפים, והמספרים מתעדכנים מיד.</p>
  <table>
    <thead><tr><th>בית ספר</th><th class="num">כיתות</th><th class="num">תלמידים</th><th class="num">הכנסות</th><th class="num">הוצאות</th><th class="num">יתרה</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total">
        <td>סה"כ (${ok.length} מוסדות)</td>
        <td class="num">${sum(b => b.classes)}</td>
        <td class="num">${sum(b => b.students)}</td>
        <td class="num pos">${nis(sum(b => b.income))}</td>
        <td class="num neg">${nis(sum(b => b.expenses))}</td>
        <td class="num ${sum(b => b.balance) < 0 ? 'neg' : 'pos'}">${nis(sum(b => b.balance))}</td>
      </tr>
    </tbody>
  </table>
</div>
</body>
</html>`;
}

// ---------- הרצה ----------
if (process.argv[1] && process.argv[1].endsWith('build-school-report.mjs')) {
  fs.mkdirSync(outDir, { recursive: true });
  const built = [];

  for (const school of targets) {
    const d = await collect(school);
    if (d.error) {
      console.log(`✗ ${school.name} — ${d.error}`);
      built.push({ slug: school.slug, name: school.name, error: d.error });
      continue;
    }
    const t = totalsFor(d);
    const rowData = { mode: d.mode, ...d.state, categories: d.categories };

    // בדיקת הצלבה: הסעיפים במסמך חייבים להסתכם בדיוק לסכומים שבראשו. אם
    // נוסף מרכיב למנוע ולא נוספה לו שורה, האזהרה תופיע כאן ולא אצל ההנהלה.
    const incDiff = Math.round(sumRows(rowsIncome(rowData, t)) - t.totalIncome);
    const expDiff = Math.round(sumRows(rowsExpense(rowData, t)) - t.totalExpenses);
    if (incDiff || expDiff) {
      console.log(`  ⚠ ${d.name} — הסעיפים אינם מסתכמים: הכנסות ${incDiff}, הוצאות ${expDiff}`);
    }

    fs.writeFileSync(path.join(outDir, `${school.slug}.html`), documentHtml(d), 'utf8');
    built.push({
      slug: school.slug, name: d.name,
      classes: d.state.classes.length, students: t.totalStudents,
      income: t.totalIncome, expenses: t.totalExpenses, balance: t.balance,
    });
    console.log(`✓ ${d.name.padEnd(22)} ${d.state.classes.length} כיתות · ${t.totalStudents} תלמידים · יתרה ${nis(t.balance)}`);
  }

  fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml(built), 'utf8');
  console.log(`\nנכתבו ${built.filter(b => !b.error).length} מסמכים ל-${outDir}`);
}
