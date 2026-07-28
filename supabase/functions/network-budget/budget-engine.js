// מנוע הייעול של מבט רשת — העתק נאמן של src/lib/efficiency.js (+ החלקים
// הדרושים מ-src/lib/calculations.js ומ-src/data/constants.js), כדי שה-Edge
// Function תחשב "מצב תקציב לאחר ייעול" בדיוק כמו המערכת של בית הספר.
//
// חשוב: המפתחות (key) חייבים להישאר זהים לאלה שבאפליקציה — לפיהם נשמרת
// הבחירה של המנהלת ב-budget_approvals.selected_suggestion_keys.
// כל שינוי בהיגיון החישוב במערכת חייב להיעשות גם כאן; scripts/verify-engine-parity.mjs
// מריץ את שני המנועים על אותם נתונים ומוודא שהתוצאה זהה.

export const PAYMENT_MONTHS = 12;
export const COUNSELING_HOURS_PER_CLASS = 2;
export const TUITION_COLLECTION_RATE = 0.8;
export const CLUBS_MONTHLY_EXPENSE_PER_CLASS = 2000;
export const CLUBS_MONTHS = 10;
export const EVENTS_CAP_PER_STUDENT = 1400;
export const MAX_MERGED_STUDENTS = 32;
export const DUAL_AGE_EXTRA_MONTHLY_HOURS = 12;
export const DEFAULT_SHABBAT_WEEKLY_HOURS = 1;
export const DEFAULT_PARENT_CONTRIBUTION = 100;
export const TEACHER_POSITION_HOURS = 21;
export const DEFAULT_PARTANIYOT_HOURS = 3;
export const DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS = 6;
export const DEFAULT_TUITION_AMOUNT = 3000;
export const DEFAULT_TUITION_COLLECTION_RATE = 80;
export const DEFAULT_TUITION_SUPPLEMENT = 3000;
export const SUPPLEMENT_COLLECTION_RATE = 80;

const nis = (amount) => '₪' + Math.abs(Math.round(amount)).toLocaleString('he-IL');

// ─── קטגוריות ─────────────────────────────────────────────────
const KIND_RULES = [
  ['salary', ['שכר']],
  ['profdev', ['פיתוח']],
  ['building', ['בניין', 'בנין', 'אחזק', 'תחזוק', 'תפעול']],
  ['equipment', ['קיץ', 'ציוד', 'ריהוט', 'תשתי']],
  ['events', ['אירוע', 'ארוע', 'חג', 'מסיב', 'פעיל']],
];

export function inferKind(name = '') {
  for (const [kind, words] of KIND_RULES) {
    if (words.some(w => name.includes(w))) return kind;
  }
  return 'other';
}

export function kindMap(categories = []) {
  return Object.fromEntries(categories.map(c => [c.id, c.kind || inferKind(c.name)]));
}

export function annualAmount(expense) {
  if (!expense) return 0;
  return expense.period === 'monthly' ? expense.amount * 12 : expense.amount;
}

// ─── תקציב כיתה ───────────────────────────────────────────────
export function getClassType(studentCount, constants) {
  if (studentCount >= constants.fullClassStudentThreshold) return 'full';
  if (studentCount >= constants.halfClassStudentThreshold) return 'half';
  return 'none';
}

