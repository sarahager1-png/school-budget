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
    const raw = (c.gradeLevel ?? '').toString().trim();
    if (!raw) continue;
    // מקבצים לפי שכבה מנורמלת (כמו dualAgeMergeReport) כדי ש"א"/"א'"/"כיתה א"
    // ייחשבו לאותה שכבה גם אם הוקלדו בפורמט חופשי שונה; טקסט חופשי שלא
    // מזוהה (למשל "גן חובה") ממשיך להתקבץ לפי השוואת מחרוזת כבעבר
    const idx = normalizeGrade(raw);
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

// ─── איחוד לכיתה דו-גילאית ──────────────────────────────────────
// המטרה: כיתה ללא תקן בכלל (מתחת לסף המימון, type='none') שאין לה עם מי
// להתאחד באותה שכבה — לא עניין של גודל חדר. מאחדים עם השכבה הסמוכה כדי
// לחצות את סף המימון וליצור תקן שלא היה קיים, עם שעות הקבצה נפרדות לפי
// שכבה בשלושת המקצועות שדורשים רמה נפרדת.
export const DUAL_AGE_SUBJECTS = ['אנגלית', 'מתמטיקה', 'שפה'];
export const DEFAULT_HAKVATZA_HOURS_PER_SUBJECT = 8;

const GRADE_ORDER = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];

// חלוקה למסגרות חינוך — מודל האיחוד הדו-גילאי (חדר פיזי משותף + הקבצה
// בשלושה מקצועות ליבה סביב מחנך/ת אחד/ת) משקף יום לימודים יסודי בלבד.
// אסור להציע איחוד שחוצה גבול מסגרת (למשל ו+ז) או בתוך חט"ב/תיכון (למשל יא+יב),
// ששם אין מבנה מחנך יחיד וסט המקצועות/השעות שונה לגמרי.
const SCHOOL_DIVISIONS = [
  ['א', 'ב', 'ג', 'ד', 'ה', 'ו'], // יסודי — היחיד שהמודל הזה תקף בו
  ['ז', 'ח', 'ט'], // חטיבת ביניים
  ['י', 'יא', 'יב'], // תיכון
];

function divisionOf(idx) {
  const grade = GRADE_ORDER[idx];
  return SCHOOL_DIVISIONS.findIndex(d => d.includes(grade));
}

