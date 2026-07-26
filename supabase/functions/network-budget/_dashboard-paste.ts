// @ts-nocheck
// ⚠️ קובץ מאוחד להדבקה בעורך של דשבורד Supabase — נוצר ע"י scripts/bundle-network-function.mjs
// אין לערוך אותו ידנית. מקורות: budget-engine.js + index.ts באותה תיקייה.
// דרך הפריסה המועדפת היא ה-CLI:
//   npx supabase functions deploy network-budget --project-ref ogkwvrerolofujhydhsl --no-verify-jwt
// בדשבורד: לוודא ש-"Verify JWT" נשאר כבוי, אחרת הפורטל יקבל 401.

const { buildSuggestionRows, selectedSuggestions, sumSavings, normalizeSuggestionKey } = (() => {
// מנוע הייעול של מבט רשת — העתק נאמן של src/lib/efficiency.js (+ החלקים
// הדרושים מ-src/lib/calculations.js ומ-src/data/constants.js), כדי שה-Edge
// Function תחשב "מצב תקציב לאחר ייעול" בדיוק כמו המערכת של בית הספר.
//
// חשוב: המפתחות (key) חייבים להישאר זהים לאלה שבאפליקציה — לפיהם נשמרת
// הבחירה של המנהלת ב-budget_approvals.selected_suggestion_keys.
// כל שינוי בהיגיון החישוב במערכת חייב להיעשות גם כאן; scripts/verify-engine-parity.mjs
// מריץ את שני המנועים על אותם נתונים ומוודא שהתוצאה זהה.

const PAYMENT_MONTHS = 12;
const COUNSELING_HOURS_PER_CLASS = 2;
const TUITION_COLLECTION_RATE = 0.8;
const CLUBS_MONTHLY_EXPENSE_PER_CLASS = 2000;
const CLUBS_MONTHS = 10;
const EVENTS_CAP_PER_STUDENT = 1400;
const MAX_MERGED_STUDENTS = 32;
const DUAL_AGE_EXTRA_MONTHLY_HOURS = 12;
const DEFAULT_SHABBAT_WEEKLY_HOURS = 1;
const DEFAULT_PARENT_CONTRIBUTION = 100;
const TEACHER_POSITION_HOURS = 21;
const DEFAULT_PARTANIYOT_HOURS = 3;
const DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS = 6;
const DEFAULT_TUITION_AMOUNT = 3000;
const DEFAULT_TUITION_COLLECTION_RATE = 80;
const DEFAULT_TUITION_SUPPLEMENT = 3000;
const SUPPLEMENT_COLLECTION_RATE = 80;

const nis = (amount) => '₪' + Math.abs(Math.round(amount)).toLocaleString('he-IL');

// ─── קטגוריות ─────────────────────────────────────────────────
const KIND_RULES = [
  ['salary', ['שכר']],
  ['profdev', ['פיתוח']],
  ['building', ['בניין', 'בנין', 'אחזק', 'תחזוק', 'תפעול']],
  ['equipment', ['קיץ', 'ציוד', 'ריהוט', 'תשתי']],
  ['events', ['אירוע', 'ארוע', 'חג', 'מסיב', 'פעיל']],
];

function inferKind(name = '') {
  for (const [kind, words] of KIND_RULES) {
    if (words.some(w => name.includes(w))) return kind;
  }
  return 'other';
}

function kindMap(categories = []) {
  return Object.fromEntries(categories.map(c => [c.id, c.kind || inferKind(c.name)]));
}

function annualAmount(expense) {
  if (!expense) return 0;
  return expense.period === 'monthly' ? expense.amount * 12 : expense.amount;
}

// ─── תקציב כיתה ───────────────────────────────────────────────
function getClassType(studentCount, constants) {
  if (studentCount >= constants.fullClassStudentThreshold) return 'full';
  if (studentCount >= constants.halfClassStudentThreshold) return 'half';
  return 'none';
}

function calculateClassBudget(classItem, constants) {
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
function mergedClass(members) {
  return {
    id: members.map(m => m.id).sort().join('+'),
    name: members.map(m => m.name).join(' + '),
    studentCount: members.reduce((s, m) => s + m.studentCount, 0),
    extraHours: members.reduce((s, m) => s + Number(m.extraHours || 0), 0),
  };
}

function normalizeSuggestionKey(key) {
  const m = /^(merge|dual):(.+)$/.exec(key || '');
  if (!m) return key;
  return `${m[1]}:${m[2].split('+').sort().join('+')}`;
}

function mergeDelta(members, constants) {
  const budgetsBefore = members.map(m => calculateClassBudget(m, constants));
  const merged = mergedClass(members);
  const budgetAfter = calculateClassBudget(merged, constants);
  const before = budgetsBefore.reduce((s, b) => s + b.balance, 0);
  return { merged, delta: budgetAfter.balance - before };
}

function findMerges(classes, constants, maxStudents = MAX_MERGED_STUDENTS) {
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

function classGradeIndex(c) {
  return normalizeGrade(c.gradeLevel) ?? normalizeGrade(c.name);
}

function normalizeGrade(raw) {
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
function dualAgeMergeReport(classes, constants, excludeIds = new Set(), extraMonthlyHours = DUAL_AGE_EXTRA_MONTHLY_HOURS) {
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

  const joinExtraCost = extraMonthlyHours * constants.actualHourlyRate * PAYMENT_MONTHS;
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
    const createsStandard = (typeA === 'none' || typeB === 'none')
      && getClassType(merged.studentCount, constants) !== 'none';
    const budgetA = calculateClassBudget(a, constants);
    const budgetB = calculateClassBudget(partner, constants);
    const mergedBudget = calculateClassBudget(merged, constants);
    const costAfter = mergedBudget.totalExpenses + joinExtraCost;
    const delta = (mergedBudget.totalIncome - costAfter) - (budgetA.balance + budgetB.balance);
    if (delta >= 1000) {
      candidates.push({ lowIdx: idx, members: [a, partner], merged, createsStandard, extraMonthlyHours, delta });
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
function transportParentsReport(expenses) {
  const rows = (expenses || [])
    .filter(e => /הסע/.test(e.name || ''))
    .map(e => ({ e, annual: annualAmount(e) }))
    .filter(r => r.annual > 0);
  return { rows, total: rows.reduce((s, r) => s + r.annual, 0) };
}

function jointShabbatReport(classes, constants, weeklyHoursPerClass = DEFAULT_SHABBAT_WEEKLY_HOURS) {
  const classCount = classes.length;
  const perClassAnnual = weeklyHoursPerClass * constants.actualHourlyRate * PAYMENT_MONTHS;
  return { classCount, saving: classCount >= 2 ? classCount * perClassAnnual : 0 };
}

function caharonReport(classes, constants) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const income = Number(constants.incomePerStudentCaharon || 0);
  const expense = Number(constants.expensePerStudentCaharon || 0);
  const perStudentGap = expense - income;
  return {
    totalStudents, perStudentGap,
    gap: perStudentGap > 0 && expense > 0 ? perStudentGap * totalStudents : 0,
  };
}

function parentContributionReport(classes, amountPerStudent = DEFAULT_PARENT_CONTRIBUTION) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return { totalStudents, amountPerStudent, gain: totalStudents > 0 ? totalStudents * amountPerStudent : 0 };
}

function partaniyotReport(classes, constants, hoursPerClass = DEFAULT_PARTANIYOT_HOURS) {
  const classCount = classes.length;
  const perClassAnnual = hoursPerClass * constants.actualHourlyRate * PAYMENT_MONTHS;
  return { classCount, hoursPerClass, saving: classCount > 0 ? classCount * perClassAnnual : 0 };
}

function principalTeachingReport(classes, constants, weeklyHours = DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS) {
  return {
    weeklyHours,
    saving: classes.length > 0 ? weeklyHours * constants.actualHourlyRate * PAYMENT_MONTHS : 0,
  };
}

function tuitionReport(classes, amountPerStudent = DEFAULT_TUITION_AMOUNT, collectionRatePct = DEFAULT_TUITION_COLLECTION_RATE) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents, amountPerStudent, collectionRatePct,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent * (collectionRatePct / 100) : 0,
  };
}

function tuitionSupplementReport(classes, amountPerStudent = DEFAULT_TUITION_SUPPLEMENT) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents, amountPerStudent, collectionRatePct: SUPPLEMENT_COLLECTION_RATE,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent * (SUPPLEMENT_COLLECTION_RATE / 100) : 0,
  };
}

function closeClassReport(classes, constants, excludeIds = new Set()) {
  const graded = classes
    .filter(c => !excludeIds.has(c.id))
    .map(c => ({ c, idx: classGradeIndex(c) }))
    .filter(x => x.idx != null);
  if (graded.length === 0) return [];
  const topIdx = Math.max(...graded.map(x => x.idx));
  const topClasses = graded
    .filter(x => x.idx === topIdx)
    .map(x => x.c)
    .sort((a, b) => a.studentCount - b.studentCount);
  const cand = topClasses[0];
  if (!cand || cand.studentCount >= constants.fullClassStudentThreshold) return [];
  const budget = calculateClassBudget(cand, constants);
  if (budget.balance >= -1000) return [];
  return [{ cls: cand, budget, saving: -budget.balance }];
}

function hoursCutReport(classes, constants, hoursCut = 1) {
  const classCount = classes.length;
  const perHourAllClasses = constants.actualHourlyRate * PAYMENT_MONTHS * classCount;
  const maxCut = Math.max(0, constants.actualWeeklyHours - constants.fullClassMinistryHours);
  return { classCount, perHourAllClasses, maxCut, saving: perHourAllClasses * hoursCut };
}

function thresholdReport(classes, constants, maxGap = 4, excludeIds = new Set()) {
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

function eventsCapReport(expenses, categories, classes) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const kinds = kindMap(categories);
  const rows = expenses.filter(e => kinds[e.categoryId] === 'events');
  const eventsTotal = rows.reduce((s, e) => s + annualAmount(e), 0);
  const cap = totalStudents * EVENTS_CAP_PER_STUDENT;
  return { eventsTotal, cap, totalStudents, excess: Math.max(0, eventsTotal - cap) };
}

function topExpensesReport(expenses, categories, count = 3) {
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

// ─── רשימת ההצעות ─────────────────────────────────────────────
function buildSuggestionRows(classes, expenses, expenseCategories, constants) {
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
  const topR = topExpensesReport(expenses, expenseCategories);
  if (topR.total > 0) rows.push({ key: 'trim', label: `קיצוץ 10% ב-${topR.rows.length} ההוצאות הגדולות`, saving: Math.round(topR.total * 0.1) });
  const shabbat = jointShabbatReport(classes, constants);
  if (shabbat.saving > 0) rows.push({ key: 'shabbat', label: `קבלת שבת משותפת לכל הכיתות (שעה שבועית × ${shabbat.classCount} כיתות)`, saving: shabbat.saving });
  const transport = transportParentsReport(expenses);
  if (transport.total > 0) rows.push({ key: 'transport-parents', label: 'הסעות בגביית הורים — הסרת העלות מהתקציב', saving: transport.total });
  const caharon = caharonReport(classes, constants);
  if (caharon.gap > 0) rows.push({ key: 'caharon', label: `התאמת מחיר הצהרון לעלות (${nis(caharon.perStudentGap)} לתלמיד)`, saving: caharon.gap });
  const tuition = tuitionReport(classes);
  if (tuition.gain > 0) rows.push({ key: 'tuition', label: `שכר לימוד עם גבייה ריאלית (${nis(tuition.amountPerStudent)} × ${tuition.collectionRatePct}% × ${tuition.totalStudents} תלמידים)`, saving: tuition.gain });
  const supplement = tuitionSupplementReport(classes);
  if (supplement.gain > 0) rows.push({ key: 'tuition-supplement', label: `תוספת שכר לימוד (${nis(supplement.amountPerStudent)} × ${supplement.collectionRatePct}% × ${supplement.totalStudents} תלמידים)`, saving: supplement.gain });
  const parents = parentContributionReport(classes);
  if (parents.gain > 0) rows.push({ key: 'parents', label: `השתתפות הורים שנתית (${nis(DEFAULT_PARENT_CONTRIBUTION)} לתלמיד × ${parents.totalStudents})`, saving: parents.gain });
  const partaniyot = partaniyotReport(classes, constants);
  if (partaniyot.saving > 0) rows.push({ key: 'partaniyot', label: `שעות פרטניות מהמשרה כשעה פרונטלית (${partaniyot.hoursPerClass} ש׳ × ${partaniyot.classCount} כיתות)`, saving: partaniyot.saving });
  const principal = principalTeachingReport(classes, constants);
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
function selectedSuggestions(rows, selectedKeys) {
  return selectedKeys == null ? rows : rows.filter(r => selectedKeys.has(r.key));
}

function sumSavings(rows) {
  return rows.reduce((s, r) => s + r.saving, 0);
}

  return { buildSuggestionRows, selectedSuggestions, sumSavings, normalizeSuggestionKey };
})();

// מבט רשת — אגרגטור קריאה-בלבד של כל 12 מערכות התקציב עבור הפורטל
// chabad-budget-hub.surge.sh. מאובטח בקוד גישה (HUB_ACCESS_CODE) ומחזיק את
// מפתחות השירות בסוד SCHOOL_KEYS = {"<ref>":"<service key>", ...}.
// החישוב משקף אחד-לאחד את src/lib/calculations.js (שעות חודשיות × תעריף × 12).
//
// פריסה (הפונקציה יושבת בפרויקט של אשקלון; הפורטל קורא בלי JWT):
//   set SUPABASE_ACCESS_TOKEN=sbp_...
//   npx supabase functions deploy network-budget --project-ref ogkwvrerolofujhydhsl --no-verify-jwt
// בדיקה לפני פריסה:  npx deno check supabase/functions/network-budget/index.ts
//                    node scripts/verify-engine-parity.mjs


// disableClubs — בתי ספר שבהם תוספת החוגים הרשתית כבויה (VITE_DISABLE_CLUBS=1
// ב-.env של אותו בית ספר). חייב להישאר תואם, אחרת המספרים כאן לא יתאימו למערכת.
type School = { slug: string; name: string; ref: string; url: string; disableClubs?: boolean };

const SCHOOLS: School[] = [
  { slug: 'raanana', name: 'בית חינוך רעננה - בנים', ref: 'jhtajcejwxfcksvjzkzx', url: 'https://chabad-raanana-budget.surge.sh', disableClubs: true },
  { slug: 'mazkeret', name: 'שלהבות מזכרת בתיה', ref: 'njsanabfbmnaqvwraqdh', url: 'https://chabad-mazkeret-budget.surge.sh' },
  { slug: 'ashkelon', name: 'שלהבות אשקלון', ref: 'ogkwvrerolofujhydhsl', url: 'https://chabad-ashkelon-budget.surge.sh' },
  { slug: 'or-akiva', name: 'שלהבות אור עקיבא', ref: 'fqzyouwodkorgrhoulnf', url: 'https://chabad-or-akiva-budget.surge.sh' },
  { slug: 'jerusalem', name: 'שלהבות ירושלים', ref: 'yzzautohkioeikjoufpb', url: 'https://chabad-jerusalem-budget.surge.sh', disableClubs: true },
  { slug: 'kiryat-bialik', name: 'שלהבות קרית ביאליק', ref: 'qecoccsdkmunowyjzzoc', url: 'https://chabad-kiryat-bialik-budget.surge.sh' },
  { slug: 'ganei-tikva', name: 'שלהבות גני תקוה', ref: 'spvcflsbjleayhzsknph', url: 'https://chabad-ganei-tikva-budget.surge.sh' },
  { slug: 'ramat-yishai', name: 'שלהבות רמת ישי', ref: 'bvxoywkqefpnyxvjydpz', url: 'https://chabad-ramat-yishai-budget.surge.sh' },
  { slug: 'afula', name: 'בית חינוך עפולה', ref: 'inwiirkalzcbpnxngqpi', url: 'https://chabad-afula-budget.surge.sh', disableClubs: true },
  { slug: 'herzliya', name: 'שלהבות הרצליה', ref: 'qawlduxrovrodmxpehvv', url: 'https://chabad-herzliya-budget.surge.sh' },
  { slug: 'haifa', name: 'שלהבות חיפה', ref: 'ygmwcdxthcmvrdrbtwuy', url: 'https://chabad-haifa-budget.surge.sh' },
  { slug: 'raanana-girls', name: 'בית חינוך רעננה - בנות', ref: 'dqxwsovaryixondmhgyz', url: 'https://chabad-raanana-girls-budget.surge.sh' },
];

const PAYMENT_MONTHS = 12;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const annualAmount = (e: { amount: number; period: string }) =>
  e.period === 'monthly' ? Number(e.amount) * 12 : Number(e.amount);

async function fetchSchool(s: School, key: string) {
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const base = `https://${s.ref}.supabase.co/rest/v1`;
  const get = async (path: string) => {
    const r = await fetch(`${base}/${path}`, { headers: h });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  };

  const [schoolRows, years] = await Promise.all([
    get('schools?select=name,mode&limit=1'),
    get('budget_years?select=id,label,is_active'),
  ]);
  const year = years.find((y: { is_active: boolean }) => y.is_active) ?? years[0];
  if (!year) return { slug: s.slug, name: s.name, url: s.url, empty: true };

  const [classes, income, expenses, cats, constRows] = await Promise.all([
    get(`classes?budget_year_id=eq.${year.id}&select=id,name,grade_level,student_count,extra_hours`),
    get(`income_sources?budget_year_id=eq.${year.id}&select=name,amount`),
    get(`expenses?budget_year_id=eq.${year.id}&select=id,name,amount,period,category_id`),
    get('expense_categories?select=id,name,kind'),
    get(`financial_constants?budget_year_id=eq.${year.id}&select=*`),
  ]);

  // הבחירה של המנהלת בהצעות הייעול. הטבלה לא קיימת בכל המוסדות (מיגרציה v16/v18)
  // ואז נשארים בברירת המחדל של המערכת — כל ההצעות נחשבות נבחרות.
  let selectedKeys: Set<string> | null = null;
  try {
    const rows = await get(`budget_approvals?budget_year_id=eq.${year.id}&select=selected_suggestion_keys&limit=1`);
    const keys = rows?.[0]?.selected_suggestion_keys;
    if (Array.isArray(keys)) selectedKeys = new Set(keys.map(normalizeSuggestionKey));
  } catch { /* טבלה שעוד לא הוקמה — ברירת מחדל */ }
  const c = constRows[0] ?? {};
  const mode = schoolRows[0]?.mode === 'simple' ? 'simple' : 'full';
  const students = classes.reduce((t: number, x: { student_count: number }) => t + x.student_count, 0);
  const additional = income.reduce((t: number, x: { amount: number }) => t + Number(x.amount || 0), 0);
  // כמו באפליקציה: שורות בקטגוריית פיתוח-מקצועי לא נספרות (מחושב פר כיתה)
  const profdevIds = new Set(cats.filter((x: { kind: string }) => x.kind === 'profdev').map((x: { id: string }) => x.id));
  const countable = expenses.filter((e: { category_id: string }) => !profdevIds.has(e.category_id));
  const manualTotal = countable.reduce((t: number, e: never) => t + annualAmount(e), 0);
  const catName = Object.fromEntries(cats.map((x: { id: string; name: string }) => [x.id, x.name]));
  const byCategory: Record<string, number> = {};
  for (const e of countable) {
    const n = catName[e.category_id] ?? 'אחר';
    byCategory[n] = (byCategory[n] ?? 0) + annualAmount(e);
  }
  const principal = expenses.find((e: { name: string }) => e.name === 'שכר מנהלת');

  if (mode === 'simple') {
    return {
      slug: s.slug, name: s.name, url: s.url, mode, yearLabel: year.label,
      students, classCount: classes.length, ofek: null,
      income: { additional, sources: income, total: additional },
      expenses: { manualTotal, byCategory, total: manualTotal },
      balance: additional - manualTotal,
      principalMonthly: principal ? Number(principal.amount) : 0,
    };
  }

  const fullTh = Number(c.full_class_student_threshold ?? 21);
  const halfTh = Number(c.half_class_student_threshold ?? 11);
  const fullH = Number(c.full_class_ministry_hours ?? 22);
  const halfH = Number(c.half_class_ministry_hours ?? 11);
  const rate = Number(c.ministry_hourly_rate ?? 400);
  const actH = Number(c.actual_weekly_hours ?? 29);
  const actRate = Number(c.actual_hourly_rate ?? 700);
  const perStudent = Number(c.income_per_student ?? 350);
  const talan = Number(c.income_per_student_talan ?? 885);
  const grant = Number(c.ministry_grant_per_student ?? 370);
  const expStudent = Number(c.expense_per_student ?? 1200);
  const profDev = Number(c.professional_dev_per_class ?? 0);

  const classRows = classes.map((cl: { name: string; student_count: number }) => {
    const type = cl.student_count >= fullTh ? 'full' : cl.student_count >= halfTh ? 'half' : 'none';
    const hours = type === 'full' ? fullH : type === 'half' ? halfH : 0;
    return { name: cl.name, students: cl.student_count, type, ministryAnnual: hours * rate * PAYMENT_MONTHS };
  });
  const ministry = classRows.reduce((t: number, x: { ministryAnnual: number }) => t + x.ministryAnnual, 0);
  const grantIncome = students * grant;
  // שכר לימוד ותל"ן — 80% גבייה ריאלית (TUITION_COLLECTION_RATE בקוד הראשי)
  const studentIncome = students * perStudent * 0.8;
  const talanIncome = students * talan * 0.8;
  const teaching = classes.length * actH * actRate * PAYMENT_MONTHS;
  // שעות בודדות הוסרו מהתחשיב (21/7) — קיימות רק כתוספת חיבור כיתות
  // מרכיב ייעוץ — 2 שעות חודשיות קבועות לכל כיתה (ר' COUNSELING_HOURS_PER_CLASS בקוד הראשי)
  const counselingCost = classes.length * 2 * actRate * PAYMENT_MONTHS;
  // תוספת חוגים — 2,000 ₪ לכיתה לחודש × 10 חודשי פעילות (ר' CLUBS_MONTHLY_EXPENSE_PER_CLASS בקוד הראשי),
  // כבוי בבתי ספר שסומנו disableClubs — בדיוק כמו VITE_DISABLE_CLUBS במערכת שלהם
  const clubsMonthly = s.disableClubs ? 0 : 2000;
  const clubsExpense = classes.length * clubsMonthly * 10;
  const studentExp = students * expStudent;
  const profDevExp = classes.length * profDev;
  const totalIncome = ministry + grantIncome + studentIncome + talanIncome + additional;
  const totalExpenses = teaching + counselingCost + clubsExpense + studentExp + profDevExp + manualTotal;
  const balance = totalIncome - totalExpenses;

  // מצב התקציב לאחר יישום הצעות הייעול שנבחרו — אותו חישוב בדיוק שרץ במערכת
  // של בית הספר (budget-engine.js הוא העתק נאמן של src/lib/efficiency.js)
  const engineConstants = {
    counselingHoursPerClass: 2,
    clubsMonthlyExpensePerClass: clubsMonthly,
    fullClassStudentThreshold: fullTh,
    halfClassStudentThreshold: halfTh,
    fullClassMinistryHours: fullH,
    halfClassMinistryHours: halfH,
    ministryHourlyRate: rate,
    actualWeeklyHours: actH,
    actualHourlyRate: actRate,
    incomePerStudent: perStudent,
    incomePerStudentTalan: talan,
    expensePerStudent: expStudent,
    professionalDevPerClass: profDev,
    incomePerStudentCaharon: Number(c.income_per_student_caharon ?? 0),
    expensePerStudentCaharon: Number(c.expense_per_student_caharon ?? 0),
    ministryGrantPerStudent: grant,
  };
  const engineClasses = classes.map((cl: { id: string; name: string; grade_level: string | null; student_count: number; extra_hours: number }) => ({
    id: cl.id, name: cl.name, gradeLevel: cl.grade_level,
    studentCount: cl.student_count, extraHours: Number(cl.extra_hours ?? 0),
  }));
  const engineExpenses = expenses.map((e: { id: string; name: string; amount: number; period: string; category_id: string }) => ({
    id: e.id, name: e.name, amount: Number(e.amount), period: e.period, categoryId: e.category_id,
  }));
  let efficiency: unknown = null;
  try {
    const allRows = buildSuggestionRows(engineClasses, engineExpenses, cats, engineConstants);
    const chosen = selectedSuggestions(allRows, selectedKeys);
    const total = sumSavings(chosen);
    efficiency = {
      total,
      count: chosen.length,
      offered: allRows.length,
      saved: selectedKeys != null,
      projectedBalance: balance + total,
      rows: chosen.map((r: { label: string; saving: number }) => ({ label: r.label, saving: r.saving })),
    };
  } catch (e) {
    console.error(`efficiency ${s.slug}: ${e}`);
  }

  return {
    slug: s.slug, name: s.name, url: s.url, mode, yearLabel: year.label,
    students, classCount: classes.length,
    ofek: c.ofek_salary ?? null,
    efficiency,
    income: { ministry, grant: grantIncome, perStudent: studentIncome, talan: talanIncome, additional, sources: income, total: totalIncome },
    expenses: { teaching, teachingMonthly: classes.length * actH * actRate, counselingCost, clubsExpense, studentExp, profDev: profDevExp, manualTotal, byCategory, total: totalExpenses },
    balance,
    principalMonthly: principal ? Number(principal.amount) : 0,
    classes: classRows,
  };
}

// כניסה בלחיצה מהפורטל: מייצר קישור קסם חד-פעמי לחשבון הרשת בבית הספר המבוקש —
// שרה נכנסת למערכת המלאה בלי סיסמה (ה-redirect הולך ל-site_url של הפרויקט).
const HUB_LOGIN_EMAIL = 'data@reshetch.org.il';

async function launchLink(ref: string, key: string) {
  const r = await fetch(`https://${ref}.supabase.co/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: HUB_LOGIN_EMAIL }),
  });
  const j = await r.json();
  if (!r.ok || !j.action_link) throw new Error(`generate_link: ${r.status}`);
  return j.action_link as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const body = await req.json().catch(() => ({}));
  const { code } = body;
  const expected = Deno.env.get('HUB_ACCESS_CODE');
  if (!expected || code !== expected) return json({ error: 'unauthorized' }, 401);

  const keys = JSON.parse(Deno.env.get('SCHOOL_KEYS') ?? '{}');

  if (body.launch) {
    const s = SCHOOLS.find((x) => x.slug === body.launch);
    if (!s || !keys[s.ref]) return json({ error: 'unknown school' }, 400);
    try {
      return json({ url: await launchLink(s.ref, keys[s.ref]) });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }
  const schools = await Promise.all(
    SCHOOLS.map(async (s) => {
      try {
        if (!keys[s.ref]) return { slug: s.slug, name: s.name, url: s.url, error: 'no key' };
        return await fetchSchool(s, keys[s.ref]);
      } catch (e) {
        return { slug: s.slug, name: s.name, url: s.url, error: String(e) };
      }
    }),
  );
  return json({ generatedAt: new Date().toISOString(), schools });
});
