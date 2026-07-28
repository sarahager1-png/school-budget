// ============================================================
// קובץ אקסל: מצב תקציב קיים מול מצב אחרי יישום הצעות הייעול, פר בי"ס.
//
//   node scripts/export-xlsx.mjs <slug> [<slug> ...]   (חובה לפחות אחד)
//   node scripts/export-xlsx.mjs --out "C:\tmp\out" jerusalem
//
// שולף נתונים חיים מה-DB (service key מ-.env.<slug>.local), מחשב עם אותו
// מנוע בדיוק כמו האפליקציה (calculations.js + efficiency.js buildSuggestionRows,
// כולל כוונון ההצעות השמור ושכבות "סגירת כיתה" הנוספות של בית הספר).
// ============================================================
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { calculateSchoolTotals, calculateSimpleTotals, categoryTotals, formatCurrency } from '../src/lib/calculations.js';
import { buildSuggestionRows, sumSavings, normalizeSuggestionKey } from '../src/lib/efficiency.js';
import { withKind } from '../src/lib/categoryKinds.js';
import { DEFAULT_CONSTANTS } from '../src/data/constants.js';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx !== -1 ? args[outIdx + 1] : 'C:\\Users\\PC\\OneDrive\\Desktop\\תקציבים - קיים מול אחרי ייעול';
const slugs = args.filter((a, i) => a !== '--out' && (outIdx === -1 || i !== outIdx + 1));
const targets = slugs.length ? config.schools.filter(s => slugs.includes(s.slug)) : [];
if (targets.length === 0) {
  console.error('שימוש: node scripts/export-xlsx.mjs <slug> [<slug> ...]');
  console.error('בתי ספר זמינים:', config.schools.map(s => s.slug).join(', '));
  process.exit(1);
}

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

function mapConstants(row, env = {}) {
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
    counselingHoursPerClass: Number(row.counseling_hours_per_class ?? DEFAULT_CONSTANTS.counselingHoursPerClass),
    clubsMonthlyExpensePerClass: row.clubs_monthly_expense_per_class != null
      ? Number(row.clubs_monthly_expense_per_class)
      : (env.VITE_DISABLE_CLUBS === '1' ? 0 : DEFAULT_CONSTANTS.clubsMonthlyExpensePerClass),
    closeClassExtraGrades: row.close_class_extra_grades
      ? row.close_class_extra_grades.split(',').map(s => s.trim()).filter(Boolean)
      : [],
  };
}

