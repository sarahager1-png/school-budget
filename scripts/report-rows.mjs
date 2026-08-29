// שורות הסעיפים של המסמך המרכז — מקור אחד לשני הצדדים:
// build-school-report.mjs מייבא מכאן כדי לבדוק שהסעיפים מסתכמים לסה"כ,
// ואותו קובץ עצמו מוטמע לתוך המסמך כדי שהשורות יצוירו מחדש בכל שינוי.
//
// אין כאן חישוב תקציבי — הסכומים מגיעים מהמנוע (calculations.js). כאן רק
// ההחלטה אילו שורות מוצגות, איך הן מנוסחות, ואיזו מהן ניתנת לעריכה.
import { annualAmount, categoryTotals } from '../src/lib/calculations.js';
import { PAYMENT_MONTHS, TUITION_COLLECTION_RATE, CLUBS_MONTHS } from '../src/data/constants.js';

export const nis = (n) => '₪' + Math.round(Number(n) || 0).toLocaleString('he-IL');

// כל שורה: { label, value }
//   incomeIndex / expenseIndex — סעיף ידני שאפשר לערוך ולהסיר במסמך
//   items — פירוט הפריטים בתוך קטגוריית הוצאה
export function rowsIncome(d, t) {
  if (d.mode === 'simple') {
    return d.incomeSources.map((s, i) => ({ label: s.name, value: s.amount, incomeIndex: i }));
  }
  const n = t.totalStudents;
  const c = d.constants;
  const pct = Math.round(TUITION_COLLECTION_RATE * 100);
  const derived = [
    { label: `שעות תקן — משרד החינוך (${d.classes.length} כיתות · ${nis(c.ministryHourlyRate)} לשעה · ${PAYMENT_MONTHS} חודשים)`, value: t.totalMinistryIncome },
    { label: `תוספת כללית לתלמיד — משרד החינוך (${n} תלמידים × ${nis(c.ministryGrantPerStudent)})`, value: t.totalMinistryGrantIncome },
    { label: `שכר לימוד (${n} × ${nis(c.incomePerStudent)} × ${pct}% גבייה)`, value: t.totalStudentIncome },
    { label: `תל"ן — תשלומי הורים (${n} × ${nis(c.incomePerStudentTalan)} × ${pct}% גבייה)`, value: t.totalTalanIncome },
  ].filter(r => Math.round(r.value) !== 0);

  return derived.concat(d.incomeSources.map((s, i) => ({ label: s.name, value: s.amount, incomeIndex: i })));
}

// שכר מנהלת מוצג בשמו ומנוכה מהקטגוריה שהוא רשום בה — כמו במסך הסיכום.
export function rowsExpense(d, t) {
  // במעקב פשוט אין שורות נגזרות, ולכן שכר המנהלת אינו מוצג בנפרד — הוא
  // נשאר פריט רגיל בתוך קטגוריית השכר. בלי זה הוא נספר בסה"כ ולא הוצג באף
  // שורה, והטור לא הסתכם.
  const principal = d.mode === 'simple' ? null : d.expenses.find(e => e.name === 'שכר מנהלת');
  const principalAnnual = principal ? annualAmount(principal) : 0;
  const c = d.constants;
  const rows = [];

  if (d.mode !== 'simple') {
    rows.push({ label: `עלות הוראה בפועל (${d.classes.length} כיתות · ${c.actualWeeklyHours} ש׳ בחודש · ${nis(c.actualHourlyRate)} לשעה · ${PAYMENT_MONTHS} חודשים)`, value: t.totalClassActualCost });
    rows.push({ label: `ייעוץ (${d.classes.length} כיתות · ${c.counselingHoursPerClass} ש׳ בחודש · ${nis(c.actualHourlyRate)} לשעה)`, value: t.totalCounselingCost });
    rows.push({ label: `תוספת חוגים (${d.classes.length} כיתות · ${nis(c.clubsMonthlyExpensePerClass)} לחודש · ${CLUBS_MONTHS} חודשים)`, value: t.totalClubsExpense });
    rows.push({ label: `הוצאה לתלמיד (${t.totalStudents} × ${nis(c.expensePerStudent)})`, value: t.totalStudentExpenses });
    if (t.totalProfDev > 0) {
      rows.push({ label: `פיתוח מקצועי (${d.classes.length} כיתות × ${nis(c.professionalDevPerClass)})`, value: t.totalProfDev });
    }
    if (principalAnnual > 0) {
      rows.push({
        label: `שכר מנהלת (${nis(principal.period === 'monthly' ? principal.amount : principal.amount / 12)} לחודש)`,
        value: principalAnnual,
        expenseIndex: d.expenses.indexOf(principal),
      });
    }
  }

  for (const cat of categoryTotals(d.expenses, d.categories)) {
    if (cat.kind === 'profdev' && d.mode !== 'simple') continue; // כבר נספר פר כיתה
    const value = principal && cat.id === principal.categoryId ? cat.value - principalAnnual : cat.value;
    if (Math.round(value) <= 0) continue;
    const items = d.expenses
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.categoryId === cat.id && e !== principal)
      .map(({ e, i }) => ({
        label: e.name + (e.period === 'monthly' ? ` (${nis(e.amount)} לחודש)` : ''),
        value: annualAmount(e),
        expenseIndex: i,
      }));
    rows.push({ label: cat.name, value, items });
  }
  return rows;
}

export const sumRows = (rows) => rows.reduce((n, r) => n + (Number(r.value) || 0), 0);
