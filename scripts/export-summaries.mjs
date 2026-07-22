// ============================================================
// מסמך סיכום תקציב + הצעות ייעול לכל מוסד — קובץ HTML (ו-PDF) פר בי"ס.
//
//   node scripts/export-summaries.mjs [slug ...]        (ברירת מחדל: כולם)
//   node scripts/export-summaries.mjs --out "C:\tmp\out"
//
// שולף נתונים חיים מה-DB של כל בי"ס (service key מ-.env.<slug>.local),
// מחשב עם אותו מנוע בדיוק כמו האפליקציה (calculations.js + efficiency.js),
// וכותב מסמך RTL להדפסה: הכנסות/הוצאות/הצעות ייעול/מצב אחרי יישום +
// שורת מילוי "השתתפות רשת חינוך חב"ד" + מקום לחתימות מנהלת ושליח.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  calculateSchoolTotals, calculateSimpleTotals, categoryTotals, annualAmount, formatCurrency, formatCurrencyFull,
} from '../src/lib/calculations.js';
import {
  findMerges, closeClassReport, thresholdReport, eventsCapReport,
  dualAgeMergeReport, jointShabbatReport, caharonReport, parentContributionReport, transportParentsReport,
  partaniyotReport, principalTeachingReport, tuitionReport, tuitionSupplementReport,
  hoursCutReport, topExpensesReport,
  DEFAULT_PARENT_CONTRIBUTION, DUAL_AGE_EXTRA_MONTHLY_HOURS,
  normalizeSuggestionKey,
} from '../src/lib/efficiency.js';
import { withKind } from '../src/lib/categoryKinds.js';
import { DEFAULT_CONSTANTS, SUMMARY_DISCLAIMER } from '../src/data/constants.js';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx !== -1
  ? args[outIdx + 1]
  : 'C:\\Users\\PC\\OneDrive\\Desktop\\סיכומי תקציב והצעות ייעול';
const slugs = args.filter((a, i) => a !== '--out' && i !== outIdx + 1);
const targets = slugs.length ? config.schools.filter(s => slugs.includes(s.slug)) : config.schools;

fs.mkdirSync(outDir, { recursive: true });

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

function mapConstants(row) {
  if (!row) return DEFAULT_CONSTANTS;
  return {
    schoolWeeks: row.school_weeks,
    fullClassStudentThreshold: row.full_class_student_threshold,
    halfClassStudentThreshold: row.half_class_student_threshold,
    fullClassMinistryHours: row.full_class_ministry_hours,
    halfClassMinistryHours: row.half_class_ministry_hours,
    ministryHourlyRate: Number(row.ministry_hourly_rate),
    actualWeeklyHours: row.actual_weekly_hours,
    actualHourlyRate: Number(row.actual_hourly_rate),
    ofekSalary: row.ofek_salary ?? null,
    incomePerStudent: Number(row.income_per_student),
    incomePerStudentTalan: Number(row.income_per_student_talan ?? 885),
    expensePerStudent: Number(row.expense_per_student),
    professionalDevPerClass: Number(row.professional_dev_per_class),
    principalMonthlySalary: Number(row.principal_monthly_salary),
    incomePerStudentCaharon: Number(row.income_per_student_caharon ?? 0),
    expensePerStudentCaharon: Number(row.expense_per_student_caharon ?? 0),
    ministryGrantPerStudent: Number(row.ministry_grant_per_student ?? 360),
  };
}

