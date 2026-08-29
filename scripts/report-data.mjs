// המרת שורות המסד למצב שהמסמך עובד איתו. מקור אחד לשני הצרכנים:
// build-school-report.mjs (Node, קורא ישירות מהמסד) ומבט רשת (דפדפן, מקבל
// את אותן שורות מהפונקציה network-budget). כך אין שתי המרות שיכולות להיפרד.
import { DEFAULT_CONSTANTS } from '../src/data/constants.js';
import { withKind } from '../src/lib/categoryKinds.js';

// אותה המרה כמו mapConstantsFromDB ב-AppContext. VITE_DISABLE_CLUBS אינו
// נגיש כאן (אין import.meta.env ב-Node ובפורטל), ולכן מגיע כפרמטר.
export function mapConstants(row, disableClubs) {
  if (!row) return { ...DEFAULT_CONSTANTS };
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
      : (disableClubs ? 0 : DEFAULT_CONSTANTS.clubsMonthlyExpensePerClass),
  };
}

// raw: { classes, income, expenses, categories, constants } — שורות המסד כמות שהן
export function docStateFromRows(raw, disableClubs) {
  return {
    classes: (raw.classes || []).map(c => ({
      id: c.id, name: c.name, gradeLevel: c.grade_level,
      studentCount: Number(c.student_count || 0), extraHours: Number(c.extra_hours || 0),
    })).sort((a, b) => a.name.localeCompare(b.name, 'he')),
    incomeSources: (raw.income || []).map(s => ({ id: s.id, name: s.name, amount: Number(s.amount || 0) })),
    expenses: (raw.expenses || []).map(e => ({
      id: e.id, name: e.name, amount: Number(e.amount || 0), period: e.period, categoryId: e.category_id,
    })),
    constants: mapConstants(raw.constants, disableClubs),
  };
}

export const docCategories = (rows) => (rows || []).map(withKind);
