export const mockSchool = {
  id: 'school-1',
  name: 'שלהבות חב"ד',
  logoUrl: '/logo.png',
};

export const mockBudgetYears = [
  {
    id: 'year-2025',
    year: 2025,
    label: 'שנת תשפ"ו (2025-2026)',
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    isActive: true,
    status: 'active',
  },
  {
    id: 'year-2024',
    year: 2024,
    label: 'שנת תשפ"ה (2024-2025)',
    startDate: '2024-09-01',
    endDate: '2025-08-31',
    isActive: false,
    status: 'archived',
  },
];

export const mockClasses = [
  { id: 'c1', name: "כיתה א'1", gradeLevel: "א'", section: '1', studentCount: 23, notes: '' },
  { id: 'c2', name: "כיתה א'2", gradeLevel: "א'", section: '2', studentCount: 22, notes: '' },
  { id: 'c3', name: "כיתה ב'1", gradeLevel: "ב'", section: '1', studentCount: 15, notes: '' },
  { id: 'c4', name: "כיתה ב'2", gradeLevel: "ב'", section: '2', studentCount: 8, notes: 'כיתה קטנה' },
  { id: 'c5', name: "כיתה ג'1", gradeLevel: "ג'", section: '1', studentCount: 21, notes: '' },
  { id: 'c6', name: "כיתה ג'2", gradeLevel: "ג'", section: '2', studentCount: 18, notes: '' },
  { id: 'c7', name: "כיתה ד'1", gradeLevel: "ד'", section: '1', studentCount: 19, notes: '' },
  { id: 'c8', name: "כיתה ה'1", gradeLevel: "ה'", section: '1', studentCount: 25, notes: 'כיתה גדולה' },
];

export const mockIncomeSources = [
  { id: 'i1', name: 'תרומות ותמיכות', amount: 150000, type: 'donation', notes: 'תרומות שנתיות ממשפחות ותומכים' },
  { id: 'i2', name: 'מענק עירייה', amount: 80000, type: 'municipal', notes: 'מענק עירוני שנתי' },
  { id: 'i3', name: 'אירועי גיוס כספים', amount: 45000, type: 'events', notes: 'ערב גאלה ואירועים שנתיים' },
  { id: 'i4', name: 'תשלומי הורים נוספים', amount: 60000, type: 'parents', notes: 'תשלומים וולונטריים מעל התקן' },
];

export const mockExpenseCategories = [
  { id: 'ec1', name: 'שכר', color: 'purple' },
  { id: 'ec2', name: 'בניין ותחזוקה', color: 'teal' },
  { id: 'ec3', name: 'פעילויות שוטפות', color: 'coral' },
  { id: 'ec4', name: 'פיתוח מקצועי', color: 'gold' },
  { id: 'ec5', name: 'קיץ — תשתיות', color: 'blue' },
];

