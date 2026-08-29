import { calculateClassBudget, getClassType, annualAmount, formatCurrency } from './calculations.js';
import { kindMap } from './categoryKinds.js';
import { EVENTS_CAP_PER_STUDENT, PAYMENT_MONTHS } from '../data/constants.js';

// גודל מרבי לכיתה מאוחדת — מעבר לזה צירוף אינו ריאלי
export const MAX_MERGED_STUDENTS = 32;

// ─── צירוף כיתות ──────────────────────────────────────────────
// כיתה מאוחדת: סכום התלמידים + סכום השעות הבודדות של כל הכיתות —
// בחיבור כיתות השעות הבודדות מצטרפות, הן לא נעלמות (הנחיית שרה 21/7).
// המזהה ממוין — סדר השליפה מה-DB אינו מובטח, ומפתח הצעה חייב להיות זהה
// בכל מסך ובכל ריצה כדי שבחירה שנשמרה תמשיך להתאים
export function mergedClass(members) {
  return {
    id: members.map(m => m.id).sort().join('+'),
    name: members.map(m => m.name).join(' + '),
    studentCount: members.reduce((s, m) => s + m.studentCount, 0),
    extraHours: members.reduce((s, m) => s + Number(m.extraHours || 0), 0),
  };
}

// מפתחות בחירה שנשמרו לפני שהמזהה מוין נשמרו בסדר השליפה דאז —
// מיישרים אותם לצורה הממוינת בטעינה, כדי שבחירה קיימת לא תלך לאיבוד
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
    // מקבצים לפי שכבה מנורמלת (כולל זיהוי מהשם כשהשדה ריק) כדי ש"א"/"א'"/
    // "כיתה א" ייחשבו לאותה שכבה; טקסט חופשי שלא מזוהה מתקבץ לפי מחרוזת
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

// ─── חיבור כיתות בשכבות סמוכות (דו-גילאי) ──────────────────────
// כל חיבור מוסיף לכיתה המחוברת 12 שעות שבועיות — שעות בודדות שמתווספות
// רק באיחוד כיתות, זהו (הנחיית שרה). במודל: 12 × תעריף × 12 חודשים,
// באותן יחידות כמו שעות הכיתה (22/34).
export const DUAL_AGE_EXTRA_MONTHLY_HOURS = 12;

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

// שכבת כיתה: משדה השכבה, ואם הוא ריק — מזהים מתוך שם הכיתה
// ("כיתה ג" ← ג). בהרצליה למשל הוזנו שמות בלי שכבה, וזה הסתיר חיבורים.
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
  // בודקים אסימונים ארוכים קודם — "יא"/"יב" לפני "י"/"א" כדי לא לפגוע בהם
  const byLength = [...GRADE_ORDER].sort((a, b) => b.length - a.length);
  for (const token of byLength) {
    if (s.startsWith(token)) return GRADE_ORDER.indexOf(token);
  }
  return null;
}

