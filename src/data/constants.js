export const DEFAULT_CONSTANTS = {
  schoolWeeks: 36,
  fullClassStudentThreshold: 21,
  halfClassStudentThreshold: 11,
  fullClassMinistryHours: 22,
  halfClassMinistryHours: 11,
  ministryHourlyRate: 400,
  actualWeeklyHours: 29,
  actualHourlyRate: 600,
  incomePerStudent: 350,
  expensePerStudent: 1400,
  professionalDevPerClass: 2000,
  principalMonthlySalary: 27000,
  incomePerStudentCaharon: 0,
  expensePerStudentCaharon: 0,
  ministryGrantPerStudent: 360,
};

export const CONSTANTS_LABELS = {
  schoolWeeks: { label: 'שבועות לימוד בשנה', unit: 'שבועות' },
  fullClassStudentThreshold: { label: 'סף כיתה מלאה (תלמידים)', unit: 'תלמידים' },
  halfClassStudentThreshold: { label: 'סף כיתה חצי (תלמידים)', unit: 'תלמידים' },
  fullClassMinistryHours: { label: 'שעות תקן מלא (משרד)', unit: 'שעות/שבוע' },
  halfClassMinistryHours: { label: 'שעות תקן חצי (משרד)', unit: 'שעות/שבוע' },
  ministryHourlyRate: { label: 'תעריף שעה — משרד החינוך', unit: '₪/שעה' },
  actualWeeklyHours: { label: 'שעות בפועל לכיתה בשבוע', unit: 'שעות/שבוע' },
  actualHourlyRate: { label: 'תעריף שעה — עלות בפועל', unit: '₪/שעה' },
  incomePerStudent: { label: 'הכנסה לתלמיד בשנה', unit: '₪/תלמיד/שנה' },
  expensePerStudent: { label: 'הוצאה לתלמיד בשנה', unit: '₪/תלמיד/שנה' },
  professionalDevPerClass: { label: 'פיתוח מקצועי לכיתה', unit: '₪/כיתה/שנה' },
  principalMonthlySalary: { label: 'שכר מנהלת חודשי', unit: '₪/חודש' },
  incomePerStudentCaharon: { label: 'הכנסות צהרון לתלמיד', unit: '₪/תלמיד/שנה' },
  expensePerStudentCaharon: { label: 'הוצאות צהרון לתלמיד', unit: '₪/תלמיד/שנה' },
  ministryGrantPerStudent: { label: 'תוספת לתלמיד — משרד החינוך', unit: '₪/תלמיד/שנה' },
};

export const HEBREW_MONTHS = [
  'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  'ינואר', 'פברואר', 'מרץ', 'אפריל',
  'מאי', 'יוני', 'יולי', 'אוגוסט',
];

export const BUDGET_YEAR_LABELS = {
  2023: 'תשפ"ד',
  2024: 'תשפ"ה',
  2025: 'תשפ"ו',
  2026: 'תשפ"ז',
  2027: 'תשפ"ח',
};

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

const ALL_ROLES = ['principal', 'admin', 'courier'];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'לוח מחוונים', icon: 'LayoutDashboard', roles: ALL_ROLES },
  { id: 'classes', label: 'כיתות', icon: 'School', roles: ALL_ROLES },
  { id: 'income', label: 'הכנסות', icon: 'TrendingUp', roles: ALL_ROLES },
  { id: 'expenses', label: 'הוצאות', icon: 'CreditCard', roles: ALL_ROLES },
  { id: 'courier', label: 'בקשות תשלום', icon: 'Package', roles: ALL_ROLES },
  { id: 'salaries', label: 'משכורות', icon: 'Wallet', roles: ALL_ROLES },
  { id: 'simulations', label: 'סימולציות', icon: 'FlaskConical', roles: ALL_ROLES },
  { id: 'reports', label: 'דוחות', icon: 'BarChart2', roles: ALL_ROLES },
  { id: 'settings', label: 'הגדרות', icon: 'Settings', roles: ALL_ROLES },
  { id: 'help', label: 'עזרה', icon: 'HelpCircle', roles: ALL_ROLES },
];