export const mockExpenses = [
  { id: 'e1', categoryId: 'ec1', name: 'שכר מנהלת', amount: 27000, period: 'monthly', status: 'approved', isRecurring: true, notes: 'שכר קבוע' },
  { id: 'e2', categoryId: 'ec1', name: 'שכר מזכירה', amount: 8500, period: 'monthly', status: 'approved', isRecurring: true, notes: '' },
  { id: 'e3', categoryId: 'ec1', name: 'שכר שרת', amount: 5500, period: 'monthly', status: 'approved', isRecurring: true, notes: '' },
  { id: 'e4', categoryId: 'ec1', name: 'שכר יועצת', amount: 6000, period: 'monthly', status: 'approved', isRecurring: true, notes: '' },
  { id: 'e5', categoryId: 'ec2', name: 'שכר דירה', amount: 15000, period: 'monthly', status: 'approved', isRecurring: true, notes: 'שכירות בניין' },
  { id: 'e6', categoryId: 'ec2', name: 'תחזוקה כללית', amount: 3000, period: 'monthly', status: 'approved', isRecurring: true, notes: '' },
  { id: 'e7', categoryId: 'ec2', name: 'ביטוח בניין', amount: 12000, period: 'yearly', status: 'approved', isRecurring: false, notes: 'ביטוח שנתי' },
  { id: 'e8', categoryId: 'ec3', name: 'חגים ואירועים', amount: 25000, period: 'yearly', status: 'pending', isRecurring: false, notes: 'תקציב לחגים' },
  { id: 'e9', categoryId: 'ec3', name: 'הדפסות וצילומים', amount: 8000, period: 'yearly', status: 'approved', isRecurring: false, notes: '' },
  { id: 'e10', categoryId: 'ec3', name: 'פעילויות תלמידים', amount: 15000, period: 'yearly', status: 'approved', isRecurring: false, notes: 'טיולים ופעילויות' },
  { id: 'e11', categoryId: 'ec3', name: 'העצמת צוות', amount: 10000, period: 'yearly', status: 'approved', isRecurring: false, notes: 'ימי עיון' },
  { id: 'e12', categoryId: 'ec3', name: 'שונות ובלתי צפוי', amount: 8000, period: 'yearly', status: 'approved', isRecurring: false, notes: '' },
  { id: 'e13', categoryId: 'ec4', name: 'פיתוח מקצועי צוות', amount: 16000, period: 'yearly', status: 'approved', isRecurring: false, notes: 'חושב אוטומטית — 2,000 × 8 כיתות' },
  { id: 'e14', categoryId: 'ec5', name: 'שפוצי קיץ', amount: 0, period: 'yearly', status: 'pending', isRecurring: false, notes: 'באוגוסט' },
  { id: 'e15', categoryId: 'ec5', name: 'ריהוט', amount: 0, period: 'yearly', status: 'pending', isRecurring: false, notes: 'באוגוסט' },
  { id: 'e16', categoryId: 'ec5', name: 'מיזוג אוויר', amount: 0, period: 'yearly', status: 'pending', isRecurring: false, notes: 'באוגוסט' },
  { id: 'e17', categoryId: 'ec5', name: 'תקשוב', amount: 0, period: 'yearly', status: 'pending', isRecurring: false, notes: 'באוגוסט' },
  { id: 'e18', categoryId: 'ec5', name: 'אחר', amount: 0, period: 'yearly', status: 'pending', isRecurring: false, notes: 'באוגוסט' },
];

export const mockExpenseRequests = [
  {
    id: 'er1',
    expenseId: 'e8',
    name: 'קניות לחנוכה',
    amount: 4500,
    status: 'pending',
    createdAt: '2025-11-15',
    assignedTo: 'u2',
    notes: 'סביבונים, שמן ומתנות לתלמידים',
    receiptUrl: null,
    paidAt: null,
  },
  {
    id: 'er2',
    expenseId: 'e5',
    name: 'שכר דירה — נובמבר 2025',
    amount: 15000,
    status: 'completed',
    createdAt: '2025-11-01',
    assignedTo: 'u2',
    notes: 'תשלום חודשי קבוע',
    receiptUrl: 'receipt-nov-rent.pdf',
    paidAt: '2025-11-03',
  },
  {
    id: 'er3',
    expenseId: 'e9',
    name: 'הדפסת חוברות חג',
    amount: 1200,
    status: 'in_progress',
    createdAt: '2025-11-20',
    assignedTo: 'u2',
    notes: 'חוברת חנוכה לכל תלמיד',
    receiptUrl: null,
    paidAt: null,
  },
  {
    id: 'er4',
    expenseId: 'e3',
    name: 'שכר שרת — נובמבר 2025',
    amount: 5500,
    status: 'paid',
    createdAt: '2025-11-01',
    assignedTo: 'u2',
    notes: '',
    receiptUrl: 'receipt-janitor-nov.pdf',
    paidAt: '2025-11-02',
  },
  {
    id: 'er5',
    expenseId: 'e10',
    name: 'טיול שנתי — כיתות ג-ד',
    amount: 8000,
    status: 'pending',
    createdAt: '2025-11-25',
    assignedTo: 'u2',
    notes: 'הפקדת מקדמה לאוטובוסים',
    receiptUrl: null,
    paidAt: null,
  },
];

export const mockUsers = {
  principal: {
    id: 'u1',
    name: 'שרה לוי',
    email: 'principal@school.edu',
    role: 'principal',
    schoolId: 'school-1',
    initials: 'של',
  },
  courier: {
    id: 'u2',
    name: 'דוד כהן',
    email: 'courier@school.edu',
    role: 'courier',
    schoolId: 'school-1',
    initials: 'דכ',
  },
  admin: {
    id: 'u3',
    name: 'משה ברק',
    email: 'admin@school.edu',
    role: 'admin',
    schoolId: 'school-1',
    initials: 'מב',
  },
};

export const mockUsersList = [
  { id: 'u1', name: 'שרה לוי', email: 'principal@school.edu', role: 'principal' },
  { id: 'u2', name: 'דוד כהן', email: 'courier@school.edu', role: 'courier' },
  { id: 'u3', name: 'משה ברק', email: 'admin@school.edu', role: 'admin' },
];
