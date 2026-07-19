import { DEFAULT_CONSTANTS, HEBREW_MONTHS, WEEKS_PER_MONTH, PAYMENT_MONTHS } from '../data/constants.js';
import { kindMap } from './categoryKinds.js';

export function getClassType(studentCount, constants = DEFAULT_CONSTANTS) {
  if (studentCount >= constants.fullClassStudentThreshold) return 'full';
  if (studentCount >= constants.halfClassStudentThreshold) return 'half';
  return 'none';
}

export function calculateClassBudget(classItem, constants = DEFAULT_CONSTANTS) {
  const n = classItem.studentCount;
  const {
    fullClassMinistryHours,
    halfClassMinistryHours,
    ministryHourlyRate,
    actualWeeklyHours,
    actualHourlyRate,
    incomePerStudent,
    expensePerStudent,
    professionalDevPerClass,
    incomePerStudentCaharon = 0,
    expensePerStudentCaharon = 0,
    ministryGrantPerStudent = 0,
  } = constants;

  const type = getClassType(n, constants);

  let ministryWeeklyHours = 0;
  if (type === 'full') ministryWeeklyHours = fullClassMinistryHours;
  else if (type === 'half') ministryWeeklyHours = halfClassMinistryHours;

  // מודל חודשי: 22 שעות/שבוע × 4 = 88 שעות בחודש × תעריף × 12 חודשים
  const ministryMonthlyHours = ministryWeeklyHours * WEEKS_PER_MONTH;
  const ministryMonthlyIncome = ministryMonthlyHours * ministryHourlyRate;
  const ministryIncome = ministryMonthlyIncome * PAYMENT_MONTHS;
  const ministryGrantIncome = n * ministryGrantPerStudent;
  const studentIncome = n * incomePerStudent;
  const caharonIncome = n * incomePerStudentCaharon;
  const totalIncome = ministryIncome + ministryGrantIncome + studentIncome + caharonIncome;

  const actualMonthlyCost = actualWeeklyHours * WEEKS_PER_MONTH * actualHourlyRate;
  const actualOperatingCost = actualMonthlyCost * PAYMENT_MONTHS;
  const studentExpenses = n * expensePerStudent;
  const caharonExpense = n * expensePerStudentCaharon;
  const profDevExpense = professionalDevPerClass;
  const totalExpenses = actualOperatingCost + studentExpenses + caharonExpense + profDevExpense;

  const balance = totalIncome - totalExpenses;

  return {
    type,
    ministryWeeklyHours,
    ministryMonthlyHours,
    ministryMonthlyIncome,
    ministryIncome,
    actualMonthlyCost,
    ministryGrantIncome,
    studentIncome,
    caharonIncome,
    totalIncome,
    actualOperatingCost,
    studentExpenses,
    caharonExpense,
    profDevExpense,
    totalExpenses,
    balance,
    isDeficit: balance < 0,
  };
}

// Sum annual amounts of the expense line items whose category has the given kind
export function sumByKind(expenses, categories, kind) {
  const kinds = kindMap(categories);
  return expenses
    .filter(e => kinds[e.categoryId] === kind)
    .reduce((sum, e) => sum + annualAmount(e), 0);
}

export function calculateSchoolTotals(classes, incomeSources, expenses, constants = DEFAULT_CONSTANTS, categories = []) {
  const classBreakdowns = classes.map(c => ({
    ...c,
    budget: calculateClassBudget(c, constants),
  }));

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const totalMinistryIncome = classBreakdowns.reduce((sum, c) => sum + c.budget.ministryIncome, 0);
  const totalMinistryGrantIncome = classBreakdowns.reduce((sum, c) => sum + c.budget.ministryGrantIncome, 0);
  const totalStudentIncome = classBreakdowns.reduce((sum, c) => sum + c.budget.studentIncome, 0);
  const additionalIncome = incomeSources.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalIncome = totalMinistryIncome + totalMinistryGrantIncome + totalStudentIncome + additionalIncome;

  const totalClassActualCost = classBreakdowns.reduce((sum, c) => sum + c.budget.actualOperatingCost, 0);
  const totalStudentExpenses = classBreakdowns.reduce((sum, c) => sum + c.budget.studentExpenses, 0);
  const totalProfDev = classBreakdowns.reduce((sum, c) => sum + c.budget.profDevExpense, 0);

  // General (non-class) expense line items, grouped by semantic kind.
  // profdev line items are EXCLUDED from the total — professional development
  // is already computed per class (professionalDevPerClass × classes).
  const kinds = kindMap(categories);
  const sumKind = (kind) => expenses
    .filter(e => kinds[e.categoryId] === kind)
    .reduce((sum, e) => sum + annualAmount(e), 0);

  const salaryExpenses = sumKind('salary');
  const buildingExpenses = sumKind('building');
  const operationExpenses = sumKind('events');
  const summerExpenses = sumKind('equipment');
  const miscExpenses = sumKind('other');

  const otherExpenses = salaryExpenses + buildingExpenses + operationExpenses + summerExpenses + miscExpenses;
  const totalExpenses = totalClassActualCost + totalStudentExpenses + totalProfDev + otherExpenses;
  const balance = totalIncome - totalExpenses;
  const ministryGap = totalClassActualCost - totalMinistryIncome;

  return {
    classBreakdowns,
    totalStudents,
    totalMinistryIncome,
    totalMinistryGrantIncome,
    totalStudentIncome,
    additionalIncome,
    totalIncome,
    totalClassActualCost,
    totalStudentExpenses,
    totalProfDev,
    salaryExpenses,
    buildingExpenses,
    operationExpenses,
    summerExpenses,
    miscExpenses,
    otherExpenses,
    totalExpenses,
    balance,
    ministryGap,
    isDeficit: balance < 0,
  };
}

