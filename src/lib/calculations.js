import { DEFAULT_CONSTANTS, HEBREW_MONTHS } from '../data/constants.js';

export function getClassType(studentCount, constants = DEFAULT_CONSTANTS) {
  if (studentCount >= constants.fullClassStudentThreshold) return 'full';
  if (studentCount >= constants.halfClassStudentThreshold) return 'half';
  return 'none';
}

export function calculateClassBudget(classItem, constants = DEFAULT_CONSTANTS) {
  const n = classItem.studentCount;
  const {
    schoolWeeks,
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

  const ministryIncome = ministryWeeklyHours * ministryHourlyRate * schoolWeeks;
  const ministryGrantIncome = n * ministryGrantPerStudent;
  const studentIncome = n * incomePerStudent;
  const caharonIncome = n * incomePerStudentCaharon;
  const totalIncome = ministryIncome + ministryGrantIncome + studentIncome + caharonIncome;

  const actualOperatingCost = actualWeeklyHours * actualHourlyRate * schoolWeeks;
  const studentExpenses = n * expensePerStudent;
  const caharonExpense = n * expensePerStudentCaharon;
  const profDevExpense = professionalDevPerClass;
  const totalExpenses = actualOperatingCost + studentExpenses + caharonExpense + profDevExpense;

  const balance = totalIncome - totalExpenses;

  return {
    type,
    ministryWeeklyHours,
    ministryIncome,
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

export function calculateSchoolTotals(classes, incomeSources, expenses, constants = DEFAULT_CONSTANTS) {
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

  // Calculate "other" expenses (non-class-based)
  const salaryExpenses = expenses
    .filter(e => e.categoryId === 'ec1')
    .reduce((sum, e) => sum + annualAmount(e), 0);
  const buildingExpenses = expenses
    .filter(e => e.categoryId === 'ec2')
    .reduce((sum, e) => sum + annualAmount(e), 0);
  const operationExpenses = expenses
    .filter(e => e.categoryId === 'ec3')
    .reduce((sum, e) => sum + annualAmount(e), 0);
  const summerExpenses = expenses
    .filter(e => e.categoryId === 'ec5')
    .reduce((sum, e) => sum + annualAmount(e), 0);

  const otherExpenses = salaryExpenses + buildingExpenses + operationExpenses + summerExpenses;
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
    otherExpenses,
    totalExpenses,
    balance,
    ministryGap,
    isDeficit: balance < 0,
  };
}

export function annualAmount(expense) {
  if (!expense) return 0;
  return expense.period === 'monthly' ? expense.amount * 12 : expense.amount;
}

export function generateMonthlyData(totals) {
  const SCHOOL_MONTHS = 10;
  const monthlyIncome = totals.totalIncome / SCHOOL_MONTHS;
  const monthlyExpenses = totals.totalExpenses / 12;

  return HEBREW_MONTHS.map((month, i) => {
    const income = i < 10 ? Math.round(monthlyIncome) : 0;
    const exp = Math.round(monthlyExpenses);
    return {
      month,
      הכנסות: income,
      הוצאות: exp,
      יתרה: income - exp,
    };
  });
}

export function generateCategoryData(expenses, classes, constants = DEFAULT_CONSTANTS) {
  const totalClassActualCost = classes.reduce((sum, c) => {
    const b = calculateClassBudget(c, constants);
    return sum + b.actualOperatingCost;
  }, 0);
  const totalStudentExpenses = classes.reduce((sum, c) => {
    const b = calculateClassBudget(c, constants);
    return sum + b.studentExpenses;
  }, 0);
  const totalProfDev = classes.reduce((sum, c) => {
    const b = calculateClassBudget(c, constants);
    return sum + b.profDevExpense;
  }, 0);

  const salaries = expenses.filter(e => e.categoryId === 'ec1').reduce((s, e) => s + annualAmount(e), 0);
  const building = expenses.filter(e => e.categoryId === 'ec2').reduce((s, e) => s + annualAmount(e), 0);
  const ops = expenses.filter(e => e.categoryId === 'ec3').reduce((s, e) => s + annualAmount(e), 0);

  return [
    { name: 'עלות הוראה', value: totalClassActualCost, fill: '#0FA3B1' },
    { name: 'הוצאות תלמידים', value: totalStudentExpenses, fill: '#7B2D8B' },
    { name: 'שכר', value: salaries, fill: '#F07A20' },
    { name: 'בניין', value: building, fill: '#F5C518' },
    { name: 'פעילויות', value: ops, fill: '#10B981' },
    { name: 'פיתוח מקצועי', value: totalProfDev, fill: '#6366F1' },
  ];
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
