import { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, PenLine, Lightbulb, ArrowLeft, CheckCircle2, Save, StickyNote, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';
import {
  calculateSchoolTotals, calculateSimpleTotals, categoryTotals, annualAmount,
  formatCurrency, formatCurrencyFull,
} from '../lib/calculations.js';
import {
  findMerges, closeClassReport, thresholdReport, eventsCapReport, dualAgeMergeReport,
  jointShabbatReport, caharonReport, parentContributionReport,
  partaniyotReport, principalTeachingReport, tuitionReport, tuitionSupplementReport,
  hoursCutReport, topExpensesReport,
  DUAL_AGE_EXTRA_MONTHLY_HOURS, DEFAULT_PARENT_CONTRIBUTION,
  normalizeSuggestionKey,
} from '../lib/efficiency.js';
import { MANAGERS, SUMMARY_DISCLAIMER } from '../data/constants.js';
import SignaturePad from '../components/ui/SignaturePad.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { IncomeModal } from './IncomePage.jsx';
import { ExpenseModal } from './ExpensesPage.jsx';

// טבלת budget_approvals עוד לא הוקמה בחלק מהמוסדות (מיגרציה לא רצה עדיין) —
// יש להבחין בין "הטבלה לא קיימת" (מצב זמני ידוע) לבין תקלת רשת חולפת.
function isMissingTableError(error) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /does not exist|schema cache/i.test(error.message || '');
}

