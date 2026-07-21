import { calculateClassBudget, getClassType, annualAmount } from './calculations.js';
import { kindMap } from './categoryKinds.js';
import { EVENTS_CAP_PER_STUDENT, PAYMENT_MONTHS } from '../data/constants.js';

// גודל מרבי לכיתה מאוחדת — מעבר לזה צירוף אינו ריאלי
export const MAX_MERGED_STUDENTS = 32;

// ─── צירוף כיתות ──────────────────────────────────────────────
// כיתה מאוחדת: סכום התלמידים; שומרת את תוכנית השעות הבודדות הגדולה מבין המקורות
export function mergedClass(members) {
  return {
    id: members.map(m => m.id).join('+'),
    name: members.map(m => m.name).join(' + '),
    studentCount: members.reduce((s, m) => s + m.studentCount, 0),
    extraHours: Math.max(...members.map(m => Number(m.extraHours || 0))),
  };
}

export function mergeDelta(members, constants) {
  const budgetsBefore = members.map(m => calculateClassBudget(m, constants));
  const merged = mergedClass(members);
  const budgetAfter = calculateClassBudget(merged, constants);
  const before = budgetsBefore.reduce((s, b) => s + b.balance, 0);
  return {
    merged,
    budgetsBefore,
    budgetAfter,
    incomeBefore: budgetsBefore.reduce((s, b) => s + b.totalIncome, 0),
    incomeAfter: budgetAfter.totalIncome,
    costBefore: budgetsBefore.reduce((s, b) => s + b.totalExpenses, 0),
    costAfter: budgetAfter.totalExpenses,
    delta: budgetAfter.balance - before,
  };
}

// כל צירוף אפשרי (זוגות ושלשות) בתוך אותה שכבה, עד גודל מרבי,
// ואז בחירה חמדנית ללא חפיפה — כל כיתה מופיעה בהצעה אחת לכל היותר
export function findMerges(classes, constants, maxStudents = MAX_MERGED_STUDENTS) {
  const groups = new Map();
  for (const c of classes) {
    const key = (c.gradeLevel ?? '').toString().trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const candidates = [];
  for (const [grade, list] of groups) {
    if (list.length < 2) continue;
    const subsets = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        subsets.push([list[i], list[j]]);
        for (let k = j + 1; k < list.length; k++) {
          subsets.push([list[i], list[j], list[k]]);
        }
      }
    }
    for (const members of subsets) {
      const students = members.reduce((s, m) => s + m.studentCount, 0);
      if (students > maxStudents) continue;
      const result = mergeDelta(members, constants);
      // רק חיסכון משמעותי — מתחת לאלף ₪ בשנה לא שווה את הטלטלה
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

// ─── שעות בודדות ──────────────────────────────────────────────
export function extraHoursReport(classes, constants) {
  const perHour = constants.actualHourlyRate * PAYMENT_MONTHS;
  const rows = classes
    .filter(c => Number(c.extraHours || 0) > 0)
    .map(c => ({
      cls: c,
      hours: Number(c.extraHours),
      annualCost: Number(c.extraHours) * perHour,
    }))
    .sort((a, b) => b.annualCost - a.annualCost);
  return {
    rows,
    perHour,
    totalHours: rows.reduce((s, r) => s + r.hours, 0),
    totalCost: rows.reduce((s, r) => s + r.annualCost, 0),
  };
}

// ─── הורדת שעות בפועל לכל הכיתות ──────────────────────────────
// הורדה מתחת לשעות שהמשרד מממן לכיתה מלאה אינה מוצעת
export function hoursCutReport(classes, constants, hoursCut = 1) {
  const classCount = classes.length;
  const perHourAllClasses = constants.actualHourlyRate * PAYMENT_MONTHS * classCount;
  const maxCut = Math.max(0, constants.actualWeeklyHours - constants.fullClassMinistryHours);
  return {
    classCount,
    perHourAllClasses,
    maxCut,
    currentHours: constants.actualWeeklyHours,
    fundedHours: constants.fullClassMinistryHours,
    hourlyRate: constants.actualHourlyRate,
    saving: perHourAllClasses * hoursCut,
  };
}

// ─── כיתות קרובות לסף תקן ─────────────────────────────────────
// עוד תלמיד־שניים והכיתה קופצת מדרגת מימון — כמה זה שווה בפועל
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
    rows.push({
      cls: c,
      gap,
      target,
      gain: after - before,
      nextType: type === 'half' ? 'full' : 'half',
    });
  }
  rows.sort((a, b) => b.gain - a.gain);
  return { rows, totalGain: rows.reduce((s, r) => s + r.gain, 0) };
}

// ─── כיתות ללא תקן שאין להן פתרון מיידי ───────────────────────
export function noStandardReport(classes, constants, excludeIds = new Set()) {
  const rows = classes
    .filter(c => getClassType(c.studentCount, constants) === 'none' && !excludeIds.has(c.id))
    .map(c => ({ cls: c, budget: calculateClassBudget(c, constants) }))
    .sort((a, b) => a.budget.balance - b.budget.balance);
  return { rows, totalDeficit: rows.reduce((s, r) => s + Math.min(0, r.budget.balance), 0) };
}

// ─── תקרת אירועים רשתית ───────────────────────────────────────
export function eventsCapReport(expenses, categories, classes) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const kinds = kindMap(categories);
  const rows = expenses.filter(e => kinds[e.categoryId] === 'events');
  const eventsTotal = rows.reduce((s, e) => s + annualAmount(e), 0);
  const cap = totalStudents * EVENTS_CAP_PER_STUDENT;
  return {
    eventsTotal,
    cap,
    totalStudents,
    capPerStudent: EVENTS_CAP_PER_STUDENT,
    excess: Math.max(0, eventsTotal - cap),
  };
}

// ─── קיצוץ בהוצאות הכלליות הגדולות ────────────────────────────
// בלי סעיפי שכר — קיצוץ שכר אינו הצעת ייעול שמציעים ממסך
// בלי סעיפי אירועים — אלו כבר נספרים בתקרת האירועים (eventsCapReport), כדי למנוע ספירה כפולה
// בלי סעיפי פיתוח מקצועי — אלה לא נכללים בסה"כ ההוצאות (ר' calculateSchoolTotals), אז "חיסכון" בהם לא באמת סוגר גירעון
export function topExpensesReport(expenses, categories, count = 3) {
  const kinds = kindMap(categories);
  const catName = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const rows = expenses
    .filter(e => kinds[e.categoryId] !== 'salary' && kinds[e.categoryId] !== 'events' && kinds[e.categoryId] !== 'profdev')
    .map(e => ({ e, annual: annualAmount(e), category: catName[e.categoryId] || '' }))
    .filter(r => r.annual > 0)
    .sort((a, b) => b.annual - a.annual)
    .slice(0, count);
  return { rows, total: rows.reduce((s, r) => s + r.annual, 0) };
}