// אותה לוגיקת הצעות בדיוק כמו SummaryPage — כדי שהמסמך יתאים למסך
function buildSuggestions(classes, expenses, categories, constants) {
  const rows = [];
  const merges = findMerges(classes, constants);
  const mergedIds = new Set(merges.flatMap(m => m.members.map(x => x.id)));
  for (const m of merges) {
    rows.push({ key: `merge:${m.merged.id}`, label: `צירוף כיתות: ${m.members.map(x => x.name).join(' + ')} (${m.merged.studentCount} תל׳)`, saving: m.delta });
  }
  const dualMerges = dualAgeMergeReport(classes, constants, mergedIds);
  const dualMergedIds = new Set(dualMerges.flatMap(m => m.members.map(x => x.id)));
  for (const m of dualMerges) {
    rows.push({ key: `dual:${m.merged.id}`, label: `${m.createsStandard ? 'יצירת תקן — חיבור' : 'חיבור כיתות:'} ${m.members.map(x => x.name).join(' + ')} (${m.merged.studentCount} תל׳, כולל תוספת ${DUAL_AGE_EXTRA_MONTHLY_HOURS} שעות שבועיות)`, saving: m.delta });
  }
  const allMergedIds = new Set([...mergedIds, ...dualMergedIds]);
  for (const r of closeClassReport(classes, constants, allMergedIds)) {
    rows.push({ key: `close:${r.cls.id}`, label: `סגירת כיתה ${r.cls.name} — הכיתה הגבוהה, ${r.cls.studentCount} תל׳ בלבד`, saving: r.saving });
  }
  const hoursR = hoursCutReport(classes, constants, 1);
  if (hoursR.maxCut > 0 && hoursR.perHourAllClasses > 0) rows.push({ key: 'hours-cut', label: `הורדת שעת הוראה אחת מכל כיתה (${hoursR.classCount} כיתות)`, saving: hoursR.perHourAllClasses });
  const topR = topExpensesReport(expenses, categories);
  if (topR.total > 0) rows.push({ key: 'trim', label: `קיצוץ 10% ב-${topR.rows.length} ההוצאות הגדולות`, saving: Math.round(topR.total * 0.1) });
  const shabbat = jointShabbatReport(classes, constants);
  if (shabbat.saving > 0) rows.push({ key: 'shabbat', label: `קבלת שבת משותפת לכל הכיתות (שעה שבועית × ${shabbat.classCount} כיתות)`, saving: shabbat.saving });
  const transport = transportParentsReport(expenses);
  if (transport.total > 0) rows.push({ key: 'transport-parents', label: 'הסעות בגביית הורים — הסרת העלות מהתקציב', saving: transport.total });
  const caharon = caharonReport(classes, constants);
  if (caharon.gap > 0) rows.push({ key: 'caharon', label: `התאמת מחיר הצהרון לעלות (${formatCurrency(caharon.perStudentGap)} לתלמיד)`, saving: caharon.gap });
  const tuition = tuitionReport(classes);
  if (tuition.gain > 0) rows.push({ key: 'tuition', label: `שכר לימוד עם גבייה ריאלית (${formatCurrency(tuition.amountPerStudent)} × ${tuition.collectionRatePct}% × ${tuition.totalStudents} תלמידים)`, saving: tuition.gain });
  const supplement = tuitionSupplementReport(classes);
  if (supplement.gain > 0) rows.push({ key: 'tuition-supplement', label: `תוספת שכר לימוד (${formatCurrency(supplement.amountPerStudent)} × ${supplement.collectionRatePct}% × ${supplement.totalStudents} תלמידים)`, saving: supplement.gain });
  const parents = parentContributionReport(classes);
  if (parents.gain > 0) rows.push({ key: 'parents', label: `השתתפות הורים שנתית (${formatCurrency(DEFAULT_PARENT_CONTRIBUTION)} לתלמיד × ${parents.totalStudents})`, saving: parents.gain });
  const partaniyot = partaniyotReport(classes, constants);
  if (partaniyot.saving > 0) rows.push({ key: 'partaniyot', label: `שעות פרטניות מהמשרה כשעה פרונטלית (${partaniyot.hoursPerClass} ש׳ × ${partaniyot.classCount} כיתות)`, saving: partaniyot.saving });
  const principal = principalTeachingReport(classes, constants);
  if (principal.saving > 0) rows.push({ key: 'principal-teaching', label: `שעות הוראה של המנהלת (${principal.weeklyHours} ש׳ שבועיות)`, saving: principal.saving });
  const events = eventsCapReport(expenses, categories, classes);
  if (events.excess > 0) rows.push({ key: 'events-cap', label: 'החזרת הוצאות אירועים לתקרת הרשת', saving: events.excess });
  const th = thresholdReport(classes, constants, 4, allMergedIds);
  for (const r of th.rows) {
    rows.push({ key: `threshold:${r.cls.id}`, label: `${r.cls.name}: עוד ${r.gap} תלמידים ל${r.nextType === 'full' ? 'תקן מלא' : 'חצי תקן'}`, saving: r.gain });
  }
  return rows.sort((a, b) => b.saving - a.saving);
}

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// תיבת חתימה: חתימה דיגיטלית שמורה מהמערכת אם קיימת, אחרת קו לחתימת יד
function sigBlock(title, sig) {
  if (sig?.image && /^data:image\//.test(sig.image)) {
    const when = sig.signedAt ? new Date(sig.signedAt).toLocaleDateString('he-IL') : '';
    return `<div class="sig"><p class="slabel" style="margin-bottom:6px">${esc(title)}</p>
      <img src="${sig.image}" alt="${esc(title)}" style="height:52px; object-fit:contain; display:block; margin-bottom:4px;" />
      <div class="sline"><span>✓ ${esc(sig.name || '')}</span><span>${esc(when)}</span></div></div>`;
  }
  return `<div class="sig"><p class="slabel">${esc(title)}</p><div class="sline"><span>שם + חתימה</span><span>תאריך</span></div></div>`;
}