// extraMonthlyHours — השעות הבודדות שמוקצות לכיתה המחוברת. ברירת המחדל היא
// ההקצאה הרשתית (12), ואפשר להעלות אותה במסך הייעול כשחיבור מסוים דורש יותר.
export function dualAgeMergeReport(classes, constants, excludeIds = new Set(), extraMonthlyHours = DUAL_AGE_EXTRA_MONTHLY_HOURS, pinnedKeys = new Set()) {
  // רק כיתה שהיא היחידה בשכבה שלה — אם יש עוד כיתה באותה שכבה, צירוף
  // רגיל (findMerges) הוא האפשרות הזולה יותר ועדיפה
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
    // רק בתוך היסודי — לא לחצות מסגרת (ו+ז) ולא בתוך חט"ב/תיכון (יא+יב)
    const div = divisionOf(idx);
    if (div !== 0 || divisionOf(idx + 1) !== div) continue;
    const a = singles.get(idx);
    // חיבור כיתות בשכבות סמוכות — תמיד כשזה חוסך; כשאחת ללא תקן והחיבור
    // חוצה סף, זו גם "יצירת תקן" (מסומן ב-createsStandard לניסוח הכרטיס)
    const typeA = getClassType(a.studentCount, constants);
    const typeB = getClassType(partner.studentCount, constants);
    // כיתה א נשארת לבד — מצטרפת לחיבור רק במקרה קריטי, כשהיא עצמה ללא
    // תקן בכלל (הנחיית שרה 22/7); אחרת החיבורים מתחילים מ-ב+ג
    if (idx === 0 && typeA !== 'none') continue;
    const merged = mergedClass([a, partner]);
    // אותה תקרה כמו בצירוף בתוך שכבה: כיתה דו-גילאית מעל MAX_MERGED_STUDENTS
    // אינה ריאלית (חדר אחד, מחנך/ת אחד/ת). בלי הבדיקה הזאת הוצעו כיתות של
    // 45 ו-60 תלמידים — והן גם דחקו הצעות סבירות בבחירת הזוגות שלמטה,
    // וכך נעלמה ברמת ישי ההצעה "ג + כיתה ד" שכבר נבחרה ונשמרה.
    if (merged.studentCount > MAX_MERGED_STUDENTS) continue;
    const createsStandard = (typeA === 'none' || typeB === 'none')
      && getClassType(merged.studentCount, constants) !== 'none';
    // השעות הבודדות שהוזנו בכיתות אינן נספרות בחיבור: הכיתה המחוברת מקבלת
    // את הקצאת החיבור בלבד (12 שעות, ועוד תוספת ידנית אם הוגדרה במסך הייעול).
    // enteredHours נשמר לתצוגה בלבד — הכרטיס מציין אילו שעות יורדות בחיבור.
    const enteredHours = Number(merged.extraHours || 0);
    const totalExtraHours = extraMonthlyHours;
    const joinExtraCost = totalExtraHours * constants.actualHourlyRate * PAYMENT_MONTHS;
    const budgetA = calculateClassBudget(a, constants);
    const budgetB = calculateClassBudget(partner, constants);
    const mergedBudget = calculateClassBudget({ ...merged, extraHours: 0 }, constants);
    const costAfter = mergedBudget.totalExpenses + joinExtraCost;
    const delta = (mergedBudget.totalIncome - costAfter) - (budgetA.balance + budgetB.balance);
    const pinned = pinnedKeys.has(`dual:${merged.id}`);
    if (pinned || delta >= 1000) {
      candidates.push({
        pinned,
        lowIdx: idx,
        members: [a, partner],
        merged,
        createsStandard,
        allocatedHours: DUAL_AGE_EXTRA_MONTHLY_HOURS,
        addedHours: extraMonthlyHours - DUAL_AGE_EXTRA_MONTHLY_HOURS,
        enteredHours,
        extraMonthlyHours: totalExtraHours,
        joinExtraCost,
        incomeBefore: budgetA.totalIncome + budgetB.totalIncome,
        incomeAfter: mergedBudget.totalIncome,
        costBefore: budgetA.totalExpenses + budgetB.totalExpenses,
        costAfter,
        delta,
      });
    }
  }

  // בחירת זוגות ללא חפיפה שממקסמת את סך החיסכון (תכנון דינמי על רצף
  // השכבות) — כך "ב+ג וגם ד+ה" מנצחים "ג+ד" בודד, במקום שהזוג האמצעי
  // ישרוף את שתי השכנות (הבאג שהסתיר את החיבורים בהרצליה)
  // הצעה שנבחרה ונשמרה נכנסת קודם — הכרעה של שרה אינה נעלמת בגלל
  // שקומבינציה אחרת חוסכת יותר. נעוצות חופפות זו לזו: הראשונה גוברת.
  const chosen = [];
  const taken = new Set();
  for (const c of candidates.filter(x => x.pinned).sort((a, b) => a.lowIdx - b.lowIdx)) {
    if (taken.has(c.lowIdx) || taken.has(c.lowIdx + 1)) continue;
    chosen.push(c); taken.add(c.lowIdx); taken.add(c.lowIdx + 1);
  }
  const byLow = new Map(candidates.filter(c => !taken.has(c.lowIdx) && !taken.has(c.lowIdx + 1))
    .map(c => [c.lowIdx, c]));
  let prev2 = { sum: 0, chosen: [] };
  let prev1 = { sum: 0, chosen: [] };
  for (let g = 0; g < GRADE_ORDER.length; g++) {
    const cand = byLow.get(g - 1); // הזוג שתופס את שכבות g-1 ו-g
    const take = cand ? { sum: prev2.sum + cand.delta, chosen: [...prev2.chosen, cand] } : null;
    const best = take && take.sum > prev1.sum ? take : prev1;
    prev2 = prev1;
    prev1 = best;
  }
  return [...chosen, ...prev1.chosen].sort((a, b) => a.lowIdx - b.lowIdx);
}

// ─── הסעות בגביית הורים ───────────────────────────────────────
// סעיפי הסעות שממומנים היום מהתקציב — העברת המימון לגביית הורים
// מסירה את העלות מהגירעון (למשל עפולה: 25,000 ₪ לחודש)
export function transportParentsReport(expenses) {
  const rows = (expenses || [])
    .filter(e => /הסע/.test(e.name || ''))
    .map(e => ({ e, annual: annualAmount(e) }))
    .filter(r => r.annual > 0);
  return { rows, total: rows.reduce((s, r) => s + r.annual, 0) };
}

