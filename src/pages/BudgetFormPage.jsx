import { createContext, useContext, useMemo, useState } from 'react';
import {
  ClipboardList, Plus, Edit2, Trash2, Printer, GraduationCap, TrendingUp, Users,
  Building2, UserCog, CreditCard, ArrowLeft, Lightbulb, FileSignature, Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import {
  calculateSchoolTotals, calculateSimpleTotals, annualAmount, formatCurrency,
} from '../lib/calculations.js';
import { kindMap } from '../lib/categoryKinds.js';
import {
  MANAGERS, INCOME_EXPENSE_EDITORS, PAYMENT_MONTHS, TUITION_COLLECTION_RATE, CLUBS_MONTHS,
  CLASS_TYPE, ofekMode, ofekBlendedRate,
} from '../data/constants.js';
import { ExpenseModal } from './ExpensesPage.jsx';
import { IncomeModal } from './IncomePage.jsx';
import { ClassModal } from './ClassesPage.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import Modal from '../components/ui/Modal.jsx';
import { useBudgetClosed } from '../lib/useBudgetClosed.js';

// ── "טופס תקציב" — מסמך מילוי אחד, מחולק לפי החלוקה של שרה (25.9.26):
//   1 עלות הוראה · 2 הכנסות · 3 הורים (תשלומי הורים מול 1,200 ₪ לתלמיד)
//   4 תשתית ותחזוקה · 5 שכר נוסף (אב בית, מזכירה, ניקיון) · 6 הוצאות אחרות
// כל שורה שממלאים כאן נשמרת באותן טבלאות שכל שאר המסכים קוראים
// (classes / financial_constants / income_sources / expenses) — אין עותק שני.
// הטופס גם "נוח לצפייה": מי שאינו עורך רואה את אותו מסמך בלי כפתורים, והדפסה
// מוציאה אותו כמסמך נקי.

// שורות מוצעות למילוי — מופיעות כשורות ריקות עד שממלאים אותן (לפי שם + סוג קטגוריה)
const TEMPLATES = {
  building: [
    { name: 'שכר דירה', period: 'monthly' },
    { name: 'חשמל', period: 'monthly' },
    { name: 'מים', period: 'monthly' },
    { name: 'ארנונה', period: 'monthly' },
    { name: 'ביטוח מבנה ותכולה', period: 'yearly' },
    { name: 'אחזקה שוטפת ותיקונים', period: 'monthly' },
    { name: 'שיפוצים', period: 'yearly' },
  ],
  equipment: [
    { name: 'ריהוט', period: 'yearly' },
    { name: 'מחשבים וציוד טכנולוגי', period: 'yearly' },
    { name: 'ציוד לימודי', period: 'yearly' },
  ],
  salary: [
    { name: 'אב בית', period: 'monthly' },
    { name: 'מזכירה', period: 'monthly' },
    { name: 'ניקיון', period: 'monthly' },
    { name: 'סייעת', period: 'monthly' },
  ],
  events: [
    { name: 'הזנה', period: 'monthly' },
    { name: 'אירועים וטיולים', period: 'yearly' },
    { name: 'פעילות חינוכית', period: 'yearly' },
  ],
  other: [
    { name: 'שכפולים והדפסות', period: 'monthly' },
    { name: 'הנהלת חשבונות', period: 'monthly' },
    { name: 'תקשורת ואינטרנט', period: 'monthly' },
  ],
};

const INCOME_TEMPLATES = [
  { name: 'השתתפות עירייה / רשות', type: 'municipal' },
  { name: 'תרומות', type: 'donation' },
  { name: 'הכנסות מאירועים', type: 'events' },
];

const PARENT_INCOME_TEMPLATES = [
  { name: 'תשלומי הורים נוספים (טיולים, חוגים)', type: 'parents' },
];

// פריטים שההורים משלמים עליהם חלקית ובית הספר מכסה את הפער (שרה 25.9:
// "פער השאלת ספרים, הסעות לתלמידים"). כל פריט = שורת הכנסה (type=parents)
// + שורת הוצאה, והטופס מציג את הפער ביניהן. השמות קבועים כדי לזהות את הזוג.
const PARENT_ITEMS = [
  { label: 'השאלת ספרים', period: 'yearly', hint: 'תשלומי ההורים על השאלת ספרים מול עלות הספרים' },
  { label: 'הסעות לתלמידים', period: 'monthly', hint: 'השתתפות ההורים בהסעות מול עלות ההסעות' },
];
const PRINCIPAL_NAME = 'שכר מנהלת';
const parentIncomeName = (it) => `${it.label} — תשלומי הורים`;
const parentExpenseName = (it) => `${it.label} — עלות`;
const PARENT_ITEM_NAMES = new Set(PARENT_ITEMS.flatMap(it => [parentIncomeName(it), parentExpenseName(it)]));

function Section({ num, icon: Icon, title, hint, total, totalLabel = 'סה״כ', totalNegative = false, tone = 'purple', children }) {
  const tones = {
    purple: 'bg-purple-500', teal: 'bg-teal-600', gold: 'bg-gold-600', coral: 'bg-coral-600', gray: 'bg-gray-600',
  };
  return (
    <section className="card p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex-wrap">
        <span className={`w-9 h-9 rounded-xl ${tones[tone]} text-white flex items-center justify-center flex-shrink-0`}>
          <Icon size={17} />
        </span>
        <div className="flex-1 min-w-[160px]">
          <h3 className="font-bold text-gray-800 text-base leading-tight">{num}. {title}</h3>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        {total !== undefined && (
          <div className="text-left">
            <p className="text-xs text-gray-500">{totalLabel}</p>
            <p className={`font-black text-lg leading-tight ${totalNegative ? "text-coral-700" : "text-gray-800"}`}>{formatCurrency(Math.abs(total))}</p>
          </div>
        )}
      </div>
      <div className="px-4 sm:px-5 py-2">{children}</div>
    </section>
  );
}

// כשלמשתמש/ת יש הרשאת עריכה, לכל שורה יש עמודת פעולות ברוחב קבוע — גם לשורות
// בלי כפתורים — כדי שטור הסכומים יישאר ישר (ממצא ביקורת 25.9)
const SlotCtx = createContext(false);

// שורה אחת בטופס: שם · בסיס החישוב · סכום שנתי · פעולות
function Row({ name, basis, annual, monthly, auto, negative, onEdit, onDelete, muted }) {
  const slot = useContext(SlotCtx);
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 print:break-inside-avoid ${muted ? 'text-gray-500' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-snug">
          {name}
          {auto && <span className="badge bg-teal-50 text-teal-700 ms-2 align-middle">מחושב</span>}
        </p>
        {basis && <p className="text-xs text-gray-500 leading-snug">{basis}</p>}
      </div>
      <div className="text-left flex-shrink-0 w-[112px]">
        <p className={`font-bold text-sm ${negative ? 'text-coral-700' : 'text-gray-800'}`}>{formatCurrency(annual)}</p>
        {monthly !== undefined && monthly > 0 && <p className="text-[11px] text-gray-400">{formatCurrency(monthly)} לחודש</p>}
      </div>
      {(slot || onEdit || onDelete) && (
        <div className="flex gap-2 md:gap-1 flex-shrink-0 justify-end w-[96px] md:w-[80px] print:hidden">
          {onEdit && (
            <button type="button" onClick={onEdit} aria-label={`עריכת ${name}`} className="w-11 h-11 md:w-9 md:h-9 rounded-lg hover:bg-purple-50 text-gray-500 hover:text-purple-600 flex items-center justify-center">
              <Edit2 size={15} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label={`מחיקת ${name}`} className="w-11 h-11 md:w-9 md:h-9 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 flex items-center justify-center">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// שורה ריקה למילוי — שם מוכן, לוחצים ומזינים סכום
function BlankRow({ name, onFill, canEdit }) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      onClick={onFill}
      className="w-full flex items-center gap-3 py-2 min-h-[44px] md:min-h-0 border-b border-dashed border-gray-200 last:border-0 text-right hover:bg-purple-50/50 rounded-lg px-1 print:hidden"
    >
      <span className="flex-1 text-sm text-gray-400">{name}</span>
      <span className="text-xs text-purple-600 font-medium flex items-center gap-1"><Plus size={13} /> מילוי סכום</span>
    </button>
  );
}

function AddButton({ label, onClick, canEdit }) {
  if (!canEdit) return null;
  return (
    <button type="button" onClick={onClick} className="btn-outline btn-sm min-h-[44px] md:min-h-0 mt-2 mb-1 print:hidden">
      <Plus size={14} /> {label}
    </button>
  );
}

function Subtotal({ label, value, negative, strong }) {
  const slot = useContext(SlotCtx);
  return (
    <div className={`flex items-center gap-3 py-2 ${strong ? 'border-t-2 border-gray-200 mt-1' : 'border-t border-gray-100'}`}>
      <span className={`flex-1 text-sm ${strong ? 'font-bold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`w-[112px] text-left font-black ${strong ? 'text-base' : 'text-sm'} ${negative ? 'text-coral-700' : 'text-gray-800'}`}>{formatCurrency(value)}</span>
      {slot && <span className="w-[96px] md:w-[80px] flex-shrink-0 print:hidden" aria-hidden="true" />}
    </div>
  );
}

// עריכת מספר בודד מהקבועים (שכר מנהלת, סכומים לתלמיד) — מודאל קטן
function NumberModal({ title, label, unit, value, onSave, onClose, hint }) {
  const [v, setV] = useState(value ?? '');
  const [err, setErr] = useState('');
  const save = () => {
    if (String(v).trim() === '') return setErr('חסר מספר');
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return setErr('חסר מספר תקין');
    onSave(n);
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-sm">
      {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{err}</div>}
      <label className="label" htmlFor="budget-number-input">{label} ({unit})</label>
      <input id="budget-number-input" className="input" type="number" inputMode="numeric" min="0" value={v} onChange={e => setV(e.target.value)} />
      {hint && <p className="text-xs text-gray-400 mt-2">{hint}</p>}
      <div className="flex gap-3 mt-6">
        <button type="button" onClick={save} className="btn-primary flex-1 justify-center">שמור</button>
        <button type="button" onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}

export default function BudgetFormPage() {
  const {
    classes, incomeSources, expenses, expenseCategories, constants, setConstants,
    addClass, updateClass, deleteClass,
    addIncomeSource, updateIncomeSource, deleteIncomeSource,
    addExpense, updateExpense, deleteExpense,
    isSimpleMode, user, school, currentYear, navigate, notify,
  } = useApp();

  const { closed } = useBudgetClosed(user?.schoolId, currentYear?.id);
  const isManager = MANAGERS.includes(user?.role);
  const canEditClasses = isManager && !closed;
  const canEditMoney = INCOME_EXPENSE_EDITORS.includes(user?.role) && !closed;
  const canEditConstants = isManager && !closed;
  const anyEdit = canEditClasses || canEditMoney;

  const [modal, setModal] = useState(null); // { kind: 'class'|'income'|'expense'|'number', ... }
  const [confirm, setConfirm] = useState(null);

  const kinds = useMemo(() => kindMap(expenseCategories), [expenseCategories]);
  const catByKind = (kind) => expenseCategories.find(c => (kinds[c.id] || c.kind) === kind);
  const principalRow = expenses.find(e => e.name === PRINCIPAL_NAME);
  const expensesOfKind = (kind) => expenses.filter(e => kinds[e.categoryId] === kind && e.id !== principalRow?.id);

  const totals = useMemo(() => (isSimpleMode
    ? calculateSimpleTotals(incomeSources, expenses)
    : calculateSchoolTotals(classes, incomeSources, expenses, constants, expenseCategories)),
  [isSimpleMode, classes, incomeSources, expenses, constants, expenseCategories]);

  const totalStudents = classes.reduce((s, c) => s + (c.studentCount || 0), 0);
  // כמו דף הבית והסיכום: נספר רק מה שרשום בפועל כהוצאה. הקבוע לבדו הוא רמז.
  const principalAnnual = principalRow ? annualAmount(principalRow) : 0;
  const principalPending = !principalRow && Number(constants.principalMonthlySalary) > 0;

  // ── חלוקת ההכנסות: הורים לחוד ──
  const parentSources = incomeSources.filter(s => s.type === 'parents');
  const otherSources = incomeSources.filter(s => s.type !== 'parents');
  const parentManual = parentSources.reduce((s, x) => s + (x.amount || 0), 0);
  const otherManual = otherSources.reduce((s, x) => s + (x.amount || 0), 0);
  // זוגות הכנסה/הוצאה של השאלת ספרים והסעות — מוצגים בסעיף ההורים בלבד
  const parentGeneralSources = parentSources.filter(s => !PARENT_ITEM_NAMES.has(s.name));
  const parentItemExpenses = expenses.filter(e => PARENT_ITEM_NAMES.has(e.name));
  const parentItemExpenseTotal = parentItemExpenses.reduce((s, e) => s + annualAmount(e), 0);
  const notParentItem = (e) => !PARENT_ITEM_NAMES.has(e.name);

  // ── שכר נוסף: כל השכר חוץ משכר המנהלת (היא בעלות ההוראה) ──
  const salaryRows = (isSimpleMode ? expenses.filter(e => kinds[e.categoryId] === 'salary') : expensesOfKind('salary')).filter(notParentItem);
  const salaryTotal = salaryRows.reduce((s, e) => s + annualAmount(e), 0);
  const buildingRows = expensesOfKind('building').filter(notParentItem);
  const equipmentRows = expensesOfKind('equipment').filter(notParentItem);
  const infraTotal = [...buildingRows, ...equipmentRows].reduce((s, e) => s + annualAmount(e), 0);
  const eventsRows = expensesOfKind('events').filter(notParentItem);
  const otherRows = expensesOfKind('other').filter(notParentItem);
  const profdevRows = expensesOfKind('profdev');
  // במצב מלא פיתוח מקצועי מחושב לכיתה (totalProfDev) ושורות profdev לא נספרות; במצב פשוט כל שורה נספרת
  const otherTotal = [...eventsRows, ...otherRows, ...(isSimpleMode ? profdevRows : [])].reduce((s, e) => s + annualAmount(e), 0);

  // ── עלות הוראה ──
  const teaching = !isSimpleMode ? {
    classCost: totals.totalClassActualCost,
    counseling: totals.totalCounselingCost,
    clubs: totals.totalClubsExpense,
    profDev: totals.totalProfDev,
  } : null;
  // תואם בדיוק ל-calculateSchoolTotals: הוראה + ייעוץ + חוגים + פיתוח מקצועי לכיתה + שורת שכר מנהלת
  const teachingTotal = teaching ? teaching.classCost + teaching.counseling + teaching.clubs + teaching.profDev + principalAnnual : 0;

  const mode = ofekMode(constants);
  const rateLabel = mode === 'mixed'
    ? `ממוצע משוקלל ${ofekBlendedRate(constants)} ₪ לשעה (חלק באופק, חלק בעולם הישן)`
    : mode === true ? `אופק חדש — ${constants.actualHourlyRate} ₪ לשעה`
      : mode === false ? `עולם ישן — ${constants.actualHourlyRate} ₪ לשעה`
        : 'שאלת אופק חדש עדיין לא נענתה';

  // ── הורים ──
  const parentsIncome = !isSimpleMode ? totals.totalStudentIncome + totals.totalTalanIncome + parentManual : parentManual;
  const parentsExpense = (!isSimpleMode ? totals.totalStudentExpenses : 0) + parentItemExpenseTotal;

  // ── הכנסות (בלי הורים) ──
  const incomeTotal = !isSimpleMode ? totals.totalMinistryIncome + totals.totalMinistryGrantIncome + otherManual : totals.totalIncome;
  // במצב פשוט אין סעיף הורים — כל המקורות מוצגים בסעיף ההכנסות
  const shownSources = isSimpleMode ? incomeSources : otherSources;

  const open = (m) => setModal(m);
  const close = () => setModal(null);

  const expenseTemplate = (kind, t) => {
    const cat = catByKind(kind);
    if (!cat) return;
    open({ kind: 'expense', exp: { name: t.name, categoryId: cat.id, period: t.period, status: 'approved', isRecurring: t.period === 'monthly' } });
  };
  const hasRow = (rows, name) => rows.some(r => r.name === name);

  const saveNumber = (key) => (n) => {
    if (key === 'principalMonthlySalary' && n === 0 && principalRow) return deleteExpense(principalRow.id); // מאפס גם את הקבוע
    return setConstants({ ...constants, [key]: n });
  };
  // שליח לא יוצר ולא משנה שם ל'שכר מנהלת' — השורה הזאת מסונכרנת מההגדרות ושמורה למנהלת
  const guardExpense = (data, run) => {
    if ((data.name || '').trim() === PRINCIPAL_NAME && !isManager) return notify('שכר מנהלת נערך רק בסעיף עלות הוראה על ידי המנהלת', 'error');
    return run(data);
  };

  const nis = (v) => formatCurrency(v);
  const yearLabel = currentYear?.label || currentYear?.name || '';

  return (
    <SlotCtx.Provider value={anyEdit}>
    <div className="space-y-5 max-w-3xl">
      {/* כותרת להדפסה בלבד — ב"ה ולוגו (סרגל האפליקציה מוסתר בהדפסה) */}
      <div className="hidden print:flex items-center justify-between border-b border-gray-200 pb-2">
        <span className="font-bold text-sm">ב"ה</span>
        <img src={import.meta.env?.VITE_LOGO || '/logo.png'} alt="" className="h-9" />
      </div>
      {/* כותרת */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-purple-600" /> טופס תקציב
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {school?.name}{yearLabel ? ` · ${yearLabel}` : ''} — כל התקציב בדף אחד, סעיף אחר סעיף.
            <span className="print:hidden">{anyEdit ? ' ממלאים כאן, והמספרים מתעדכנים בכל המסכים.' : ' תצוגה בלבד.'}</span>
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-outline btn-sm min-h-[44px] md:min-h-0 print:hidden">
          <Printer size={14} /> הדפסה / PDF
        </button>
      </div>

      {closed && (
        <div className="rounded-xl bg-gold-50 border border-gold-200 px-4 py-3 text-sm text-gold-800 print:hidden">
          התקציב נשמר ונעול. שינוי במספרים נעשה רק אחרי פתיחה מחדש על ידי מנהלת המערכת ברשת.
        </div>
      )}

      {/* 1 · עלות הוראה */}
      {!isSimpleMode && (
        <Section num={1} icon={GraduationCap} title="עלות הוראה" tone="purple" total={teachingTotal}
          hint="הכיתות, שעות ההוראה, הייעוץ, החוגים ושכר המנהלת">
          <div className="py-2 border-b border-gray-50">
            <p className="text-xs text-gray-500">
              תעריף השעה: <span className="font-medium text-gray-700">{rateLabel}</span>
              {' · '}{constants.actualWeeklyHours} שעות לכיתה בחודש × תעריף × {PAYMENT_MONTHS} חודשים
            </p>
          </div>
          {totals.classBreakdowns.map(c => (
            <Row
              key={c.id}
              name={`${c.name}${c.gradeLevel ? ` · שכבה ${c.gradeLevel}` : ''}`}
              basis={`${c.studentCount} תלמידים · ${CLASS_TYPE[c.budget.type].label} · תקן משרד ${nis(c.budget.ministryIncome)}${c.extraHours ? ` · ${c.extraHours} שעות בודדות (בפירוט הכיתה)` : ''}`}
              annual={c.budget.actualOperatingCost}
              monthly={c.budget.actualMonthlyCost}
              onEdit={canEditClasses ? () => open({ kind: 'class', cls: c }) : undefined}
              onDelete={canEditClasses ? () => setConfirm({ msg: `למחוק את ${c.name}?`, run: () => deleteClass(c.id) }) : undefined}
            />
          ))}
          {classes.length === 0 && <p className="text-sm text-gray-400 py-3 print:hidden">עדיין אין כיתות. מוסיפים כיתה אחת לכל קבוצת לימוד, בנים ובנות בנפרד.</p>}
          <AddButton label="הוספת כיתה" canEdit={canEditClasses} onClick={() => open({ kind: 'class' })} />
          <Row name="ייעוץ" auto basis={`${constants.counselingHoursPerClass} שעות לכיתה בחודש × ${classes.length} כיתות`} annual={teaching.counseling} />
          {teaching.clubs > 0 && (
            <Row name="חוגים" auto basis={`${nis(constants.clubsMonthlyExpensePerClass)} לכיתה × ${classes.length} כיתות × ${CLUBS_MONTHS} חודשים`} annual={teaching.clubs} />
          )}
          {teaching.profDev > 0 && (
            <Row name="פיתוח מקצועי" auto basis={`${nis(constants.professionalDevPerClass)} לכיתה × ${classes.length} כיתות`} annual={teaching.profDev} />
          )}
          <Row
            name="שכר מנהלת"
            basis={principalRow ? `${nis(principalRow.amount)} ברוטו לחודש × 12` : principalPending ? `בהגדרות ${nis(constants.principalMonthlySalary)} לחודש, עדיין לא נרשם כהוצאה — לשמור מחדש` : 'לא הוזן'}
            annual={principalAnnual}
            onEdit={canEditConstants ? () => open({ kind: 'number', key: 'principalMonthlySalary', title: 'שכר מנהלת', label: 'ברוטו לחודש', unit: '₪', value: principalRow?.amount ?? constants.principalMonthlySalary, hint: 'נרשם אוטומטית כהוצאה חודשית ×12. אפס = מחיקת השורה.' }) : undefined}
          />
          <Subtotal label="סה״כ עלות הוראה" value={teachingTotal} strong />
        </Section>
      )}

      {/* 2 · הכנסות */}
      <Section num={isSimpleMode ? 1 : 2} icon={TrendingUp} title="הכנסות" tone="teal" total={incomeTotal}
        hint={isSimpleMode ? 'כל מקורות ההכנסה' : 'משרד החינוך (מחושב מהכיתות) ומקורות נוספים. תשלומי הורים בסעיף הבא.'}>
        {!isSimpleMode && (
          <>
            <Row name="תקן שעות משרד החינוך" auto basis={`${totals.classBreakdowns.filter(c => c.budget.type === 'full').length} כיתות מלאות · ${totals.classBreakdowns.filter(c => c.budget.type === 'half').length} בחצי תקן · ${constants.ministryHourlyRate} ₪ לשעה × 12`} annual={totals.totalMinistryIncome} />
            <Row name="תוספת כללית משרד החינוך" auto basis={`${nis(constants.ministryGrantPerStudent)} לתלמיד × ${totalStudents} תלמידים`} annual={totals.totalMinistryGrantIncome} />
          </>
        )}
        {shownSources.map(s => (
          <Row key={s.id} name={s.name} basis={s.notes || undefined} annual={s.amount}
            onEdit={canEditMoney ? () => open({ kind: 'income', src: s }) : undefined}
            onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${s.name}"?`, run: () => deleteIncomeSource(s.id) }) : undefined} />
        ))}
        {INCOME_TEMPLATES.filter(t => !hasRow(shownSources, t.name)).map(t => (
          <BlankRow key={t.name} name={t.name} canEdit={canEditMoney} onFill={() => open({ kind: 'income', src: { name: t.name, type: t.type } })} />
        ))}
        <AddButton label="הוספת מקור הכנסה" canEdit={canEditMoney} onClick={() => open({ kind: 'income' })} />
        <Subtotal label={isSimpleMode ? 'סה״כ הכנסות' : 'סה״כ הכנסות (בלי הורים)'} value={incomeTotal} strong />
      </Section>

      {/* 3 · הורים */}
      {!isSimpleMode && (
        <Section num={3} icon={Users} title="הורים — תשלומי הורים מול ההוצאה לתלמיד, השאלת ספרים והסעות" tone="gold"
          total={parentsIncome - parentsExpense} totalLabel={parentsIncome - parentsExpense < 0 ? "פער" : "יתרה"} totalNegative={parentsIncome - parentsExpense < 0}
          hint={`${totalStudents} תלמידים · הגבייה נספרת ב-${Math.round(TUITION_COLLECTION_RATE * 100)}% (לא כל ההורים משלמים במלואם)`}>
          <p className="text-xs font-bold text-gray-500 pt-2">הכנסות מהורים</p>
          <Row name="שכר לימוד" auto basis={`${nis(constants.incomePerStudent)} לתלמיד × ${totalStudents} × ${Math.round(TUITION_COLLECTION_RATE * 100)}%`} annual={totals.totalStudentIncome}
            onEdit={canEditConstants ? () => open({ kind: 'number', key: 'incomePerStudent', title: 'שכר לימוד לתלמיד', label: 'לתלמיד לשנה', unit: '₪', value: constants.incomePerStudent }) : undefined} />
          <Row name='תל"ן' auto basis={`${nis(constants.incomePerStudentTalan)} לתלמיד × ${totalStudents} × ${Math.round(TUITION_COLLECTION_RATE * 100)}%`} annual={totals.totalTalanIncome}
            onEdit={canEditConstants ? () => open({ kind: 'number', key: 'incomePerStudentTalan', title: 'תל"ן לתלמיד', label: 'לתלמיד לשנה', unit: '₪', value: constants.incomePerStudentTalan }) : undefined} />
          {parentGeneralSources.map(s => (
            <Row key={s.id} name={s.name} basis={s.notes || undefined} annual={s.amount}
              onEdit={canEditMoney ? () => open({ kind: 'income', src: s }) : undefined}
              onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${s.name}"?`, run: () => deleteIncomeSource(s.id) }) : undefined} />
          ))}
          {PARENT_INCOME_TEMPLATES.filter(t => !hasRow(parentGeneralSources, t.name)).map(t => (
            <BlankRow key={t.name} name={t.name} canEdit={canEditMoney} onFill={() => open({ kind: 'income', src: { name: t.name, type: t.type } })} />
          ))}
          <p className="text-xs font-bold text-gray-500 pt-3">הוצאה לתלמיד</p>
          <Row name="הוצאה לתלמיד" auto negative basis={`${nis(constants.expensePerStudent)} לתלמיד × ${totalStudents} · כולל אירועים, ערבי הורים, פיתוח מקצועי ושכפולים`} annual={totals.totalStudentExpenses}
            onEdit={canEditConstants ? () => open({ kind: 'number', key: 'expensePerStudent', title: 'הוצאה לתלמיד', label: 'לתלמיד לשנה', unit: '₪', value: constants.expensePerStudent }) : undefined} />
          <Subtotal label={totals.totalStudentExpenses <= totals.totalStudentIncome + totals.totalTalanIncome + parentGeneralSources.reduce((s, x) => s + (x.amount || 0), 0) ? 'יתרה — שכר הלימוד ותל"ן מכסים את ההוצאה לתלמיד' : 'פער — ההוצאה לתלמיד גבוהה משכר הלימוד ותל"ן'}
            value={totals.totalStudentIncome + totals.totalTalanIncome + parentGeneralSources.reduce((s, x) => s + (x.amount || 0), 0) - totals.totalStudentExpenses}
            negative={totals.totalStudentExpenses > totals.totalStudentIncome + totals.totalTalanIncome + parentGeneralSources.reduce((s, x) => s + (x.amount || 0), 0)} />
          {totalStudents > 0 && (
            <p className="text-xs text-gray-400 pb-1">לתלמיד: הכנסה {nis(Math.round((totals.totalStudentIncome + totals.totalTalanIncome) / totalStudents))} מול הוצאה {nis(constants.expensePerStudent)}</p>
          )}

          {PARENT_ITEMS.map(it => {
            const inc = parentSources.find(s => s.name === parentIncomeName(it));
            const exp = expenses.find(e => e.name === parentExpenseName(it));
            const incAmt = inc?.amount || 0;
            const expAmt = exp ? annualAmount(exp) : 0;
            const gap = incAmt - expAmt;
            return (
              <div key={it.label} className="mt-2">
                <p className="text-xs font-bold text-gray-500 pt-3">{it.label}</p>
                <p className="text-xs text-gray-500 -mt-0.5">{it.hint}</p>
                {inc ? (
                  <Row name="תשלומי הורים" basis={inc.notes || 'הכנסה'} annual={incAmt}
                    onEdit={canEditMoney ? () => open({ kind: 'income', src: inc }) : undefined}
                    onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${inc.name}"?`, run: () => deleteIncomeSource(inc.id) }) : undefined} />
                ) : (
                  <BlankRow name={`תשלומי הורים — ${it.label}`} canEdit={canEditMoney} onFill={() => open({ kind: 'income', src: { name: parentIncomeName(it), type: 'parents' } })} />
                )}
                {exp ? (
                  <Row name="עלות" negative basis={exp.period === 'monthly' ? 'חודשי' : 'שנתי'} annual={expAmt} monthly={exp.period === 'monthly' ? exp.amount : undefined}
                    onEdit={canEditMoney ? () => open({ kind: 'expense', exp }) : undefined}
                    onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${exp.name}"?`, run: () => deleteExpense(exp.id) }) : undefined} />
                ) : (
                  <BlankRow name={`עלות — ${it.label}`} canEdit={canEditMoney && !!catByKind('events')} onFill={() => expenseTemplate('events', { name: parentExpenseName(it), period: it.period })} />
                )}
                {(inc || exp) && (
                  <Subtotal label={gap >= 0 ? `${it.label} — ההורים מכסים` : `פער ${it.label} — בית הספר מכסה`} value={gap} negative={gap < 0} />
                )}
              </div>
            );
          })}

          <Subtotal label="סה״כ הכנסות מהורים" value={parentsIncome} />
          <Subtotal label="סה״כ הוצאות (לתלמיד + השאלת ספרים + הסעות)" value={parentsExpense} negative />
          <Subtotal label={parentsIncome - parentsExpense >= 0 ? 'יתרה — ההורים מכסים את כל הסעיף' : 'פער הורים כולל — בית הספר מכסה'} value={parentsIncome - parentsExpense} negative={parentsIncome - parentsExpense < 0} strong />
        </Section>
      )}

      {/* 4 · תשתית ותחזוקה */}
      <Section num={isSimpleMode ? 2 : 4} icon={Building2} title="תשתית ותחזוקה" tone="coral" total={infraTotal}
        hint="מבנה, אחזקה, ציוד וריהוט. סכום חודשי מוכפל לבד ב-12.">
        {[...buildingRows, ...equipmentRows].map(e => (
          <Row key={e.id} name={e.name} basis={e.period === 'monthly' ? 'חודשי' : 'שנתי'} annual={annualAmount(e)} monthly={e.period === 'monthly' ? e.amount : undefined}
            onEdit={canEditMoney ? () => open({ kind: 'expense', exp: e }) : undefined}
            onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${e.name}"?`, run: () => deleteExpense(e.id) }) : undefined} />
        ))}
        {TEMPLATES.building.filter(t => !hasRow(buildingRows, t.name)).map(t => (
          <BlankRow key={t.name} name={t.name} canEdit={canEditMoney && !!catByKind('building')} onFill={() => expenseTemplate('building', t)} />
        ))}
        {TEMPLATES.equipment.filter(t => !hasRow(equipmentRows, t.name)).map(t => (
          <BlankRow key={t.name} name={t.name} canEdit={canEditMoney && !!catByKind('equipment')} onFill={() => expenseTemplate('equipment', t)} />
        ))}
        <AddButton label="הוצאת תשתית אחרת" canEdit={canEditMoney} onClick={() => open({ kind: 'expense', exp: { categoryId: catByKind('building')?.id, period: 'monthly', status: 'approved' } })} />
        <Subtotal label="סה״כ תשתית ותחזוקה" value={infraTotal} strong />
      </Section>

      {/* 5 · שכר נוסף */}
      <Section num={isSimpleMode ? 3 : 5} icon={UserCog} title="הוצאות שכר נוספות" tone="gray" total={salaryTotal}
        hint="אב בית, מזכירה, ניקיון וכל שכר שאינו הוראה. ברוטו לחודש.">
        {salaryRows.map(e => (
          <Row key={e.id} name={e.name} basis={e.period === 'monthly' ? 'חודשי' : 'שנתי'} annual={annualAmount(e)} monthly={e.period === 'monthly' ? e.amount : undefined}
            onEdit={canEditMoney ? () => open({ kind: 'expense', exp: e }) : undefined}
            onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${e.name}"?`, run: () => deleteExpense(e.id) }) : undefined} />
        ))}
        {TEMPLATES.salary.filter(t => !hasRow(salaryRows, t.name)).map(t => (
          <BlankRow key={t.name} name={t.name} canEdit={canEditMoney && !!catByKind('salary')} onFill={() => expenseTemplate('salary', t)} />
        ))}
        <AddButton label="תפקיד נוסף" canEdit={canEditMoney} onClick={() => open({ kind: 'expense', exp: { categoryId: catByKind('salary')?.id, period: 'monthly', status: 'approved' } })} />
        <Subtotal label="סה״כ שכר נוסף" value={salaryTotal} strong />
      </Section>

      {/* 6 · הוצאות אחרות */}
      <Section num={isSimpleMode ? 4 : 6} icon={CreditCard} title="הוצאות אחרות" tone="purple" total={otherTotal}
        hint="הזנה, פעילות ואירועים, וכל מה שלא נכנס לסעיפים הקודמים (הסעות והשאלת ספרים בסעיף ההורים)">
        {[...eventsRows, ...otherRows].map(e => (
          <Row key={e.id} name={e.name} basis={e.period === 'monthly' ? 'חודשי' : 'שנתי'} annual={annualAmount(e)} monthly={e.period === 'monthly' ? e.amount : undefined}
            onEdit={canEditMoney ? () => open({ kind: 'expense', exp: e }) : undefined}
            onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${e.name}"?`, run: () => deleteExpense(e.id) }) : undefined} />
        ))}
        {profdevRows.map(e => (
          <Row key={e.id} name={e.name} muted={!isSimpleMode} basis={isSimpleMode ? (e.period === 'monthly' ? 'חודשי' : 'שנתי') : 'פיתוח מקצועי — כלול בהוצאה לתלמיד, לא נספר פעמיים'} annual={annualAmount(e)}
            onEdit={canEditMoney ? () => open({ kind: 'expense', exp: e }) : undefined}
            onDelete={canEditMoney ? () => setConfirm({ msg: `למחוק את "${e.name}"?`, run: () => deleteExpense(e.id) }) : undefined} />
        ))}
        {TEMPLATES.events.filter(t => !hasRow(eventsRows, t.name)).map(t => (
          <BlankRow key={t.name} name={t.name} canEdit={canEditMoney && !!catByKind('events')} onFill={() => expenseTemplate('events', t)} />
        ))}
        {TEMPLATES.other.filter(t => !hasRow(otherRows, t.name)).map(t => (
          <BlankRow key={t.name} name={t.name} canEdit={canEditMoney && !!catByKind('other')} onFill={() => expenseTemplate('other', t)} />
        ))}
        <AddButton label="הוצאה אחרת" canEdit={canEditMoney} onClick={() => open({ kind: 'expense', exp: { categoryId: catByKind('other')?.id, period: 'monthly', status: 'approved' } })} />
        <Subtotal label="סה״כ הוצאות אחרות" value={otherTotal} strong />
      </Section>

      {/* סיכום */}
      <section className="card p-5 border-2 border-purple-100 print:break-inside-avoid">
        <h3 className="font-bold text-gray-800 text-base mb-2">סיכום</h3>
        {!isSimpleMode && (
          <>
            <Subtotal label="הכנסות: משרד החינוך ומקורות נוספים" value={incomeTotal} />
            <Subtotal label="הכנסות: הורים" value={parentsIncome} />
            <Subtotal label="סה״כ הכנסות" value={totals.totalIncome} strong />
            <div className="h-2" />
            <Subtotal label="עלות הוראה" value={teachingTotal} negative />
            <Subtotal label="הוצאה לתלמיד" value={totals.totalStudentExpenses} negative />
            <Subtotal label="השאלת ספרים והסעות לתלמידים (עלות)" value={parentItemExpenseTotal} negative />
            <Subtotal label="תשתית ותחזוקה" value={infraTotal} negative />
            <Subtotal label="שכר נוסף" value={salaryTotal} negative />
            <Subtotal label="הוצאות אחרות" value={otherTotal} negative />
            <Subtotal label="סה״כ הוצאות" value={totals.totalExpenses} negative strong />
          </>
        )}
        {isSimpleMode && (
          <>
            <Subtotal label="סה״כ הכנסות" value={totals.totalIncome} strong />
            <Subtotal label="סה״כ הוצאות" value={totals.totalExpenses} negative strong />
          </>
        )}
        <div className={`mt-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${totals.isDeficit ? 'bg-red-50 border border-red-100' : 'bg-teal-50 border border-teal-100'}`}>
          <span className="font-bold text-gray-800">{totals.isDeficit ? 'פער שנתי (לפני ייעול)' : 'יתרה שנתית'}</span>
          <span className={`font-black text-xl ${totals.isDeficit ? 'text-coral-700' : 'text-teal-700'}`}>{formatCurrency(Math.abs(totals.balance))}</span>
        </div>
        {!isSimpleMode && (
          <div className="grid grid-cols-2 gap-2 mt-4 print:hidden">
            <button type="button" onClick={() => navigate('efficiency')} className="btn-outline btn-sm min-h-[44px] justify-center"><Lightbulb size={14} /> להצעות ייעול <ArrowLeft size={13} /></button>
            <button type="button" onClick={() => navigate('summary')} className="btn-primary btn-sm min-h-[44px] justify-center"><FileSignature size={14} /> לסיכום ואישור <ArrowLeft size={13} /></button>
          </div>
        )}
      </section>

      {/* מודאלים */}
      {modal?.kind === 'class' && (
        <ClassModal cls={modal.cls} onClose={close}
          onSave={(data) => (modal.cls ? updateClass(modal.cls.id, data) : addClass(data))} />
      )}
      {modal?.kind === 'income' && (
        <IncomeModal src={modal.src} totalStudents={totalStudents} onClose={close}
          onSave={(data) => (modal.src?.id ? updateIncomeSource(modal.src.id, data) : addIncomeSource(data))} />
      )}
      {modal?.kind === 'expense' && (
        <ExpenseModal exp={modal.exp} categories={expenseCategories} onClose={close}
          onSave={(data) => guardExpense(data, d => (modal.exp?.id ? updateExpense(modal.exp.id, d) : addExpense(d)))} />
      )}
      {modal?.kind === 'number' && (
        <NumberModal title={modal.title} label={modal.label} unit={modal.unit} value={modal.value} hint={modal.hint}
          onClose={close} onSave={saveNumber(modal.key)} />
      )}
      {confirm && (
        <ConfirmDialog title="מחיקה" message={confirm.msg} confirmLabel="מחיקה" danger
          onConfirm={() => { confirm.run(); setConfirm(null); }} onClose={() => setConfirm(null)} />
      )}
    </div>
    </SlotCtx.Provider>
  );
}