// "ללא תקציב" mode: plain totals — income sources vs. expense line items,
// no ministry/class budget model at all.
export function calculateSimpleTotals(incomeSources, expenses) {
  const totalIncome = incomeSources.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + annualAmount(e), 0);
  const balance = totalIncome - totalExpenses;
  return { totalIncome, totalExpenses, balance, isDeficit: balance < 0 };
}

export function annualAmount(expense) {
  if (!expense) return 0;
  return expense.period === 'monthly' ? expense.amount * 12 : expense.amount;
}

export function generateMonthlyData(totals) {
  // המודל החודשי: המשרד משלם כל 12 החודשים, לכן ההכנסות וההוצאות נפרסות שווה
  const monthlyIncome = Math.round(totals.totalIncome / PAYMENT_MONTHS);
  const monthlyExpenses = Math.round(totals.totalExpenses / PAYMENT_MONTHS);

  return HEBREW_MONTHS.map((month) => ({
    month,
    הכנסות: monthlyIncome,
    הוצאות: monthlyExpenses,
    יתרה: monthlyIncome - monthlyExpenses,
  }));
}

const WORD_COLORS = {
  purple: '#4B2E83', teal: '#00B4CC', coral: '#F07A20',
  gold: '#F5C518', blue: '#3B82F6', green: '#10B981',
};
const FALLBACK_COLORS = ['#00B4CC', '#4B2E83', '#F07A20', '#F5C518', '#10B981', '#6366F1', '#EC4899', '#64748B'];

export function categoryColor(cat, i = 0) {
  if (cat?.color?.startsWith('#')) return cat.color;
  return WORD_COLORS[cat?.color] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

// Pie data: computed class costs + real per-category line-item totals.
// profdev-kind categories are skipped (already computed per class).
export function generateCategoryData(expenses, classes, constants = DEFAULT_CONSTANTS, categories = []) {
  const totalClassActualCost = classes.reduce((sum, c) => sum + calculateClassBudget(c, constants).actualOperatingCost, 0);
  const totalStudentExpenses = classes.reduce((sum, c) => sum + calculateClassBudget(c, constants).studentExpenses, 0);
  const totalProfDev = classes.reduce((sum, c) => sum + calculateClassBudget(c, constants).profDevExpense, 0);

  const rows = [
    { name: 'עלות הוראה', value: totalClassActualCost, fill: '#00B4CC' },
    { name: 'הוצאות תלמידים', value: totalStudentExpenses, fill: '#4B2E83' },
    { name: 'פיתוח מקצועי', value: totalProfDev, fill: '#6366F1' },
    ...categoryTotals(expenses, categories).filter(c => c.kind !== 'profdev'),
  ];
  return rows.filter(r => r.value > 0);
}

// Per-category line-item totals with display color (both modes)
export function categoryTotals(expenses, categories = []) {
  return categories.map((cat, i) => ({
    id: cat.id,
    name: cat.name,
    kind: cat.kind,
    fill: categoryColor(cat, i),
    value: expenses
      .filter(e => e.categoryId === cat.id)
      .reduce((sum, e) => sum + annualAmount(e), 0),
  }));
}

export function formatCurrency(amount) {
  const abs = Math.abs(Math.round(amount));
  return `₪${abs.toLocaleString('he-IL')}`;
}

export function formatCurrencyFull(amount) {
  const rounded = Math.round(amount);
  if (rounded < 0) return `-₪${Math.abs(rounded).toLocaleString('he-IL')}`;
  return `₪${rounded.toLocaleString('he-IL')}`;
}

export function formatNumber(n) {
  return Math.round(n).toLocaleString('he-IL');
}