// ─── קבלת שבת משותפת ──────────────────────────────────────────
// כל הכיתות יחד בקבלת שבת אחת במקום קבלת שבת נפרדת בכל כיתה —
// נחסכת שעה שבועית אחת לכל כיתה. במודל המערכת התעריף (700/450) הוא
// עלות חודשית של שעה שבועית, ולכן: שעות שבועיות × תעריף × 12 חודשים
// (בדיוק כמו שאר ההצעות — בלי הכפלה נוספת ב-4).
export const DEFAULT_SHABBAT_WEEKLY_HOURS = 1;

export function jointShabbatReport(classes, constants, weeklyHoursPerClass = DEFAULT_SHABBAT_WEEKLY_HOURS) {
  const classCount = classes.length;
  const perClassAnnual = weeklyHoursPerClass * constants.actualHourlyRate * PAYMENT_MONTHS;
  return {
    classCount,
    weeklyHoursPerClass,
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
// שעה שבועית שהיא מלמדת מחליפה שעה שהייתה נקנית בתעריף מלא.
// במודל המערכת התעריף (700/450) הוא עלות חודשית של שעה שבועית,
// ולכן: שעות שבועיות × תעריף × 12 חודשים (בלי הכפלה נוספת ב-4).
export const DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS = 6;

export function principalTeachingReport(classes, constants, weeklyHours = DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS) {
  return {
    weeklyHours,
    hourlyRate: constants.actualHourlyRate,
    saving: classes.length > 0 ? weeklyHours * constants.actualHourlyRate * PAYMENT_MONTHS : 0,
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
// הוספה מעל שכר הלימוד הקיים — נספרת ב-80% גבייה ריאלית כמו כל תשלומי ההורים
export const DEFAULT_TUITION_SUPPLEMENT = 3000; // ₪ לתלמיד לשנה
export const SUPPLEMENT_COLLECTION_RATE = 80; // % גבייה

export function tuitionSupplementReport(classes, amountPerStudent = DEFAULT_TUITION_SUPPLEMENT) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  return {
    totalStudents,
    amountPerStudent,
    collectionRatePct: SUPPLEMENT_COLLECTION_RATE,
    gain: totalStudents > 0 ? totalStudents * amountPerStudent * (SUPPLEMENT_COLLECTION_RATE / 100) : 0,
  };
}

// ─── סגירת כיתה ───────────────────────────────────────────────
// מוצעת רק על הכיתה הגבוהה ביותר בבית הספר, וכשמספר התלמידים בה נמוך
// (מתחת לסף כיתה מלאה) — התרחיש הריאלי לסגירה. החיסכון = הגירעון נטו
// של הכיתה, בהנחה שהתלמידים אינם נשארים במוסד.
export function closeClassReport(classes, constants, excludeIds = new Set()) {
  const allGraded = classes
    .map(c => ({ c, idx: classGradeIndex(c) }))
    .filter(x => x.idx != null);
  if (allGraded.length === 0) return [];

  // close_class_extra_grades (מיגרציה v23) — שכבות שהמנהלת בחרה במפורש
  // להציע כהצעת סגירה נפרדת (ר' SettingsPage). אלה מוצגות גם אם קיימת גם
  // הצעת חיבור/איחוד לאותה כיתה (excludeIds) — שתי אפשרויות חלופיות
  // שהמנהלת בוחרת ביניהן, לא סתירה.
  const extraIdxs = new Set(
    (constants.closeClassExtraGrades ?? []).map(g => normalizeGrade(g)).filter(idx => idx != null),
  );

  // ברירת המחדל (בלי שכבות נוספות): רק השכבה הגבוהה מבין הכיתות שעדיין לא
  // קיבלו הצעת חיבור זולה יותר — בדיוק כמו קודם.
  const nonExcluded = allGraded.filter(x => !excludeIds.has(x.c.id));
  const autoTopIdx = nonExcluded.length ? Math.max(...nonExcluded.map(x => x.idx)) : null;

  const targetIdxs = new Set(extraIdxs);
  if (autoTopIdx != null) targetIdxs.add(autoTopIdx);

  const rows = [];
  for (const idx of targetIdxs) {
    const respectExclude = idx === autoTopIdx && !extraIdxs.has(idx);
    const pool = (respectExclude ? nonExcluded : allGraded).filter(x => x.idx === idx);
    const cand = pool.map(x => x.c).sort((a, b) => a.studentCount - b.studentCount)[0];
    if (!cand || cand.studentCount >= constants.fullClassStudentThreshold) continue;
    const budget = calculateClassBudget(cand, constants);
    if (budget.balance >= -1000) continue;
    rows.push({ cls: cand, budget, saving: -budget.balance });
  }
  return rows;
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
// בלי סעיפי הסעות — מכוסים בהצעת "הסעות בגביית הורים" (transportParentsReport)
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

// ערכי ברירת מחדל לפרמטרים הניתנים לכוונון במסך הייעול (שעות חיבור נוספות,
// שכר לימוד, תרומת הורים וכו'). מי שקורא ל-buildSuggestionRows עם הערכים
// שנבחרו בפועל (ר' EfficiencyPage) מקבל את אותם הסכומים גם בסיכום ואישור
// ובסנפשוט השמור — בלעדיהם השורות תמיד חוזרות לברירת המחדל הרשתית.
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

// ─── רשימת ההצעות המדידות ─────────────────────────────────────
// מקור אמת אחד ל"מה ההצעות ובכמה הן שוות" — משמש את דף הבית, את הסיכום
// ואת המסמך החתום, כדי שהמפתחות (key) והסכומים יהיו זהים בכל מסך.
// params — הערכים שכוונונו במסך הייעול; מי שלא מעביר מקבל את ברירת המחדל הרשתית.
export function buildSuggestionRows(classes, expenses, expenseCategories, constants, params = {}, savedKeys = []) {
  const p = { ...DEFAULT_SUGGESTION_PARAMS, ...params };
  const rows = [];
  const merges = findMerges(classes, constants);
  const mergedIds = new Set(merges.flatMap(m => m.members.map(x => x.id)));
  // classDelta — בכמה כיתות מצטמצם בית הספר אם ההצעה מיושמת. משמש את מבט
  // רשת כדי להציג את מספר הכיתות המתקבל, ולא רק את החיסכון הכספי.
  for (const m of merges) {
    rows.push({ key: `merge:${m.merged.id}`, label: `צירוף כיתות: ${m.members.map(x => x.name).join(' + ')} (${m.merged.studentCount} תל׳)`, saving: m.delta, classDelta: -(m.members.length - 1), kind: 'merge', names: m.members.map(x => x.name) });
  }
  const dualMerges = dualAgeMergeReport(classes, constants, mergedIds, DUAL_AGE_EXTRA_MONTHLY_HOURS + p.dualAddedHours, new Set((savedKeys || []).filter(k => String(k).startsWith('dual:'))));
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
  if (caharon.gap > 0) rows.push({ key: 'caharon', label: `התאמת מחיר הצהרון לעלות (${formatCurrency(caharon.perStudentGap)} לתלמיד)`, saving: caharon.gap });
  const tuition = tuitionReport(classes, p.tuitionAmount, p.tuitionRate);
  if (tuition.gain > 0) rows.push({ key: 'tuition', label: `שכר לימוד עם גבייה ריאלית (${formatCurrency(tuition.amountPerStudent)} × ${tuition.collectionRatePct}% × ${tuition.totalStudents} תלמידים)`, saving: tuition.gain });
  const supplement = tuitionSupplementReport(classes, p.supplementAmount);
  if (supplement.gain > 0) rows.push({ key: 'tuition-supplement', label: `תוספת שכר לימוד (${formatCurrency(supplement.amountPerStudent)} × ${supplement.collectionRatePct}% × ${supplement.totalStudents} תלמידים)`, saving: supplement.gain });
  const parents = parentContributionReport(classes, p.parentAmount);
  if (parents.gain > 0) rows.push({ key: 'parents', label: `השתתפות הורים שנתית (${formatCurrency(parents.amountPerStudent)} לתלמיד × ${parents.totalStudents})`, saving: parents.gain });
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

// selectedKeys === null פירושו "עוד לא נשמרה בחירה" — ברירת המחדל היא שהכל נבחר
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

// תיאור קצר של שינויי מבנה הכיתות, להצגה בסוגריים ליד מספר הכיתות:
// "ג,ד — דו־גילאית" · "ג1,ג2 — מאוחדות" · "סגירת ו". מקור אחד לכל המסכים.
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

// שם קצר לכיתה בתיאור מבנה: אות השכבה ("כיתה ד" ← "ד"), ואם השכבה לא
// מזוהה — השם כפי שהוזן. בחיבור דו-גילאי יש כיתה אחת לכל שכבה, ולכן
// אותיות השכבה הן הזיהוי הקריא ביותר.
export function shortClassLabel(c) {
  const idx = classGradeIndex(c);
  return idx != null ? GRADE_ORDER[idx] : c.name;
}

// ─── הקפאת התוכנית בסגירה ─────────────────────────────────────
// מרגע שהתקציב נסגר (החתימה הראשונה) התוכנית קופאת: ההצעות, התוויות
// והסכומים נשמרים כפי שהיו באותו רגע ב-budget_approvals.summary, ומשם
// ואילך כל המסכים — דף הבית, הסיכום, המסמך החתום ומבט רשת — מציגים את
// הסנפשוט במקום לחשב מחדש.
// בלי זה כל שינוי בהיגיון המנוע כותב מחדש רטרואקטיבית תקציב שכבר אושר:
// כך נעלמה ברמת ישי הבחירה השמורה "ג + כיתה ד" אחרי שינוי בתמחור החיבור.
export const PLAN_SNAPSHOT_VERSION = 1;

export function buildPlanSnapshot({ rows, selectedKeys, totals, classes, closedAt }) {
  const selected = selectedSuggestions(rows, selectedKeys);
  const suggestionsTotal = sumSavings(selected);
  const balance = Math.round(totals.balance);
  const list = classes ?? [];
  return {
    version: PLAN_SNAPSHOT_VERSION,
    closedAt,
    totalIncome: Math.round(totals.totalIncome),
    totalExpenses: Math.round(totals.totalExpenses),
    balance,
    students: list.reduce((s, c) => s + Number(c.studentCount || 0), 0),
    classCount: list.length,
    suggestionsTotal: Math.round(suggestionsTotal),
    projectedBalance: balance + Math.round(suggestionsTotal),
    // מספר הכיתות המתקבל אחרי יישום ההצעות שנבחרו
    classCountAfter: list.length + sumClassDelta(selected),
    // מצבת הכיתות ומספרי התלמידים כפי שהיו ברגע החתימה. מרגע הסגירה
    // מספרי התלמידים לא משתנים בשום מסך — גם אם הכיתות ישתנו במסד.
    classes: list.map(c => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel ?? null,
      studentCount: Number(c.studentCount || 0),
      extraHours: Number(c.extraHours || 0),
    })),
    // כל ההצעות שהוצעו בזמן הסגירה ולא רק הנבחרות — כדי שהמסמך יישאר
    // קריא במלואו גם אחרי שהמנוע ישתנה
    suggestions: rows.map(r => ({
      key: r.key,
      label: r.label,
      saving: Math.round(r.saving),
      classDelta: r.classDelta ?? 0,
      kind: r.kind ?? null,
      names: r.names ?? null,
      selected: selectedKeys == null || selectedKeys.has(r.key),
    })),
  };
}

// נעילת תקציב — כבויה. ההכרעה (27.8.2026): שמירה שומרת, לעולם לא נועלת.
// כל המערכות נשארות פתוחות לעריכה תמיד, בכל בית ספר ובכל שנה.
//
// הדגל הזה הוא מתג יחיד: כל מסכי העריכה, המסמך והפורטל הרשתי נגזרים ממנו.
// להחזרת ההתנהגות הישנה צריך גם להחזיר את כתיבת הסנפשוט בשמירה ובחתימה
// (SummaryPage / EfficiencyPage) — בלעדיה אין מה לנעול.
//
// האכיפה במסד (migration_v20) אינה נכנסת לפעולה, כי מרגע ההכרעה אין נכתב
// מערך suggestions ל-summary — וזה הדגל היחיד שהטריגר בודק. migration_v26
// מסיר גם את הטריגר עצמו, למקרה שנשארה במסד שנה עם סנפשוט ישן.
export const LOCK_BUDGET_ON_SAVE = false;

// סנפשוט תקין הוא הסימן היחיד לכך שהתקציב נסגר. summary ישן (סכומים בלבד,
// בלי מערך הצעות) נחשב "עוד לא נסגר" וממשיך להתנהג כמו קודם.
export function isPlanClosed(summary) {
  return LOCK_BUDGET_ON_SAVE && Array.isArray(summary?.suggestions);
}

// התוכנית הקפואה בדיוק במבנה שמחזיר useSuggestionPlan
export function planFromSnapshot(summary) {
  if (!isPlanClosed(summary)) return null;
  const row = (s) => ({
    key: s.key, label: s.label, saving: Number(s.saving) || 0,
    classDelta: Number(s.classDelta) || 0, kind: s.kind ?? null, names: s.names ?? null,
  });
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

// התמונה התקציבית הקפואה — סכומים, מצבת כיתות ומספרי תלמידים כפי שנחתמו.
// מסכי התצוגה קוראים מכאן אחרי סגירה, כדי ששינוי במסד לא יזיז מספר שנחתם.
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