export function calculateClassBudget(classItem, constants) {
  const n = classItem.studentCount;
  const {
    fullClassMinistryHours, halfClassMinistryHours, ministryHourlyRate,
    actualWeeklyHours, actualHourlyRate, incomePerStudent,
    incomePerStudentTalan = 0, expensePerStudent, professionalDevPerClass,
    incomePerStudentCaharon = 0, expensePerStudentCaharon = 0,
    ministryGrantPerStudent = 0,
  } = constants;

  const type = getClassType(n, constants);
  let ministryWeeklyHours = 0;
  if (type === 'full') ministryWeeklyHours = fullClassMinistryHours;
  else if (type === 'half') ministryWeeklyHours = halfClassMinistryHours;

  const ministryIncome = ministryWeeklyHours * ministryHourlyRate * PAYMENT_MONTHS;
  const ministryGrantIncome = n * ministryGrantPerStudent;
  const studentIncome = n * incomePerStudent * TUITION_COLLECTION_RATE;
  const talanIncome = n * incomePerStudentTalan * TUITION_COLLECTION_RATE;
  const caharonIncome = n * incomePerStudentCaharon;
  const totalIncome = ministryIncome + ministryGrantIncome + studentIncome + talanIncome + caharonIncome;

  const actualOperatingCost = actualWeeklyHours * actualHourlyRate * PAYMENT_MONTHS;
  const counselingHours = Number(constants.counselingHoursPerClass ?? COUNSELING_HOURS_PER_CLASS);
  const counselingCost = counselingHours * actualHourlyRate * PAYMENT_MONTHS;
  const clubsExpense = Number(constants.clubsMonthlyExpensePerClass ?? CLUBS_MONTHLY_EXPENSE_PER_CLASS) * CLUBS_MONTHS;
  const studentExpenses = n * expensePerStudent;
  const caharonExpense = n * expensePerStudentCaharon;
  const totalExpenses = actualOperatingCost + counselingCost + clubsExpense + studentExpenses + caharonExpense + professionalDevPerClass;

  const balance = totalIncome - totalExpenses;
  return { type, ministryIncome, totalIncome, totalExpenses, balance, isDeficit: balance < 0 };
}

// ─── צירוף כיתות ──────────────────────────────────────────────
export function mergedClass(members) {
  return {
    id: members.map(m => m.id).sort().join('+'),
    name: members.map(m => m.name).join(' + '),
    studentCount: members.reduce((s, m) => s + m.studentCount, 0),
    extraHours: members.reduce((s, m) => s + Number(m.extraHours || 0), 0),
  };
}

export function normalizeSuggestionKey(key) {
  const m = /^(merge|dual):(.+)$/.exec(key || '');
  if (!m) return key;
  return `${m[1]}:${m[2].split('+').sort().join('+')}`;
}

export function mergeDelta(members, constants) {
  const budgetsBefore = members.map(m => calculateClassBudget(m, constants));
  const merged = mergedClass(members);
  const budgetAfter = calculateClassBudget(merged, constants);
  const before = budgetsBefore.reduce((s, b) => s + b.balance, 0);
  return { merged, delta: budgetAfter.balance - before };
}

