// השעות הן חודשיות והתשלום 12 חודשים בשנה.
// כיתה מלאה: 22 שעות חודשיות × 400 ₪ = 8,800 ₪ בחודש = 105,600 ₪ בשנה.
export const PAYMENT_MONTHS = 12;

// שכר אופק חדש קובע את תעריף עלות ההוראה בפועל: כן = 700 ₪/שעה, לא = 550 ₪/שעה.
// ofekSalary === null ⇒ טרם נענתה — המערכת שואלת בדף הבית עד שעונים.
export const OFEK_RATES = { yes: 700, no: 550 };

// חלק מהמורות באופק וחלק בעולם הישן (מיגרציה v25): התעריף בפועל הוא ממוצע
// משוקלל בין שני המסלולים. את הצד של העולם הישן אפשר לתאר בשתי דרכים —
// מספר מורות, או סכום שכר שנתי (כשיודעים כמה הוא עולה אבל לא כמה מורות).
// הסכום הוא *חלק* מעלות ההוראה שכבר מחושבת, לא תוספת עליה: הוא מוריד את
// התעריף המשוקלל, ולכן סה"כ ההוצאות לא גדל ואין כפל ספירה.

// כמה עולה מורה אחת בעולם הישן לשנה, לפי אותו מודל של עלות ההוראה:
// 550 ₪ × 34 שעות חודשיות × 12 חודשים = 224,400 ₪. זו יחידת ההמרה של הסכום.
export function nonOfekTeacherAnnualCost(actualWeeklyHours) {
  const hours = Number(actualWeeklyHours) || DEFAULT_CONSTANTS.actualWeeklyHours;
  return OFEK_RATES.no * hours * PAYMENT_MONTHS;
}

// סכום שנתי ⇒ כמה מורות בעולם הישן הוא שווה (יכול לצאת שבר, וזה בסדר —
// זה משקל בממוצע, לא מספר אנשים)
export function nonOfekTeachersFromAmount(amount, actualWeeklyHours) {
  const a = Math.max(0, Number(amount) || 0);
  const unit = nonOfekTeacherAnnualCost(actualWeeklyHours);
  return unit > 0 ? a / unit : 0;
}

// המשקל של צד העולם הישן — לפי הסכום אם הוזן, אחרת לפי ספירת המורות
export function nonOfekUnits(c) {
  const amount = Number(c?.nonOfekAmount) || 0;
  return amount > 0
    ? nonOfekTeachersFromAmount(amount, c?.actualWeeklyHours)
    : Math.max(0, Number(c?.nonOfekTeachers) || 0);
}

export function isOfekMixed(c) {
  return Number(c?.ofekTeachers) > 0 && nonOfekUnits(c) > 0;
}

// הפרימיטיב: ממוצע משוקלל בין שני המסלולים. null כששני המשקלים ריקים.
export function blendedOfekRate(ofekUnits, nonOfekUnits) {
  const ofek = Math.max(0, Number(ofekUnits) || 0);
  const old = Math.max(0, Number(nonOfekUnits) || 0);
  if (ofek + old === 0) return null;
  return Math.round((ofek * OFEK_RATES.yes + old * OFEK_RATES.no) / (ofek + old));
}

// התעריף המשוקלל של מוסד לפי הקבועים שלו (ספירה או סכום — לפי מה שהוזן)
export function ofekBlendedRate(c) {
  return blendedOfekRate(Math.max(0, Number(c?.ofekTeachers) || 0), nonOfekUnits(c));
}

// המצב שנבחר בפועל: 'mixed' | true | false | null (טרם נענתה)
export function ofekMode(c) {
  if (isOfekMixed(c)) return 'mixed';
  return c?.ofekSalary ?? null;
}

// מרכיב ייעוץ: שעות ייעוץ לכיתה בחודש — עלות בתחשיב כל כיתה.
// נערך במסך ההגדרות ונשמר בעמודה counseling_hours_per_class (מיגרציה v21).
// הערך כאן הוא ברירת המחדל למוסד שעוד לא קבע ערך משלו.
export const COUNSELING_HOURS_PER_CLASS = 2;

// אחוז גבייה ריאלי על תשלומי הורים — שכר לימוד ותל"ן נספרים ב-80%
// (לא כל ההורים משלמים במלואם; הנחיית שרה 21/7)
export const TUITION_COLLECTION_RATE = 0.8;

// תוספת הוצאות חוגים — 2,000 ₪ לכיתה לחודש × 10 חודשי פעילות (שנה"ל, ללא יולי-אוגוסט)
// = 20,000 ₪ לכיתה לשנה. מרכיב קבוע בתחשיב (כמו ייעוץ)
export const CLUBS_MONTHLY_EXPENSE_PER_CLASS = 2000;
export const CLUBS_MONTHS = 10;

