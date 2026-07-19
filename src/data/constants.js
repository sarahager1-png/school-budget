// השעות הן חודשיות והתשלום 12 חודשים בשנה.
// כיתה מלאה: 22 שעות חודשיות × 400 ₪ = 8,800 ₪ בחודש = 105,600 ₪ בשנה.
export const PAYMENT_MONTHS = 12;

// שכר אופק חדש קובע את תעריף עלות ההוראה בפועל: כן = 600 ₪/שעה, לא = 400 ₪/שעה.
// ofekSalary === null ⇒ טרם נענתה — המערכת שואלת בדף הבית עד שעונים.
export const OFEK_RATES = { yes: 600, no: 400 };

export const DEFAULT_CONSTANTS = {
  schoolWeeks: 36, // legacy — לא משתתף בחישוב (הוחלף במודל החודשי); נשמר כי העמודה קיימת ב-DB
  fullClassStudentThreshold: 21,
  halfClassStudentThreshold: 11,
  fullClassMinistryHours: 22,
  halfClassMinistryHours: 11,
  ministryHourlyRate: 400,
  actualWeeklyHours: 34,
  actualHourlyRate: 600,
  ofekSalary: null,
  incomePerStudent: 350,
  incomePerStudentTalan: 885,
  expensePerStudent: 1200,
  professionalDevPerClass: 0, // פיתוח מקצועי נכלל בהוצאה לתלמיד (1,200) — נשאר כקבוע למי שצריך בנפרד
  principalMonthlySalary: 27000,
  incomePerStudentCaharon: 0,
  expensePerStudentCaharon: 0,
  ministryGrantPerStudent: 370,
};

export const CONSTANTS_LABELS = {
  fullClassStudentThreshold: { label: 'סף כיתה מלאה (תלמידים)', unit: 'תלמידים' },
  halfClassStudentThreshold: { label: 'סף כיתה חצי (תלמידים)', unit: 'תלמידים' },
  fullClassMinistryHours: { label: 'שעות תקן מלא (משרד)', unit: 'שעות/חודש' },
  halfClassMinistryHours: { label: 'שעות תקן חצי (משרד)', unit: 'שעות/חודש' },
  ministryHourlyRate: { label: 'תעריף שעה — משרד החינוך', unit: '₪/שעה' },
  actualWeeklyHours: { label: 'שעות בפועל לכיתה בחודש', unit: 'שעות/חודש' },
  actualHourlyRate: { label: 'תעריף שעה — עלות בפועל', unit: '₪/שעה' },
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
  half: { label: 'תקן חצי', color: 'bg-gold-100 text-gold-700' },
  none: { label: 'ללא תקן', color: 'bg-red-100 text-red-700' },
};

export const ROLES = {
  principal: { label: 'מנהלת', color: 'bg-purple-100 text-purple-700' },
  courier: { label: 'שליח', color: 'bg-teal-100 text-teal-700' },
  admin: { label: 'מנהל מערכת', color: 'bg-coral-100 text-coral-700' },
};

export const ALL_ROLES = ['principal', 'admin', 'courier'];
export const MANAGERS = ['principal', 'admin'];

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
  { id: 'reports', label: 'דוחות', icon: 'BarChart2', roles: ALL_ROLES, simpleMode: true },
  { id: 'settings', label: 'הגדרות', icon: 'Settings', roles: ALL_ROLES, simpleMode: true },
  { id: 'help', label: 'עזרה', icon: 'HelpCircle', roles: ALL_ROLES, simpleMode: true },
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