async function exportSchool(school) {
  const env = { ...loadEnvFile(path.join(root, `.env.${school.slug}`)), ...loadEnvFile(path.join(root, `.env.${school.slug}.local`)) };
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.VITE_SUPABASE_URL || !key) { console.log(`⏭  ${school.slug} — חסר env/service key, מדלגת`); return false; }
  const supabase = createClient(env.VITE_SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: schoolRow } = await supabase.from('schools').select('*').limit(1).single();
  const { data: years } = await supabase.from('budget_years').select('*').order('year', { ascending: false });
  const year = (years ?? []).find(y => y.is_active) || (years ?? [])[0];
  if (!year) { console.log(`⏭  ${school.slug} — אין שנת תקציב`); return false; }

  const [classesRes, incomeRes, expensesRes, catsRes, constRes, approvalRes] = await Promise.all([
    supabase.from('classes').select('*').eq('budget_year_id', year.id),
    supabase.from('income_sources').select('*').eq('budget_year_id', year.id),
    supabase.from('expenses').select('*').eq('budget_year_id', year.id),
    supabase.from('expense_categories').select('*').order('sort_order'),
    supabase.from('financial_constants').select('*').eq('budget_year_id', year.id).maybeSingle(),
    supabase.from('budget_approvals').select('selected_suggestion_keys, summary').eq('budget_year_id', year.id).maybeSingle(),
  ]);

  const classes = (classesRes.data ?? []).map(c => ({
    id: c.id, name: c.name, gradeLevel: c.grade_level, studentCount: c.student_count, extraHours: Number(c.extra_hours ?? 0),
  }));
  const incomeSources = (incomeRes.data ?? []).map(s => ({ id: s.id, name: s.name, amount: Number(s.amount) }));
  const expenses = (expensesRes.data ?? []).map(e => ({
    id: e.id, categoryId: e.category_id, name: e.name, amount: Number(e.amount), period: e.period,
  }));
  const categories = (catsRes.data ?? []).map(c => withKind({ id: c.id, name: c.name, kind: c.kind }));
  const constants = mapConstants(constRes.data, env);
  const isSimpleMode = schoolRow?.mode === 'simple';

  const totals = isSimpleMode
    ? calculateSimpleTotals(incomeSources, expenses)
    : calculateSchoolTotals(classes, incomeSources, expenses, constants, categories);

  const draftParams = approvalRes.data?.summary?.draftParams ?? {};
  const allRows = isSimpleMode ? [] : buildSuggestionRows(classes, expenses, categories, constants, draftParams);
  const savedKeys = approvalRes.data?.selected_suggestion_keys;
  const selectedKeys = Array.isArray(savedKeys) ? new Set(savedKeys.map(normalizeSuggestionKey)) : null;
  const chosen = selectedKeys == null ? allRows : allRows.filter(r => selectedKeys.has(normalizeSuggestionKey(r.key)));
  const suggestionsTotal = sumSavings(chosen);
  const projectedBalance = totals.balance + suggestionsTotal;

  const catRows = categoryTotals(expenses, categories).filter(c => c.kind !== 'profdev' && c.value > 0);

  // ── גיליון 1: סיכום — מצב קיים מול מצב אחרי ייעול ──
  const summaryRows = [
    { 'שורה': 'הכנסות', 'מצב קיים': totals.totalIncome, 'אחרי ייעול': totals.totalIncome },
    { 'שורה': 'הוצאות', 'מצב קיים': totals.totalExpenses, 'אחרי ייעול': totals.totalExpenses - suggestionsTotal },
    { 'שורה': 'מאזן', 'מצב קיים': totals.balance, 'אחרי ייעול': projectedBalance },
    { 'שורה': 'סה"כ חיסכון מהצעות שנבחרו', 'מצב קיים': '', 'אחרי ייעול': suggestionsTotal },
  ];

  // ── גיליון 2: פירוט הכנסות ──
  const incomeRows = incomeSources.map(s => ({ 'מקור': s.name, 'סכום שנתי': s.amount }));

  // ── גיליון 3: פירוט הוצאות לפי קטגוריה ──
  const expenseRows = catRows.map(c => ({ 'קטגוריה': c.name, 'סכום שנתי': c.value }));

  // ── גיליון 4: כל הצעות הייעול — מסומן אילו נבחרו ──
  const suggestionRows = allRows
    .slice()
    .sort((a, b) => b.saving - a.saving)
    .map(r => ({
      'הצעה': r.label,
      'חיסכון שנתי': r.saving,
      'נבחרה': selectedKeys == null ? 'כן (ברירת מחדל — עדיין לא נבחרה בחירה)' : (selectedKeys.has(normalizeSuggestionKey(r.key)) ? 'כן' : 'לא'),
    }));

  const wb = XLSX.utils.book_new();
  const addSheet = (rows, name, widths) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = widths;
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  addSheet(summaryRows, 'סיכום', [{ wch: 30 }, { wch: 16 }, { wch: 16 }]);
  addSheet(incomeRows, 'הכנסות', [{ wch: 28 }, { wch: 14 }]);
  addSheet(expenseRows, 'הוצאות', [{ wch: 28 }, { wch: 14 }]);
  addSheet(suggestionRows, 'הצעות ייעול', [{ wch: 60 }, { wch: 14 }, { wch: 30 }]);

  const filePath = path.join(outDir, `תקציב ${schoolRow?.name || school.name} - קיים מול אחרי ייעול.xlsx`);
  XLSX.writeFile(wb, filePath);
  console.log(`✓ ${schoolRow?.name || school.name} — ${filePath}`);
  console.log(`   מצב קיים: ${formatCurrency(totals.balance)} | אחרי ייעול (${chosen.length}/${allRows.length} הצעות נבחרו): ${formatCurrency(projectedBalance)}`);
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
console.log(`\n${done}/${targets.length} קבצים נכתבו אל: ${outDir}`);