export const DEFAULT_CONSTANTS = {
  schoolWeeks: 36, // legacy — לא משתתף בחישוב (הוחלף במודל החודשי); נשמר כי העמודה קיימת ב-DB
  counselingHoursPerClass: COUNSELING_HOURS_PER_CLASS,
  clubsMonthlyExpensePerClass: CLUBS_MONTHLY_EXPENSE_PER_CLASS,
  fullClassStudentThreshold: 21,
  halfClassStudentThreshold: 11,
  fullClassMinistryHours: 22,
  halfClassMinistryHours: 11,
  ministryHourlyRate: 400,
  actualWeeklyHours: 34,
  actualHourlyRate: 700,
  ofekSalary: null,
  ofekTeachers: 0,     // מצב "חלק וחלק" — כמה מורות בשכר אופק
  nonOfekTeachers: 0,  // מצב "חלק וחלק" — כמה מורות בעולם הישן
  nonOfekAmount: 0,    // מצב "חלק וחלק" — שכר שנתי לצוות העולם הישן (₪), חלופה לספירה
  incomePerStudent: 350,
  incomePerStudentTalan: 885,
  expensePerStudent: 1200,
  professionalDevPerClass: 0, // פיתוח מקצועי נכלל בהוצאה לתלמיד (1,200) — נשאר כקבוע למי שצריך בנפרד
  principalMonthlySalary: 27000,
  incomePerStudentCaharon: 0,
  expensePerStudentCaharon: 0,
  ministryGrantPerStudent: 370,
  closeClassExtraGrades: [], // שכבות נוספות (מלבד הגבוהה) להצעת "סגירת כיתה" — נערך בהגדרות (מיגרציה v23)
};

export const CONSTANTS_LABELS = {
  fullClassStudentThreshold: { label: 'סף כיתה מלאה (תלמידים)', unit: 'תלמידים' },
  halfClassStudentThreshold: { label: 'סף כיתה חצי (תלמידים)', unit: 'תלמידים' },
  fullClassMinistryHours: { label: 'שעות תקן מלא (משרד)', unit: 'שעות שבועיות' },
  halfClassMinistryHours: { label: 'שעות חצי תקן (משרד)', unit: 'שעות שבועיות' },
  ministryHourlyRate: { label: 'תעריף שעה שבועית — משרד החינוך (לחודש)', unit: '₪/חודש' },
  actualWeeklyHours: { label: 'שעות בפועל לכיתה', unit: 'שעות שבועיות' },
  actualHourlyRate: { label: 'תעריף שעה שבועית — עלות בפועל (לחודש)', unit: '₪/חודש' },
  counselingHoursPerClass: { label: 'שעות ייעוץ לכיתה', unit: 'שעות שבועיות' },
  clubsMonthlyExpensePerClass: { label: 'תוספת חוגים לכיתה בחודש (0 = ללא חוגים)', unit: '₪/כיתה/חודש' },
  incomePerStudent: { label: 'הכנסה לתלמיד בשנה', unit: '₪/תלמיד/שנה' },
  incomePerStudentTalan: { label: 'תל"ן — תשלום הורה לשנה', unit: '₪/תלמיד/שנה' },
  expensePerStudent: { label: 'הוצאה לתלמיד בשנה — כולל אירועים, ערבי הורים, פיתוח מקצועי ושכפולים', unit: '₪/תלמיד/שנה' },
  professionalDevPerClass: { label: 'פיתוח מקצועי לכיתה', unit: '₪/כיתה/שנה' },
  principalMonthlySalary: { label: 'שכר מנהלת חודשי — ממלאים פעם אחת, נרשם אוטומטית בהוצאות ×12', unit: '₪/חודש' },
  incomePerStudentCaharon: { label: 'הכנסות צהרון לתלמיד', unit: '₪/תלמיד/שנה' },
  expensePerStudentCaharon: { label: 'הוצאות צהרון לתלמיד', unit: '₪/תלמיד/שנה' },
  ministryGrantPerStudent: { label: 'תוספת כללית לתלמיד — משרד החינוך (הכנסה, לא קשורה להוצאה לתלמיד)', unit: '₪/תלמיד/שנה' },
};

export const HEBREW_MONTHS = [
  'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  'ינואר', 'פברואר', 'מרץ', 'אפריל',
  'מאי', 'יוני', 'יולי', 'אוגוסט',
];

// כלל רשת: הוצאות פעילויות ואירועים עד 1,400 ₪ לתלמיד לשנה
export const EVENTS_CAP_PER_STUDENT = 1400;

// הערה קבועה שמופיעה על כל סיכום תקציב (מסך + מסמך מודפס). פירוט מה התקציב אינו כולל (שכר צהרונים,
// מזכירות, אב בית וניקיון, אחזקת מבנה, שיפוצים, ריהוט וציוד) הוסר מהמסמך
// הראשי ב-27.8.2026 לבקשת שרה — נשאר תנאי המוכש"ר בלבד.
export const SUMMARY_DISCLAIMER = 'בתנאי מוכש"ר.';