function Row({ label, value, bold, tone }) {
  return (
    <div className={`flex justify-between items-baseline gap-3 py-1.5 text-sm ${bold ? 'border-t border-gray-200 mt-1 pt-2 font-black text-gray-800' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span className={`whitespace-nowrap font-bold ${tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : bold ? '' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

// שורת הצעת ייעול עם checkbox לבחירה — לא נבחרת = לא נספרת ולא מודפסת
function SuggestionRow({ label, value, selected, onToggle }) {
  return (
    <label className={`flex items-center gap-2.5 py-1.5 text-sm cursor-pointer ${selected ? '' : 'no-print opacity-40'}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 accent-purple-600 flex-shrink-0 no-print"
      />
      <span className="flex-1 text-gray-600">{label}</span>
      <span className="whitespace-nowrap font-bold text-green-600">{value}</span>
    </label>
  );
}

function SignBox({ slot, title, approval, signing, onStartSign, onCancel, onSave, defaultName, notify }) {
  const [nameInput, setNameInput] = useState(defaultName || '');
  const signature = approval?.[`${slot}_signature`];
  const name = approval?.[`${slot}_name`];
  const signedAt = approval?.[`${slot}_signed_at`];

  return (
    <div className="border border-purple-100 rounded-xl p-4 bg-white flex flex-col">
      <p className="font-bold text-gray-700 text-sm mb-3">{title}</p>

      {signature && !signing && (
        <div className="flex-1 flex flex-col">
          <div className="border border-gray-100 rounded-lg bg-gray-50/50 flex items-center justify-center p-2">
            <img src={signature} alt={`חתימת ${title}`} className="h-20 object-contain" />
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-700">
            <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
            <span className="font-bold">{name}</span>
            <span className="text-gray-400 text-xs">
              · נחתם {signedAt ? new Date(signedAt).toLocaleDateString('he-IL') : ''}
            </span>
          </div>
          <button type="button" onClick={onStartSign} className="btn-ghost btn-sm mt-2 self-start no-print">
            <PenLine size={13} />
            חתימה מחדש
          </button>
        </div>
      )}

      {!signature && !signing && (
        <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3">
          <p className="text-sm text-gray-400">טרם נחתם</p>
          <button type="button" onClick={onStartSign} className="btn-primary btn-sm no-print">
            <PenLine size={14} />
            חתימה
          </button>
        </div>
      )}

      {signing && (
        <div className="space-y-3 no-print">
          <div>
            <label className="label" htmlFor={`signer-${slot}`}>שם מלא</label>
            <input
              id={`signer-${slot}`}
              className="input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="שם החותם/ת"
            />
          </div>
          <SignaturePad
            height={140}
            onEmpty={() => notify('חסרה חתימה על המשטח', 'error')}
            onSave={(dataUrl) => {
              if (!nameInput.trim()) return notify('חסר שם החותם/ת', 'error');
              onSave(slot, nameInput.trim(), dataUrl);
            }}
          />
          <button type="button" onClick={onCancel} className="btn-ghost btn-sm w-full justify-center">ביטול</button>
        </div>
      )}
    </div>
  );
}

export default function SummaryPage() {
  const {
    classes, incomeSources, expenses, expenseCategories, constants,
    school, currentYear, user, notify, saveFailed, isSimpleMode, navigate,
    addIncomeSource, addExpense,
  } = useApp();
  const canEdit = MANAGERS.includes(user?.role);

  const [approval, setApproval] = useState(null);
  const [signingSlot, setSigningSlot] = useState(null);
  const [overwriteSlot, setOverwriteSlot] = useState(null);
  const [tableReady, setTableReady] = useState(true);
  const [quickModal, setQuickModal] = useState(null); // 'income' | 'expense' | null

  const totals = useMemo(
    () => isSimpleMode
      ? calculateSimpleTotals(incomeSources, expenses)
      : calculateSchoolTotals(classes, incomeSources, expenses, constants, expenseCategories),
    [isSimpleMode, classes, incomeSources, expenses, constants, expenseCategories],
  );

  // שכר מנהלת מוצג בשמו — מופרד מקטגוריית השכר שהוא רשום בה (כמו בדף הבית)
  const { catRows, principalAnnual } = useMemo(() => {
    const principalLine = expenses.find(e => e.name === 'שכר מנהלת');
    const pAnnual = principalLine ? annualAmount(principalLine) : 0;
    const rows = categoryTotals(expenses, expenseCategories)
      .filter(c => c.kind !== 'profdev')
      .map(c => (principalLine && c.id === principalLine.categoryId ? { ...c, value: c.value - pAnnual } : c))
      .filter(c => c.value > 0);
    return { catRows: rows, principalAnnual: pAnnual };
  }, [expenses, expenseCategories]);

  // הצעות הייעול המדידות — מופיעות גם על המסמך החתום
  const suggestions = useMemo(() => {
    if (isSimpleMode) return [];
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
    const caharon = caharonReport(classes, constants);
    if (caharon.gap > 0) rows.push({ key: 'caharon', label: `התאמת מחיר הצהרון לעלות (${formatCurrency(caharon.perStudentGap)} לתלמיד)`, saving: caharon.gap });
    const tuition = tuitionReport(classes);
    if (tuition.gain > 0) rows.push({ key: 'tuition', label: `שכר לימוד עם גבייה ריאלית (${formatCurrency(tuition.amountPerStudent)} × ${tuition.collectionRatePct}% × ${tuition.totalStudents} תלמידים)`, saving: tuition.gain });
    const supplement = tuitionSupplementReport(classes);
    if (supplement.gain > 0) rows.push({ key: 'tuition-supplement', label: `תוספת שכר לימוד (${formatCurrency(supplement.amountPerStudent)} × ${supplement.collectionRatePct}% × ${supplement.totalStudents} תלמידים)`, saving: supplement.gain });
    const parents = parentContributionReport(classes);
    if (parents.gain > 0) rows.push({ key: 'parents', label: `השתתפות הורים שנתית (${formatCurrency(DEFAULT_PARENT_CONTRIBUTION)} לתלמיד × ${parents.totalStudents})`, saving: parents.gain });
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
  }, [isSimpleMode, classes, expenses, expenseCategories, constants]);

  // בחירה: אילו הצעות המנהלת בפועל מאמצת. null = עוד לא נטען/נשמר —
  // ברירת מחדל היא הכל נבחר, עד שתבטלי סימון ותשמרי.
  const [selectedKeys, setSelectedKeys] = useState(null);
  const [notes, setNotes] = useState('');
  const [savingSelection, setSavingSelection] = useState(false);
  const selectionDirty = useRef(false);

  const isSelected = (key) => selectedKeys == null || selectedKeys.has(key);
  const toggleSuggestion = (key) => {
    selectionDirty.current = true;
    setSelectedKeys(prev => {
      const base = prev == null ? new Set(suggestions.map(s => s.key)) : new Set(prev);
      if (base.has(key)) base.delete(key); else base.add(key);
      return base;
    });
  };

  const selectedSuggestions = suggestions.filter(s => isSelected(s.key));
  const suggestionsTotal = selectedSuggestions.reduce((s, r) => s + r.saving, 0);
  const projectedBalance = totals.balance + suggestionsTotal;

  useEffect(() => {
    setApproval(null);
    setSelectedKeys(null);
    setNotes('');
    selectionDirty.current = false;
    if (!user?.schoolId || !currentYear?.id) return;
    supabase.from('budget_approvals')
      .select('*')
      .eq('school_id', user.schoolId)
      .eq('budget_year_id', currentYear.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          if (isMissingTableError(error)) setTableReady(false);
        }
        setApproval(data ?? null);
        if (data?.selected_suggestion_keys) setSelectedKeys(new Set(data.selected_suggestion_keys.map(normalizeSuggestionKey)));
        if (data?.notes) setNotes(data.notes);
      });
  }, [user?.schoolId, currentYear?.id]);

  const saveSelection = async () => {
    setSavingSelection(true);
    const payload = {
      school_id: user.schoolId,
      budget_year_id: currentYear.id,
      selected_suggestion_keys: selectedKeys == null ? suggestions.map(s => s.key) : [...selectedKeys],
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('budget_approvals')
      .upsert(payload, { onConflict: 'school_id,budget_year_id' })
      .select()
      .single();
    setSavingSelection(false);
    if (isMissingTableError(error)) { setTableReady(false); return notify('שמירת ההצעות וההערות עדיין לא הופעלה במוסד זה', 'error'); }
    if (error || !data) return saveFailed(error);
    setApproval(data);
    selectionDirty.current = false;
    notify('הבחירה נשמרה ✓');
  };

  const saveSignature = async (slot, name, dataUrl) => {
    const now = new Date().toISOString();
    const payload = {
      school_id: user.schoolId,
      budget_year_id: currentYear.id,
      summary: {
        totalIncome: Math.round(totals.totalIncome),
        totalExpenses: Math.round(totals.totalExpenses),
        balance: Math.round(totals.balance),
        students: totals.totalStudents ?? null,
        classCount: classes.length,
        suggestionsTotal: Math.round(suggestionsTotal),
        projectedBalance: Math.round(projectedBalance),
        savedAt: now,
      },
      updated_at: now,
      [`${slot}_name`]: name,
      [`${slot}_signature`]: dataUrl,
      [`${slot}_signed_at`]: now,
    };
    const { data, error } = await supabase.from('budget_approvals')
      .upsert(payload, { onConflict: 'school_id,budget_year_id' })
      .select()
      .single();
    if (isMissingTableError(error)) {
      setTableReady(false);
      return notify('אישור וחתימות דיגיטליות עדיין לא הופעל במוסד זה — יש לפנות לתמיכה', 'error');
    }
    if (error || !data) return saveFailed(error);
    setApproval(data);
    setSigningSlot(null);
    notify('החתימה נשמרה ✓');
  };

  const startSign = (slot) => {
    if (approval?.[`${slot}_signature`]) setOverwriteSlot(slot);
    else setSigningSlot(slot);
  };

  const today = new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <h2 className="text-xl font-bold text-gray-800">סיכום ואישור תקציב</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            דף אחד עם כל התמונה — הכנסות, הוצאות והצעות הייעול — לחתימת המנהלת והשליח
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-outline btn-sm flex-shrink-0">
          <Printer size={14} />
          הדפסה / PDF
        </button>
      </div>

      {/* The document */}
      <div className="card p-6 md:p-8">
        {/* Document header */}
        {/* ב"ה תמיד בימין למעלה (RTL: הילד הראשון ב-flex מתחיל מימין) */}
        <div className="flex justify-between items-start mb-1">
          <span className="text-sm text-gray-500 font-medium">ב"ה</span>
          <span className="text-xs text-gray-400">{today}</span>
        </div>
        <div className="text-center border-b border-gray-200 pb-4 mb-5">
          <h1 className="text-2xl font-black text-gray-800">סיכום תקציב שנתי</h1>
          <p className="text-gray-600 mt-1 font-medium">{school?.name} · {currentYear?.label}</p>
          {!isSimpleMode && (
            <p className="text-xs text-gray-400 mt-1">{classes.length} כיתות · {totals.totalStudents} תלמידים</p>
          )}
        </div>

        {/* הערה קבועה — מופיעה על כל סיכום, במסך ובהדפסה */}
        <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 mb-5">
          {SUMMARY_DISCLAIMER}
        </p>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">סה"כ הכנסות</p>
            <p className="text-lg md:text-xl font-black text-green-600">{formatCurrency(totals.totalIncome)}</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">סה"כ הוצאות</p>
            <p className="text-lg md:text-xl font-black text-red-500">{formatCurrency(totals.totalExpenses)}</p>
          </div>
          <div className={`rounded-xl border p-3 text-center ${totals.isDeficit ? 'bg-red-50 border-red-100' : 'bg-teal-50 border-teal-100'}`}>
            <p className="text-xs text-gray-500 mb-1">{totals.isDeficit ? 'גירעון' : 'עודף'}</p>
            <p className={`text-lg md:text-xl font-black ${totals.isDeficit ? 'text-red-500' : 'text-teal-600'}`}>
              {formatCurrencyFull(totals.balance)}
            </p>
          </div>
        </div>

        {/* Income breakdown */}
        <div className="mb-6">
          <div className="flex items-center justify-between border-b-2 border-teal-200 pb-1.5 mb-2">
            <h3 className="font-bold text-gray-800 text-sm">הכנסות — ממה זה מורכב</h3>
            {canEdit && (
              <button type="button" onClick={() => setQuickModal('income')} className="btn-ghost btn-sm no-print">
                <Plus size={13} />
                הוספת הכנסה
              </button>
            )}
          </div>
          {isSimpleMode ? (
            <>
              {incomeSources.map(s => <Row key={s.id} label={s.name} value={formatCurrency(s.amount)} />)}
            </>
          ) : (
            <>
              <Row label="שעות תקן — משרד החינוך" value={formatCurrency(totals.totalMinistryIncome)} />
              <Row label={`תוספת כללית לתלמיד — משרד החינוך (${totals.totalStudents} × ${formatCurrency(constants.ministryGrantPerStudent)})`} value={formatCurrency(totals.totalMinistryGrantIncome)} />
              <Row label={`שכר לימוד — הכנסה לתלמיד (${totals.totalStudents} × ${formatCurrency(constants.incomePerStudent)} × 80% גבייה)`} value={formatCurrency(totals.totalStudentIncome)} />
              <Row label={`תל"ן — תשלומי הורים (${totals.totalStudents} × ${formatCurrency(constants.incomePerStudentTalan)} × 80% גבייה)`} value={formatCurrency(totals.totalTalanIncome)} />
              {incomeSources.map(s => <Row key={s.id} label={s.name} value={formatCurrency(s.amount)} />)}
            </>
          )}
          <Row label='סה"כ הכנסות' value={formatCurrency(totals.totalIncome)} bold tone="green" />
        </div>

        {/* Expense breakdown */}
        <div className="mb-6">
          <div className="flex items-center justify-between border-b-2 border-red-200 pb-1.5 mb-2">
            <h3 className="font-bold text-gray-800 text-sm">הוצאות — על מה זה יוצא</h3>
            {canEdit && (
              <button type="button" onClick={() => setQuickModal('expense')} className="btn-ghost btn-sm no-print">
                <Plus size={13} />
                הוספת הוצאה
              </button>
            )}
          </div>
          {!isSimpleMode && (
            <>
              <Row label={`שעות הוראה — עלות הוראה (${classes.length} כיתות × ${constants.actualWeeklyHours} ש׳ בחודש × ${formatCurrency(constants.actualHourlyRate)})`} value={formatCurrency(totals.totalClassActualCost)} />
              <Row label={`ייעוץ (${classes.length} כיתות × 2 ש׳ בחודש)`} value={formatCurrency(totals.totalCounselingCost)} />
              <Row label={`תוספת 2 חוגים לכיתה (${classes.length} כיתות × 600 ₪ שבועי)`} value={formatCurrency(totals.totalClubsExpense)} />
              <Row label={`הוצאה לתלמיד (${totals.totalStudents} × ${formatCurrency(constants.expensePerStudent)})`} value={formatCurrency(totals.totalStudentExpenses)} />
              {totals.totalProfDev > 0 && <Row label="פיתוח מקצועי" value={formatCurrency(totals.totalProfDev)} />}
              <Row label="שכר מנהלת" value={formatCurrency(principalAnnual)} />
            </>
          )}
          {catRows.map(c => <Row key={c.id} label={c.name} value={formatCurrency(c.value)} />)}
          <Row label='סה"כ הוצאות' value={formatCurrency(totals.totalExpenses)} bold tone="red" />
        </div>

        {/* Efficiency suggestions */}
        {!isSimpleMode && suggestions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 text-sm border-b-2 border-purple-200 pb-1.5 mb-2 flex items-center gap-1.5">
              <Lightbulb size={15} className="text-purple-500" />
              הצעות ייעול — לסמן אילו לאמץ
            </h3>
            <p className="text-xs text-gray-400 mb-1 no-print">המערכת מציעה את כל האפשרויות — סמני מה בוחרים בפועל; מה שלא מסומן לא נספר ולא יודפס.</p>
            {suggestions.map(s => (
              <SuggestionRow
                key={s.key}
                label={s.label}
                value={`+${formatCurrency(s.saving)}`}
                selected={isSelected(s.key)}
                onToggle={() => toggleSuggestion(s.key)}
              />
            ))}
            <Row label='סה"כ הצעות נבחרות' value={`+${formatCurrency(suggestionsTotal)}`} bold tone="green" />
            <div className={`rounded-xl border p-3 mt-3 flex justify-between items-center gap-3 ${projectedBalance < 0 ? 'bg-red-50 border-red-100' : 'bg-teal-50 border-teal-100'}`}>
              <span className="text-sm font-bold text-gray-700">מצב תקציב לאחר יישום ההצעות</span>
              <span className={`text-lg font-black ${projectedBalance < 0 ? 'text-red-500' : 'text-teal-600'}`}>
                {formatCurrencyFull(projectedBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2 no-print">
              <button
                type="button"
                onClick={() => {
                  // מגן על בחירה/הערות שלא נשמרו — אחרת נעלמות בשקט במעבר מסך
                  if (selectionDirty.current && !window.confirm('יש שינויים שעוד לא נשמרו — לעבור בלי לשמור?')) return;
                  navigate('efficiency');
                }}
                className="btn-ghost btn-sm"
              >
                לכל ההצעות והפירוט
                <ArrowLeft size={13} />
              </button>
              <button type="button" onClick={saveSelection} disabled={savingSelection} className="btn-primary btn-sm">
                <Save size={14} />
                שמירת הבחירה
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        {!isSimpleMode && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 text-sm border-b-2 border-gray-200 pb-1.5 mb-2 flex items-center gap-1.5">
              <StickyNote size={15} className="text-gray-500" />
              הערות
            </h3>
            {notes
              ? <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed print-only">{notes}</p>
              : <p className="text-sm text-gray-300 print-only">אין הערות</p>}
            <textarea
              className="input no-print"
              rows={3}
              value={notes}
              onChange={e => { selectionDirty.current = true; setNotes(e.target.value); }}
              onBlur={() => { if (selectionDirty.current) saveSelection(); }}
              placeholder="הערות לתקציב — הקשר, החלטות, מה נדחה להמשך..."
            />
            <div className="flex justify-end mt-2 no-print">
              <button type="button" onClick={saveSelection} disabled={savingSelection} className="btn-primary btn-sm">
                <Save size={14} />
                שמירת ההערות
              </button>
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="pt-2">
          <h3 className="font-bold text-gray-800 text-sm border-b-2 border-gray-200 pb-1.5 mb-3">אישור וחתימות</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            אנו מאשרים שעברנו על סיכום התקציב לשנת {currentYear?.label} כפי שמופיע בדף זה.
          </p>
          {!tableReady && (
            <p className="text-sm text-gray-400 bg-gray-50 border border-gray-100 rounded-xl p-4 text-center no-print">
              חתימה דיגיטלית עדיין לא הופעלה במוסד זה — יש לפנות לתמיכה כדי להפעיל את התכונה.
            </p>
          )}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!tableReady ? 'hidden' : ''}`}>
            <SignBox
              slot="principal"
              title="חתימת המנהלת"
              approval={approval}
              signing={signingSlot === 'principal'}
              onStartSign={() => startSign('principal')}
              onCancel={() => setSigningSlot(null)}
              onSave={saveSignature}
              defaultName={user?.role === 'principal' ? user?.name : ''}
              notify={notify}
            />
            <SignBox
              slot="courier"
              title="חתימת השליח"
              approval={approval}
              signing={signingSlot === 'courier'}
              onStartSign={() => startSign('courier')}
              onCancel={() => setSigningSlot(null)}
              onSave={saveSignature}
              defaultName={user?.role === 'courier' ? user?.name : ''}
              notify={notify}
            />
          </div>
        </div>
      </div>

      {overwriteSlot && (
        <ConfirmDialog
          title="חתימה מחדש"
          message="כבר יש חתימה שמורה בשדה הזה — חתימה חדשה תחליף אותה. להמשיך?"
          onConfirm={() => { setSigningSlot(overwriteSlot); setOverwriteSlot(null); }}
          onClose={() => setOverwriteSlot(null)}
        />
      )}

      {quickModal === 'income' && (
        <IncomeModal onSave={addIncomeSource} onClose={() => setQuickModal(null)} />
      )}
      {quickModal === 'expense' && (
        <ExpenseModal categories={expenseCategories} onSave={addExpense} onClose={() => setQuickModal(null)} />
      )}
    </div>
  );
}