function renderHtml({ school, yearLabel, classes, totals, incomeSources, catRows, constants, suggestions, isSimpleMode, notes, principalAnnual, signatures }) {
  const suggestionsTotal = suggestions.reduce((s, r) => s + r.saving, 0);
  const projected = totals.balance + suggestionsTotal;
  const today = new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  const row = (label, value, cls = '') => `<div class="row ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>סיכום תקציב — ${esc(school.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1A0B35; background: #fff; padding: 34px 42px; font-size: 13px; }
  .bh { text-align: left; color: #6b6b6b; font-size: 12px; }
  .bh b { float: right; font-weight: 600; }
  h1 { text-align: center; font-size: 24px; margin: 6px 0 2px; }
  .sub { text-align: center; color: #4A3F6B; font-weight: 600; margin-bottom: 2px; }
  .meta { text-align: center; color: #8878AA; font-size: 11.5px; margin-bottom: 14px; }
  .kpis { display: flex; gap: 10px; margin-bottom: 16px; }
  .kpi { flex: 1; border: 1px solid #E2DCF0; border-radius: 12px; padding: 9px; text-align: center; }
  .kpi p { color: #6b6b6b; font-size: 11px; margin-bottom: 3px; }
  .kpi b { font-size: 17px; }
  .green { color: #16a34a; } .red { color: #dc2626; } .teal { color: #0d9488; } .purple { color: #4B2E83; }
  h2 { font-size: 13.5px; border-bottom: 2px solid #D0C5F0; padding-bottom: 4px; margin: 14px 0 6px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 3.5px 0; color: #444; break-inside: avoid; }
  .row.total { border-top: 1px solid #ccc; margin-top: 4px; padding-top: 6px; font-weight: 800; color: #1A0B35; }
  .box { border: 1px solid #B8EAF2; background: #F0FBFD; border-radius: 10px; padding: 9px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 9px; font-weight: 800; break-inside: avoid; }
  .box.deficit { border-color: #fecaca; background: #FEF2F2; }
  .box .amount { font-size: 16px; }
  .fill { border: 1px solid #D0C5F0; background: #F7F4FC; border-radius: 10px; padding: 9px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 7px; font-weight: 700; break-inside: avoid; }
  .fill span.line { color: #777; letter-spacing: 2px; font-weight: 400; }
  .sigs { display: flex; gap: 26px; margin-top: 26px; break-inside: avoid; }
  .sig { flex: 1; }
  .sig .slabel { font-weight: 700; margin-bottom: 34px; }
  .sig .sline { border-top: 1px solid #555; padding-top: 4px; color: #777; font-size: 11px; display: flex; justify-content: space-between; }
  .note { color: #8878AA; font-size: 10.5px; margin-top: 18px; }
  footer { margin-top: 22px; color: #A99FC6; font-size: 10px; text-align: center; }
  @page { size: A4; margin: 12mm; }
</style></head><body>
  <div class="bh"><b>ב"ה</b>${esc(today)}</div>
  <h1>סיכום תקציב שנתי והצעות ייעול</h1>
  <p class="sub">${esc(school.name)} · ${esc(yearLabel)}</p>
  <p class="meta">${isSimpleMode ? '' : `${classes.length} כיתות · ${totals.totalStudents} תלמידים`}</p>
  <p style="color:#666; font-size:10.5px; line-height:1.5; background:#F7F7FA; border:1px solid #EDEDF2; border-radius:8px; padding:6px 10px; margin-bottom:12px;">${esc(SUMMARY_DISCLAIMER)}</p>

  <div class="kpis">
    <div class="kpi"><p>סה"כ הכנסות</p><b class="green">${formatCurrency(totals.totalIncome)}</b></div>
    <div class="kpi"><p>סה"כ הוצאות</p><b class="red">${formatCurrency(totals.totalExpenses)}</b></div>
    <div class="kpi"><p>${totals.isDeficit ? 'גירעון' : 'עודף'}</p><b class="${totals.isDeficit ? 'red' : 'teal'}">${formatCurrencyFull(totals.balance)}</b></div>
  </div>

  <h2>הכנסות — ממה זה מורכב</h2>
  ${isSimpleMode ? '' : `
  ${row('שעות תקן — משרד החינוך', formatCurrency(totals.totalMinistryIncome))}
  ${row(`תוספת כללית לתלמיד — משרד החינוך (${totals.totalStudents} × ${formatCurrency(constants.ministryGrantPerStudent)})`, formatCurrency(totals.totalMinistryGrantIncome))}
  ${row(`שכר לימוד — הכנסה לתלמיד (${totals.totalStudents} × ${formatCurrency(constants.incomePerStudent)} × 80% גבייה)`, formatCurrency(totals.totalStudentIncome))}
  ${row(`תל"ן — תשלומי הורים (${totals.totalStudents} × ${formatCurrency(constants.incomePerStudentTalan)} × 80% גבייה)`, formatCurrency(totals.totalTalanIncome))}`}
  ${incomeSources.map(s => row(s.name, formatCurrency(s.amount))).join('')}
  ${row('סה"כ הכנסות', formatCurrency(totals.totalIncome), 'total')}

  <h2>הוצאות — על מה זה יוצא</h2>
  ${isSimpleMode ? '' : `
  ${row(`שעות הוראה — עלות הוראה (${classes.length} כיתות × ${constants.actualWeeklyHours} ש׳ בחודש × ${formatCurrency(constants.actualHourlyRate)})`, formatCurrency(totals.totalClassActualCost))}
  ${row(`ייעוץ (${classes.length} כיתות × 2 ש׳ בחודש)`, formatCurrency(totals.totalCounselingCost))}
  ${row(`תוספת חוגים לכיתה (${classes.length} כיתות × 2,000 ₪ × 10 ח׳)`, formatCurrency(totals.totalClubsExpense))}
  ${row(`הוצאה לתלמיד (${totals.totalStudents} × ${formatCurrency(constants.expensePerStudent)})`, formatCurrency(totals.totalStudentExpenses))}
  ${totals.totalProfDev > 0 ? row('פיתוח מקצועי', formatCurrency(totals.totalProfDev)) : ''}
  ${row('שכר מנהלת', formatCurrency(principalAnnual))}`}
  ${catRows.map(c => row(c.name, formatCurrency(c.value))).join('')}
  ${row('סה"כ הוצאות', formatCurrency(totals.totalExpenses), 'total')}

  ${suggestions.length > 0 ? `
  <h2>הצעות ייעול — נבחרו לאימוץ</h2>
  ${suggestions.map(s => row(s.label, `+${formatCurrency(s.saving)}`)).join('')}
  ${row('סה"כ הצעות נבחרות', `+${formatCurrency(suggestionsTotal)}`, 'total')}
  <div class="box ${projected < 0 ? 'deficit' : ''}">
    <span>מצב תקציב לאחר יישום ההצעות</span>
    <span class="amount ${projected < 0 ? 'red' : 'teal'}">${formatCurrencyFull(projected)}</span>
  </div>` : ''}

  ${!isSimpleMode ? `
  <h2>הערות</h2>
  <p style="color:#444; white-space:pre-wrap; line-height:1.5;">${notes ? esc(notes) : '<span style="color:#bbb">אין הערות</span>'}</p>` : ''}

  <div class="sigs">
    ${sigBlock('חתימת המנהלת', signatures?.principal)}
    ${sigBlock('חתימת השליח', signatures?.courier)}
  </div>

  <p class="note">אנו מאשרים שעברנו על סיכום התקציב לשנת ${esc(yearLabel)} כפי שמופיע בדף זה. כל הצעה מחושבת בנפרד לפי מודל התקציב; יישום של כמה הצעות יחד עשוי לחפוף חלקית.</p>
  <footer>הופק ממערכת ניהול תקציב בית חינוך · רשת חינוך חב"ד · בנוי ופיתוח: שרה הגר · 0503339770</footer>
</body></html>`;
}

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function exportSchool(school) {
  const env = {
    ...loadEnvFile(path.join(root, `.env.${school.slug}`)),
    ...loadEnvFile(path.join(root, `.env.${school.slug}.local`)),
  };
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.VITE_SUPABASE_URL || !key) { console.log(`⏭  ${school.slug} — חסר env/service key, מדלגת`); return null; }
  const supabase = createClient(env.VITE_SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: schoolRow } = await supabase.from('schools').select('*').limit(1).single();
  const { data: years } = await supabase.from('budget_years').select('*').order('year', { ascending: false });
  const year = (years ?? []).find(y => y.is_active) || (years ?? [])[0];
  if (!year) { console.log(`⏭  ${school.slug} — אין שנת תקציב`); return null; }

  const [classesRes, incomeRes, expensesRes, catsRes, constRes] = await Promise.all([
    supabase.from('classes').select('*').eq('budget_year_id', year.id),
    supabase.from('income_sources').select('*').eq('budget_year_id', year.id),
    supabase.from('expenses').select('*').eq('budget_year_id', year.id),
    supabase.from('expense_categories').select('*').order('sort_order'),
    supabase.from('financial_constants').select('*').eq('budget_year_id', year.id).maybeSingle(),
  ]);

  const classes = (classesRes.data ?? []).map(c => ({
    id: c.id, name: c.name, gradeLevel: c.grade_level,
    studentCount: c.student_count, extraHours: Number(c.extra_hours ?? 0),
  }));
  const incomeSources = (incomeRes.data ?? []).map(s => ({ id: s.id, name: s.name, amount: Number(s.amount) }));
  const expenses = (expensesRes.data ?? []).map(e => ({
    id: e.id, categoryId: e.category_id, name: e.name, amount: Number(e.amount), period: e.period,
  }));
  const categories = (catsRes.data ?? []).map(c => withKind({ id: c.id, name: c.name, kind: c.kind }));
  const constants = mapConstants(constRes.data);
  const isSimpleMode = schoolRow?.mode === 'simple';

  // "ללא תקציב": בלי מודל כיתות/תקן ובלי הצעות ייעול — כמו ב-SummaryPage
  const totals = isSimpleMode
    ? calculateSimpleTotals(incomeSources, expenses)
    : calculateSchoolTotals(classes, incomeSources, expenses, constants, categories);
  // שכר מנהלת מוצג בשמו — מופרד מהקטגוריה שהוא רשום בה (כמו במסך)
  const principalLine = expenses.find(e => e.name === 'שכר מנהלת');
  const principalAnnual = principalLine ? annualAmount(principalLine) : 0;
  const catRows = categoryTotals(expenses, categories)
    .filter(c => c.kind !== 'profdev')
    .map(c => (principalLine && c.id === principalLine.categoryId ? { ...c, value: c.value - principalAnnual } : c))
    .filter(c => c.value > 0);
  const allSuggestions = isSimpleMode ? [] : buildSuggestions(classes, expenses, categories, constants);

  // בחירת ההצעות + ההערות + סכום הרשת שנשמרו במסך "סיכום ואישור" —
  // אם עוד לא נשמרה בחירה, ברירת המחדל היא הכל (תואם את התנהגות המסך)
  const { data: approval } = await supabase.from('budget_approvals')
    .select('selected_suggestion_keys, notes, principal_name, principal_signature, principal_signed_at, courier_name, courier_signature, courier_signed_at')
    .eq('school_id', schoolRow.id).eq('budget_year_id', year.id).maybeSingle();
  const selectedKeys = approval?.selected_suggestion_keys ? new Set(approval.selected_suggestion_keys.map(normalizeSuggestionKey)) : null;
  const suggestions = selectedKeys == null ? allSuggestions : allSuggestions.filter(s => selectedKeys.has(s.key));
  const notes = approval?.notes ?? '';
  // חתימות דיגיטליות שנשמרו במסך — מוטמעות במסמך; בלעדיהן נשאר קו לחתימת יד
  const signatures = {
    principal: { image: approval?.principal_signature, name: approval?.principal_name, signedAt: approval?.principal_signed_at },
    courier: { image: approval?.courier_signature, name: approval?.courier_name, signedAt: approval?.courier_signed_at },
  };

  const html = renderHtml({
    school: { name: schoolRow?.name || school.name },
    yearLabel: year.label, classes, totals, incomeSources, catRows, constants, suggestions, isSimpleMode, notes, principalAnnual, signatures,
  });

  const base = path.join(outDir, `סיכום תקציב - ${schoolRow?.name || school.name}`);
  fs.writeFileSync(`${base}.html`, html, 'utf8');
  try {
    execFileSync(EDGE, [
      '--headless', '--disable-gpu', '--no-pdf-header-footer',
      `--print-to-pdf=${base}.pdf`, `file:///${`${base}.html`.replace(/\\/g, '/')}`,
    ], { timeout: 60000 });
  } catch {
    console.log(`   (PDF נכשל ל-${school.slug} — קובץ ה-HTML זמין ומודפס יפה מהדפדפן)`);
  }
  console.log(`✓ ${schoolRow?.name || school.name} — ${classes.length} כיתות, ${suggestions.length} הצעות`);
  return true;
}

let done = 0;
for (const school of targets) {
  try {
    if (await exportSchool(school)) done++;
  } catch (e) {
    console.log(`✗ ${school.slug} — ${e.message}`);
  }
}
console.log(`\n${done}/${targets.length} מסמכים נכתבו אל: ${outDir}`);