export function findMerges(classes, constants, maxStudents = MAX_MERGED_STUDENTS) {
  const groups = new Map();
  for (const c of classes) {
    const idx = classGradeIndex(c);
    const raw = (c.gradeLevel ?? '').toString().trim();
    if (idx == null && !raw) continue;
    const key = idx != null ? `n${idx}` : `r:${raw}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const candidates = [];
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const grade = list[0].gradeLevel;
    const subsets = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        subsets.push([list[i], list[j]]);
        for (let k = j + 1; k < list.length; k++) subsets.push([list[i], list[j], list[k]]);
      }
    }
    for (const members of subsets) {
      const students = members.reduce((s, m) => s + m.studentCount, 0);
      if (students > maxStudents) continue;
      const result = mergeDelta(members, constants);
      if (result.delta >= 1000) candidates.push({ grade, members, ...result });
    }
  }

  candidates.sort((a, b) => b.delta - a.delta);
  const used = new Set();
  const picked = [];
  for (const cand of candidates) {
    if (cand.members.some(m => used.has(m.id))) continue;
    cand.members.forEach(m => used.add(m.id));
    picked.push(cand);
  }
  return picked;
}

// ─── חיבור דו-גילאי ───────────────────────────────────────────
const GRADE_ORDER = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];
const SCHOOL_DIVISIONS = [
  ['א', 'ב', 'ג', 'ד', 'ה', 'ו'],
  ['ז', 'ח', 'ט'],
  ['י', 'יא', 'יב'],
];

function divisionOf(idx) {
  const grade = GRADE_ORDER[idx];
  return SCHOOL_DIVISIONS.findIndex(d => d.includes(grade));
}

export function classGradeIndex(c) {
  return normalizeGrade(c.gradeLevel) ?? normalizeGrade(c.name);
}

export function normalizeGrade(raw) {
  if (!raw) return null;
  const s = raw.toString().trim().replace(/^כיתה\s*/, '').replace(/["'׳״]/g, '').replace(/\s+/g, '');
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n >= 1 && n <= GRADE_ORDER.length ? n - 1 : null;
  }
  const byLength = [...GRADE_ORDER].sort((a, b) => b.length - a.length);
  for (const token of byLength) {
    if (s.startsWith(token)) return GRADE_ORDER.indexOf(token);
  }
  return null;
}

// extraMonthlyHours — ההקצאה הרשתית (12) היא ברירת המחדל; מסך הייעול במערכת
// מאפשר להעלות אותה. מבט רשת מציג תמיד את ברירת המחדל.
export function dualAgeMergeReport(classes, constants, excludeIds = new Set(), extraMonthlyHours = DUAL_AGE_EXTRA_MONTHLY_HOURS) {
  const byGrade = new Map();
  for (const c of classes) {
    if (excludeIds.has(c.id)) continue;
    const idx = classGradeIndex(c);
    if (idx == null) continue;
    if (!byGrade.has(idx)) byGrade.set(idx, []);
    byGrade.get(idx).push(c);
  }
  const singles = new Map();
  for (const [idx, list] of byGrade) {
    if (list.length === 1) singles.set(idx, list[0]);
  }

  const candidates = [];
  for (const idx of [...singles.keys()].sort((a, b) => a - b)) {
    const partner = singles.get(idx + 1);
    if (!partner) continue;
    const div = divisionOf(idx);
    if (div !== 0 || divisionOf(idx + 1) !== div) continue;
    const a = singles.get(idx);
    const typeA = getClassType(a.studentCount, constants);
    const typeB = getClassType(partner.studentCount, constants);
    if (idx === 0 && typeA !== 'none') continue;
    const merged = mergedClass([a, partner]);
    // אותה תקרה כמו בצירוף בתוך שכבה — כיתה דו-גילאית מעל MAX_MERGED_STUDENTS
    // אינה ריאלית, וזוג חורג גם דחק הצעות סבירות בבחירת הזוגות שלמטה
    if (merged.studentCount > MAX_MERGED_STUDENTS) continue;
    const createsStandard = (typeA === 'none' || typeB === 'none')
      && getClassType(merged.studentCount, constants) !== 'none';
    // השעות הבודדות שהוזנו בכיתות אינן נספרות בחיבור — רק הקצאת החיבור
    const enteredHours = Number(merged.extraHours || 0);
    const totalExtraHours = extraMonthlyHours;
    const joinExtraCost = totalExtraHours * constants.actualHourlyRate * PAYMENT_MONTHS;
    const budgetA = calculateClassBudget(a, constants);
    const budgetB = calculateClassBudget(partner, constants);
    const mergedBudget = calculateClassBudget(merged, constants);
    const costAfter = mergedBudget.totalExpenses + joinExtraCost;
    const delta = (mergedBudget.totalIncome - costAfter) - (budgetA.balance + budgetB.balance);
    if (delta >= 1000) {
      candidates.push({ lowIdx: idx, members: [a, partner], merged, createsStandard, enteredHours, extraMonthlyHours: totalExtraHours, delta });
    }
  }

  const byLow = new Map(candidates.map(c => [c.lowIdx, c]));
  let prev2 = { sum: 0, chosen: [] };
  let prev1 = { sum: 0, chosen: [] };
  for (let g = 0; g < GRADE_ORDER.length; g++) {
    const cand = byLow.get(g - 1);
    const take = cand ? { sum: prev2.sum + cand.delta, chosen: [...prev2.chosen, cand] } : null;
    const best = take && take.sum > prev1.sum ? take : prev1;
    prev2 = prev1;
    prev1 = best;
  }
  return [...prev1.chosen].sort((a, b) => a.lowIdx - b.lowIdx);
}

// ─── שאר ההצעות ───────────────────────────────────────────────
export function transportParentsReport(expenses) {
  const rows = (expenses || [])
    .filter(e => /הסע/.test(e.name || ''))
    .map(e => ({ e, annual: annualAmount(e) }))
    .filter(r => r.annual > 0);
  return { rows, total: rows.reduce((s, r) => s + r.annual, 0) };
}

export function jointShabbatReport(classes, constants, weeklyHoursPerClass = DEFAULT_SHABBAT_WEEKLY_HOURS) {
  const classCount = classes.length;
  const perClassAnnual = weeklyHoursPerClass * constants.actualHourlyRate * PAYMENT_MONTHS;
  return { classCount, saving: classCount >= 2 ? classCount * perClassAnnual : 0 };
}

export function caharonReport(classes, constants) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const income = Number(constants.incomePerStudentCaharon || 0);
  const expense = Number(constants.expensePerStudentCaharon || 0);
  const perStudentGap = expense - income;
  return {
    totalStudents, perStudentGap,
    gap: perStudentGap > 0 && expense > 0 ? perStudentGap * totalStudents : 0,
  };
}

export function parentContributionReport(classes, amountPerStudent = DEFAULT_PARENT_CONTRIBUTION) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return { totalStudents, amountPerStudent, gain: totalStudents > 0 ? totalStudents * amountPerStudent : 0 };
}

export function partaniyotReport(classes, constants, hoursPerClass = DEFAULT_PARTANIYOT_HOURS) {
  const classCount = classes.length;
  const perClassAnnual = hoursPerClass * constants.actualHourlyRate * PAYMENT_MONTHS;
  return { classCount, hoursPerClass, saving: classCount > 0 ? classCount * perClassAnnual : 0 };
}

export function principalTeachingReport(classes, constants, weeklyHours = DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS) {
  return {
    weeklyHours,
    saving: classes.length > 0 ? weeklyHours * constants.actualHourlyRate * PAYMENT_MONTHS : 0,
  };
}

export function tuitionReport(classes, amountPerStudent = DEFAULT_TUITION_AMOUNT, collectionRatePct = DEFAULT_TUITION_COLLECTION_RATE) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents, amountPerStudent, collectionRatePct,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent * (collectionRatePct / 100) : 0,
  };
}

export function tuitionSupplementReport(classes, amountPerStudent = DEFAULT_TUITION_SUPPLEMENT) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents, amountPerStudent, collectionRatePct: SUPPLEMENT_COLLECTION_RATE,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent * (SUPPLEMENT_COLLECTION_RATE / 100) : 0,
  };
}

export function closeClassReport(classes, constants, excludeIds = new Set()) {
  const graded = classes
    .filter(c => !excludeIds.has(c.id))
    .map(c => ({ c, idx: classGradeIndex(c) }))
    .filter(x => x.idx != null);
  if (graded.length === 0) return [];
  const topIdx = Math.max(...graded.map(x => x.idx));
  // close_class_extra_grades (מיגרציה v23) — שכבות נוספות, מלבד הגבוהה
  // ביותר שנבדקת תמיד, שהמנהלת בחרה להציע כהצעת סגירה נפרדת (ר' SettingsPage).
  const extraIdxs = (constants.closeClassExtraGrades ?? [])
    .map(g => normalizeGrade(g))
    .filter(idx => idx != null && idx < topIdx);
  const targetIdxs = [...new Set([topIdx, ...extraIdxs])];

  const rows = [];
  for (const idx of targetIdxs) {
    const atGrade = graded
      .filter(x => x.idx === idx)
      .map(x => x.c)
      .sort((a, b) => a.studentCount - b.studentCount);
    const cand = atGrade[0];
    if (!cand || cand.studentCount >= constants.fullClassStudentThreshold) continue;
    const budget = calculateClassBudget(cand, constants);
    if (budget.balance >= -1000) continue;
    rows.push({ cls: cand, budget, saving: -budget.balance });
  }
  return rows;
}

export function hoursCutReport(classes, constants, hoursCut = 1) {
  const classCount = classes.length;
  const perHourAllClasses = constants.actualHourlyRate * PAYMENT_MONTHS * classCount;
  const maxCut = Math.max(0, constants.actualWeeklyHours - constants.fullClassMinistryHours);
  return { classCount, perHourAllClasses, maxCut, saving: perHourAllClasses * hoursCut };
}

export function thresholdReport(classes, constants, maxGap = 4, excludeIds = new Set()) {
  const rows = [];
  for (const c of classes) {
    if (excludeIds.has(c.id)) continue;
    const type = getClassType(c.studentCount, constants);
    if (type === 'full') continue;
    const target = type === 'half'
      ? constants.fullClassStudentThreshold
      : constants.halfClassStudentThreshold;
    const gap = target - c.studentCount;
    if (gap < 1 || gap > maxGap) continue;
    const before = calculateClassBudget(c, constants).balance;
    const after = calculateClassBudget({ ...c, studentCount: target }, constants).balance;
    if (after - before <= 0) continue;
    rows.push({ cls: c, gap, target, gain: after - before, nextType: type === 'half' ? 'full' : 'half' });
  }
  rows.sort((a, b) => b.gain - a.gain);
  return { rows, totalGain: rows.reduce((s, r) => s + r.gain, 0) };
}

export function eventsCapReport(expenses, categories, classes) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const kinds = kindMap(categories);
  const rows = expenses.filter(e => kinds[e.categoryId] === 'events');
  const eventsTotal = rows.reduce((s, e) => s + annualAmount(e), 0);
  const cap = totalStudents * EVENTS_CAP_PER_STUDENT;
  return { eventsTotal, cap, totalStudents, excess: Math.max(0, eventsTotal - cap) };
}

export function topExpensesReport(expenses, categories, count = 3) {
  const kinds = kindMap(categories);
  const catName = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const rows = expenses
    .filter(e => kinds[e.categoryId] !== 'salary' && kinds[e.categoryId] !== 'events' && kinds[e.categoryId] !== 'profdev' && !/הסע/.test(e.name || ''))
    .map(e => ({ e, annual: annualAmount(e), category: catName[e.categoryId] || '' }))
    .filter(r => r.annual > 0)
    .sort((a, b) => b.annual - a.annual)
    .slice(0, count);
  return { rows, total: rows.reduce((s, r) => s + r.annual, 0) };
}

// ערכי ברירת מחדל לפרמטרים הניתנים לכוונון במסך הייעול — ר' src/lib/efficiency.js
export const DEFAULT_SUGGESTION_PARAMS = {
  dualAddedHours: 0,
  hoursCut: 1,
  trimPct: 10,
  shabbatHours: DEFAULT_SHABBAT_WEEKLY_HOURS,
  parentAmount: DEFAULT_PARENT_CONTRIBUTION,
  partaniyotHours: DEFAULT_PARTANIYOT_HOURS,
  principalHours: DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS,
  tuitionAmount: DEFAULT_TUITION_AMOUNT,
  tuitionRate: DEFAULT_TUITION_COLLECTION_RATE,
  supplementAmount: DEFAULT_TUITION_SUPPLEMENT,
};

// ─── רשימת ההצעות ─────────────────────────────────────────────
export function buildSuggestionRows(classes, expenses, expenseCategories, constants, params = {}) {
  const p = { ...DEFAULT_SUGGESTION_PARAMS, ...params };
  const rows = [];
  const merges = findMerges(classes, constants);
  const mergedIds = new Set(merges.flatMap(m => m.members.map(x => x.id)));
  // classDelta — בכמה כיתות מצטמצם בית הספר אם ההצעה מיושמת
  for (const m of merges) {
    rows.push({ key: `merge:${m.merged.id}`, label: `צירוף כיתות: ${m.members.map(x => x.name).join(' + ')} (${m.merged.studentCount} תל׳)`, saving: m.delta, classDelta: -(m.members.length - 1), kind: 'merge', names: m.members.map(x => x.name) });
  }
  const dualMerges = dualAgeMergeReport(classes, constants, mergedIds, DUAL_AGE_EXTRA_MONTHLY_HOURS + p.dualAddedHours);
  const dualMergedIds = new Set(dualMerges.flatMap(m => m.members.map(x => x.id)));
  for (const m of dualMerges) {
    rows.push({ key: `dual:${m.merged.id}`, label: `${m.createsStandard ? 'יצירת תקן — חיבור' : 'חיבור כיתות:'} ${m.members.map(x => x.name).join(' + ')} (${m.merged.studentCount} תל׳, כולל תוספת ${m.extraMonthlyHours} שעות שבועיות)`, saving: m.delta, classDelta: -(m.members.length - 1), kind: 'dual', names: m.members.map(shortClassLabel) });
  }
  const allMergedIds = new Set([...mergedIds, ...dualMergedIds]);
  for (const r of closeClassReport(classes, constants, allMergedIds)) {
    rows.push({ key: `close:${r.cls.id}`, label: `סגירת כיתה ${r.cls.name} — הכיתה הגבוהה, ${r.cls.studentCount} תל׳ בלבד`, saving: r.saving, classDelta: -1, kind: 'close', names: [r.cls.name] });
  }
  const hoursR = hoursCutReport(classes, constants, p.hoursCut);
  if (hoursR.maxCut > 0 && hoursR.perHourAllClasses > 0) rows.push({ key: 'hours-cut', label: `הורדת ${p.hoursCut} שעות הוראה מכל כיתה (${hoursR.classCount} כיתות)`, saving: hoursR.saving });
  const topR = topExpensesReport(expenses, expenseCategories);
  if (topR.total > 0) rows.push({ key: 'trim', label: `קיצוץ ${p.trimPct}% ב-${topR.rows.length} ההוצאות הגדולות`, saving: Math.round(topR.total * p.trimPct / 100) });
  const shabbat = jointShabbatReport(classes, constants, p.shabbatHours);
  if (shabbat.saving > 0) rows.push({ key: 'shabbat', label: `קבלת שבת משותפת לכל הכיתות (שעה שבועית × ${shabbat.classCount} כיתות)`, saving: shabbat.saving });
  const transport = transportParentsReport(expenses);
  if (transport.total > 0) rows.push({ key: 'transport-parents', label: 'הסעות בגביית הורים — הסרת העלות מהתקציב', saving: transport.total });
  const caharon = caharonReport(classes, constants);
  if (caharon.gap > 0) rows.push({ key: 'caharon', label: `התאמת מחיר הצהרון לעלות (${nis(caharon.perStudentGap)} לתלמיד)`, saving: caharon.gap });
  const tuition = tuitionReport(classes, p.tuitionAmount, p.tuitionRate);
  if (tuition.gain > 0) rows.push({ key: 'tuition', label: `שכר לימוד עם גבייה ריאלית (${nis(tuition.amountPerStudent)} × ${tuition.collectionRatePct}% × ${tuition.totalStudents} תלמידים)`, saving: tuition.gain });
  const supplement = tuitionSupplementReport(classes, p.supplementAmount);
  if (supplement.gain > 0) rows.push({ key: 'tuition-supplement', label: `תוספת שכר לימוד (${nis(supplement.amountPerStudent)} × ${supplement.collectionRatePct}% × ${supplement.totalStudents} תלמידים)`, saving: supplement.gain });
  const parents = parentContributionReport(classes, p.parentAmount);
  if (parents.gain > 0) rows.push({ key: 'parents', label: `השתתפות הורים שנתית (${nis(parents.amountPerStudent)} לתלמיד × ${parents.totalStudents})`, saving: parents.gain });
  const partaniyot = partaniyotReport(classes, constants, p.partaniyotHours);
  if (partaniyot.saving > 0) rows.push({ key: 'partaniyot', label: `שעות פרטניות מהמשרה כשעה פרונטלית (${partaniyot.hoursPerClass} ש׳ × ${partaniyot.classCount} כיתות)`, saving: partaniyot.saving });
  const principal = principalTeachingReport(classes, constants, p.principalHours);
  if (principal.saving > 0) rows.push({ key: 'principal-teaching', label: `שעות הוראה של המנהלת (${principal.weeklyHours} ש׳ שבועיות)`, saving: principal.saving });
  const events = eventsCapReport(expenses, expenseCategories, classes);
  if (events.excess > 0) rows.push({ key: 'events-cap', label: 'החזרת הוצאות אירועים לתקרת הרשת', saving: events.excess });
  const th = thresholdReport(classes, constants, 4, allMergedIds);
  for (const r of th.rows) {
    rows.push({ key: `threshold:${r.cls.id}`, label: `${r.cls.name}: עוד ${r.gap} תלמידים ל${r.nextType === 'full' ? 'תקן מלא' : 'חצי תקן'}`, saving: r.gain });
  }
  return rows.sort((a, b) => b.saving - a.saving);
}

// selectedKeys === null ⇒ עוד לא נשמרה בחירה, וברירת המחדל היא שהכל נבחר
export function selectedSuggestions(rows, selectedKeys) {
  return selectedKeys == null ? rows : rows.filter(r => selectedKeys.has(r.key));
}

export function sumSavings(rows) {
  return rows.reduce((s, r) => s + r.saving, 0);
}

// כמה כיתות נחסכות בתוכנית — סכום הצמצומים של ההצעות הנבחרות
export function sumClassDelta(rows) {
  return rows.reduce((s, r) => s + (r.classDelta ?? 0), 0);
}

// תיאור שינויי מבנה הכיתות להצגה בסוגריים — "ג,ד — דו־גילאית"
export function classChangeSummary(rows) {
  const parts = [];
  for (const r of rows) {
    if (!r.classDelta || !r.names?.length) continue;
    const names = r.names.join(',');
    if (r.kind === 'dual') parts.push(`${names} — דו־גילאית`);
    else if (r.kind === 'merge') parts.push(`${names} — מאוחדות`);
    else if (r.kind === 'close') parts.push(`סגירת ${names}`);
  }
  return parts.join(' · ');
}

// שם קצר לכיתה — אות השכבה ("כיתה ד" ← "ד"), ואם לא מזוהה, השם כפי שהוזן
export function shortClassLabel(c) {
  const idx = classGradeIndex(c);
  return idx != null ? GRADE_ORDER[idx] : c.name;
}

// ─── הקפאת התוכנית בסגירה ─────────────────────────────────────
// עותק נאמן של src/lib/efficiency.js. מרגע שהתקציב נסגר, מבט רשת מציג את
// הסנפשוט מ-budget_approvals.summary ולא מחשב מחדש — כך שהמספר בפורטל
// זהה למספר שהמנהלת חתמה עליו, גם אחרי שינוי בהיגיון המנוע.
export const PLAN_SNAPSHOT_VERSION = 1;

export function isPlanClosed(summary) {
  return Array.isArray(summary?.suggestions);
}

export function planFromSnapshot(summary) {
  if (!isPlanClosed(summary)) return null;
  const row = (s) => ({ key: s.key, label: s.label, saving: Number(s.saving) || 0, classDelta: Number(s.classDelta) || 0, kind: s.kind ?? null, names: s.names ?? null });
  const suggestions = summary.suggestions.map(row);
  const selected = summary.suggestions.filter(s => s.selected).map(row);
  return {
    suggestions,
    selected,
    total: sumSavings(selected),
    projectedBalance: Number(summary.projectedBalance) || 0,
    classCountAfter: summary.classCountAfter ?? null,
    closedAt: summary.closedAt ?? null,
    frozen: true,
  };
}

export function totalsFromSnapshot(summary) {
  if (!isPlanClosed(summary)) return null;
  return {
    totalIncome: Number(summary.totalIncome) || 0,
    totalExpenses: Number(summary.totalExpenses) || 0,
    balance: Number(summary.balance) || 0,
    totalStudents: Number(summary.students) || 0,
    classCount: Number(summary.classCount) || 0,
    frozen: true,
  };
}

export function classesFromSnapshot(summary) {
  return Array.isArray(summary?.classes) ? summary.classes : null;
}