export function normalizeGrade(raw) {
  if (!raw) return null;
  const s = raw.toString().trim().replace(/^כיתה\s*/, '').replace(/["'׳״]/g, '').replace(/\s+/g, '');
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n >= 1 && n <= GRADE_ORDER.length ? n - 1 : null;
  }
  // בודקים אסימונים ארוכים קודם — "יא"/"יב" לפני "י"/"א" כדי לא לפגוע בהם
  const byLength = [...GRADE_ORDER].sort((a, b) => b.length - a.length);
  for (const token of byLength) {
    if (s.startsWith(token)) return GRADE_ORDER.indexOf(token);
  }
  return null;
}

// hakvatzaHoursPerSubjectMonth: שעות חודשיות נוספות לכל מקצוע (× 3 המקצועות)
// כדי ללמד כל שכבה בנפרד באנגלית/מתמטיקה/שפה גם אחרי האיחוד הפיזי
export function dualAgeMergeReport(classes, constants, excludeIds = new Set(), hakvatzaHoursPerSubjectMonth = DEFAULT_HAKVATZA_HOURS_PER_SUBJECT) {
  // רק כיתה שהיא היחידה בשכבה שלה — אם יש עוד כיתה באותה שכבה, צירוף
  // רגיל (findMerges) הוא האפשרות הזולה יותר ועדיפה
  const byGrade = new Map();
  for (const c of classes) {
    if (excludeIds.has(c.id)) continue;
    const idx = normalizeGrade(c.gradeLevel);
    if (idx == null) continue;
    if (!byGrade.has(idx)) byGrade.set(idx, []);
    byGrade.get(idx).push(c);
  }
  const singles = new Map();
  for (const [idx, list] of byGrade) {
    if (list.length === 1) singles.set(idx, list[0]);
  }

  const hakvatzaAnnualCost = DUAL_AGE_SUBJECTS.length * hakvatzaHoursPerSubjectMonth * constants.actualHourlyRate * PAYMENT_MONTHS;

  const candidates = [];
  for (const idx of [...singles.keys()].sort((a, b) => a - b)) {
    const partner = singles.get(idx + 1);
    if (!partner) continue;
    // רק בתוך היסודי — לא לחצות מסגרת (ו+ז) ולא בתוך חט"ב/תיכון (יא+יב)
    const div = divisionOf(idx);
    if (div !== 0 || divisionOf(idx + 1) !== div) continue;
    const a = singles.get(idx);
    // התנאי המרכזי: לא עניין של גודל חדר — רק כשלפחות אחת מהכיתות ללא
    // תקן בכלל, וההתאחדות בפועל חוצה סף וממש יוצרת תקן שלא היה קיים
    const typeA = getClassType(a.studentCount, constants);
    const typeB = getClassType(partner.studentCount, constants);
    if (typeA !== 'none' && typeB !== 'none') continue;
    const merged = mergedClass([a, partner]);
    if (getClassType(merged.studentCount, constants) === 'none') continue;
    const budgetA = calculateClassBudget(a, constants);
    const budgetB = calculateClassBudget(partner, constants);
    const mergedBudget = calculateClassBudget(merged, constants);
    const costAfter = mergedBudget.totalExpenses + hakvatzaAnnualCost;
    const delta = (mergedBudget.totalIncome - costAfter) - (budgetA.balance + budgetB.balance);
    if (delta >= 1000) {
      candidates.push({
        members: [a, partner],
        merged,
        hakvatzaAnnualCost,
        incomeBefore: budgetA.totalIncome + budgetB.totalIncome,
        incomeAfter: mergedBudget.totalIncome,
        costBefore: budgetA.totalExpenses + budgetB.totalExpenses,
        costAfter,
        delta,
      });
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

// ─── קבלת שבת משותפת ──────────────────────────────────────────
// כל הכיתות יחד בקבלת שבת אחת במקום קבלת שבת נפרדת בכל כיתה —
// נחסכת שעה שבועית (= 4 שעות חודשיות) לכל כיתה
export const DEFAULT_SHABBAT_MONTHLY_HOURS = 4;

export function jointShabbatReport(classes, constants, monthlyHoursPerClass = DEFAULT_SHABBAT_MONTHLY_HOURS) {
  const classCount = classes.length;
  const perClassAnnual = monthlyHoursPerClass * constants.actualHourlyRate * PAYMENT_MONTHS;
  return {
    classCount,
    monthlyHoursPerClass,
    hourlyRate: constants.actualHourlyRate,
    perClassAnnual,
    saving: classCount >= 2 ? classCount * perClassAnnual : 0,
  };
}

// ─── צהרון מסובסד ─────────────────────────────────────────────
// כשההוצאה לתלמיד בצהרון גבוהה מהגבייה לתלמיד — כל תלמיד מגדיל את הגירעון.
// התאמת המחיר לעלות סוגרת את הפער בלי לפגוע בפעילות.
export function caharonReport(classes, constants) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const income = Number(constants.incomePerStudentCaharon || 0);
  const expense = Number(constants.expensePerStudentCaharon || 0);
  const perStudentGap = expense - income;
  return {
    totalStudents,
    income,
    expense,
    perStudentGap,
    gap: perStudentGap > 0 && expense > 0 ? perStudentGap * totalStudents : 0,
  };
}

// ─── השתתפות הורים שנתית ──────────────────────────────────────
// גביית השתתפות שנתית מההורים (מעבר לשכר הלימוד ולתל"ן) —
// כל סכום לתלמיד מוכפל בכל תלמידי בית הספר
export const DEFAULT_PARENT_CONTRIBUTION = 100; // ₪ לתלמיד לשנה

export function parentContributionReport(classes, amountPerStudent = DEFAULT_PARENT_CONTRIBUTION) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents,
    amountPerStudent,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent : 0,
  };
}

// ─── שעות פרטניות ממשרת המורה ─────────────────────────────────
// ממשרה מלאה של 21 שעות, 3 שעות פרטניות יכולות להילמד בכיתה כשעה
// פרונטלית — שעות שכבר משולמות במשרה ולא צריך לקנות בנפרד.
export const TEACHER_POSITION_HOURS = 21;
export const DEFAULT_PARTANIYOT_HOURS = 3;

export function partaniyotReport(classes, constants, hoursPerClass = DEFAULT_PARTANIYOT_HOURS) {
  const classCount = classes.length;
  const perClassAnnual = hoursPerClass * constants.actualHourlyRate * PAYMENT_MONTHS;
  return {
    classCount,
    hoursPerClass,
    positionHours: TEACHER_POSITION_HOURS,
    hourlyRate: constants.actualHourlyRate,
    perClassAnnual,
    saving: classCount > 0 ? classCount * perClassAnnual : 0,
  };
}

// ─── שעות הוראה של המנהלת ─────────────────────────────────────
// המנהלת מלמדת בפועל 6-8 שעות שבועיות — שכרה כבר משולם בנפרד, וכל
// שעה שהיא מלמדת מחליפה שעת הוראה שהייתה נקנית בתעריף מלא.
// שעה שבועית = 4 שעות חודשיות במודל המערכת.
export const DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS = 6;
export const WEEKS_PER_MONTH_FACTOR = 4;

export function principalTeachingReport(classes, constants, weeklyHours = DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS) {
  const monthlyHours = weeklyHours * WEEKS_PER_MONTH_FACTOR;
  return {
    weeklyHours,
    monthlyHours,
    hourlyRate: constants.actualHourlyRate,
    saving: classes.length > 0 ? monthlyHours * constants.actualHourlyRate * PAYMENT_MONTHS : 0,
  };
}

// ─── שכר לימוד עם אחוזי גבייה ריאליים ──────────────────────────
// לא כל שכר הלימוד שנקבע נגבה בפועל — אחוז הגבייה משקף את הצפוי במציאות
export const DEFAULT_TUITION_AMOUNT = 3000; // ₪ לתלמיד לשנה
export const DEFAULT_TUITION_COLLECTION_RATE = 80; // % גבייה ריאלית

export function tuitionReport(classes, amountPerStudent = DEFAULT_TUITION_AMOUNT, collectionRatePct = DEFAULT_TUITION_COLLECTION_RATE) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents,
    amountPerStudent,
    collectionRatePct,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent * (collectionRatePct / 100) : 0,
  };
}

// ─── תוספת שכר לימוד ────────────────────────────────────────────
// הוספה חד-פעמית מעל שכר הלימוד הקיים — לא קשורה לאחוזי הגבייה
export const DEFAULT_TUITION_SUPPLEMENT = 3000; // ₪ לתלמיד לשנה

export function tuitionSupplementReport(classes, amountPerStudent = DEFAULT_TUITION_SUPPLEMENT) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents,
    amountPerStudent,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent : 0,
  };
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