export const REQUEST_STATUS = {
  pending: { label: 'ממתין', color: 'bg-gold-100 text-gold-700', dot: 'bg-gold-500' },
  in_progress: { label: 'בביצוע', color: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  paid: { label: 'שולם', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  completed: { label: 'הושלם', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  rejected: { label: 'נדחה', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export const EXPENSE_STATUS = {
  pending: { label: 'ממתין אישור', color: 'bg-gold-100 text-gold-700' },
  approved: { label: 'מאושר', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'נדחה', color: 'bg-red-100 text-red-700' },
};

export const CLASS_TYPE = {
  full: { label: 'תקן מלא', color: 'bg-teal-100 text-teal-700' },
  half: { label: 'חצי תקן', color: 'bg-gold-100 text-gold-700' },
  none: { label: 'ללא תקן', color: 'bg-red-100 text-red-700' },
};

export const ROLES = {
  principal: { label: 'מנהלת', color: 'bg-purple-100 text-purple-700' },
  courier: { label: 'שליח', color: 'bg-teal-100 text-teal-700' },
  admin: { label: 'מנהל מערכת', color: 'bg-coral-100 text-coral-700' },
};

export const ALL_ROLES = ['principal', 'admin', 'courier'];
// VITE_COURIER_FULL_EDIT=1 בקובץ ‎.env.<slug>‎ (כיום: מזכרת בתיה) — השליח מקבל
// עריכה מלאה כמו מנהלת: כיתות, הגדרות, גבייה, משכורות. חייב ללכת יחד עם
// migration_v24 על אותו בית ספר, אחרת ה-RLS ידחה את הכתיבות בשקט.
// (import.meta.env?. — הקובץ מיובא גם מסקריפטים ב-Node, שם אין env של Vite)
const COURIER_FULL_EDIT = import.meta.env?.VITE_COURIER_FULL_EDIT === '1';
export const MANAGERS = COURIER_FULL_EDIT ? ['principal', 'admin', 'courier'] : ['principal', 'admin'];
// שאר התקציב (הכנסות + הוצאות) — בעריכת השליח; המנהלת נשארת עם "מערכת ה-1200" (כיתות/הגדרות)
export const INCOME_EXPENSE_EDITORS = ['courier', 'admin'];

// simpleMode: false ⇒ הפריט מוסתר בבתי ספר במצב "ללא תקציב"
// כל תפקיד רואה את כל המסכים (צפייה) — פעולות כתיבה מוגנות בכל דף בנפרד + ב-RLS
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'דף הבית', icon: 'LayoutDashboard', roles: ALL_ROLES, simpleMode: true },
  { id: 'classes', label: 'כיתות', icon: 'School', roles: ALL_ROLES, simpleMode: true },
  { id: 'income', label: 'הכנסות', icon: 'TrendingUp', roles: ALL_ROLES, simpleMode: true },
  { id: 'tuition', label: 'גבייה', icon: 'HandCoins', roles: ALL_ROLES, simpleMode: true },
  { id: 'expenses', label: 'הוצאות', icon: 'CreditCard', roles: ALL_ROLES, simpleMode: true },
  { id: 'courier', label: 'בקשות תשלום', icon: 'Package', roles: ALL_ROLES, simpleMode: true },
  { id: 'salaries', label: 'משכורות', icon: 'Wallet', roles: ALL_ROLES, simpleMode: true },
  { id: 'simulations', label: 'שערוך תקציב', icon: 'FlaskConical', roles: ALL_ROLES, simpleMode: false },
  { id: 'efficiency', label: 'הצעות ייעול', icon: 'Lightbulb', roles: ALL_ROLES, simpleMode: false },
  { id: 'summary', label: 'סיכום ואישור', icon: 'FileSignature', roles: ALL_ROLES, simpleMode: true },
  { id: 'reports', label: 'דוחות', icon: 'BarChart2', roles: ALL_ROLES, simpleMode: true },
  { id: 'settings', label: 'הגדרות', icon: 'Settings', roles: ALL_ROLES, simpleMode: true },
  { id: 'help', label: 'עזרה', icon: 'HelpCircle', roles: ALL_ROLES, simpleMode: true },
  { id: 'contact', label: 'יצירת קשר', icon: 'Mail', roles: ALL_ROLES, simpleMode: true },
];

export const SCHOOL_MODES = {
  full: {
    label: 'ניהול תקציב מלא',
    hint: 'חישובי תקן משרד החינוך, תקציב לכיתה, סימולציות ודוחות מלאים',
  },
  simple: {
    label: 'מעקב פשוט — ללא תקציב',
    hint: 'רישום הכנסות והוצאות, בקשות תשלום ומשכורות בלבד, בלי חישובי תקציב',
  },
};
