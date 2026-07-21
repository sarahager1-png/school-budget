import { useState, useEffect, useMemo } from 'react';
import { Printer, PenLine, Lightbulb, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';
import {
  calculateSchoolTotals, calculateSimpleTotals, categoryTotals,
  formatCurrency, formatCurrencyFull,
} from '../lib/calculations.js';
import { findMerges, extraHoursReport, thresholdReport, eventsCapReport } from '../lib/efficiency.js';
import SignaturePad from '../components/ui/SignaturePad.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

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
  } = useApp();

  const [approval, setApproval] = useState(null);
  const [signingSlot, setSigningSlot] = useState(null);
  const [overwriteSlot, setOverwriteSlot] = useState(null);
  const [tableReady, setTableReady] = useState(true);

  const totals = useMemo(
    () => isSimpleMode
      ? calculateSimpleTotals(incomeSources, expenses)
      : calculateSchoolTotals(classes, incomeSources, expenses, constants, expenseCategories),
    [isSimpleMode, classes, incomeSources, expenses, constants, expenseCategories],
  );

  const catRows = useMemo(
    () => categoryTotals(expenses, expenseCategories).filter(c => c.kind !== 'profdev' && c.value > 0),
    [expenses, expenseCategories],
  );

  // הצעות הייעול המדידות — מופיעות גם על המסמך החתום
  const suggestions = useMemo(() => {
    if (isSimpleMode) return [];
    const rows = [];
    const merges = findMerges(classes, constants);
    const mergedIds = new Set(merges.flatMap(m => m.members.map(x => x.id)));
    for (const m of merges) {
      rows.push({ label: `צירוף כיתות: ${m.members.map(x => x.name).join(' + ')} (${m.merged.studentCount} תל׳)`, saving: m.delta });
    }
    // כיתות שצורפו: השעות הבודדות של החברות הקטנות כבר נחסכות בתוך ה-delta
    // של הצירוף עצמו — לא סופרים אותן שוב; נשארות רק שעות הכיתה המאוחדת עצמה.
    const extraClasses = [
      ...classes.filter(c => !mergedIds.has(c.id)),
      ...merges.map(m => m.merged),
    ];
    const extra = extraHoursReport(extraClasses, constants);
    if (extra.totalCost > 0) rows.push({ label: `צמצום ${extra.totalHours} שעות בודדות בחודש`, saving: extra.totalCost });
    const events = eventsCapReport(expenses, expenseCategories, classes);
    if (events.excess > 0) rows.push({ label: 'החזרת הוצאות אירועים לתקרת הרשת', saving: events.excess });
    const th = thresholdReport(classes, constants, 4, mergedIds);
    for (const r of th.rows) {
      rows.push({ label: `${r.cls.name}: עוד ${r.gap} תלמידים ל${r.nextType === 'full' ? 'תקן מלא' : 'חצי תקן'}`, saving: r.gain });
    }
    return rows.sort((a, b) => b.saving - a.saving);
  }, [isSimpleMode, classes, expenses, expenseCategories, constants]);

  const suggestionsTotal = suggestions.reduce((s, r) => s + r.saving, 0);

  useEffect(() => {
    setApproval(null);
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
      });
  }, [user?.schoolId, currentYear?.id]);

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
        <div className="flex justify-between items-start mb-1">
          <span className="text-xs text-gray-400">{today}</span>
          <span className="text-sm text-gray-500 font-medium">ב"ה</span>
        </div>
        <div className="text-center border-b border-gray-200 pb-4 mb-5">
          <h1 className="text-2xl font-black text-gray-800">סיכום תקציב שנתי</h1>
          <p className="text-gray-600 mt-1 font-medium">{school?.name} · {currentYear?.label}</p>
          {!isSimpleMode && (
            <p className="text-xs text-gray-400 mt-1">{classes.length} כיתות · {totals.totalStudents} תלמידים</p>
          )}
        </div>

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
          <h3 className="font-bold text-gray-800 text-sm border-b-2 border-teal-200 pb-1.5 mb-2">הכנסות — ממה זה מורכב</h3>
          {isSimpleMode ? (
            <>
              {incomeSources.map(s => <Row key={s.id} label={s.name} value={formatCurrency(s.amount)} />)}
            </>
          ) : (
            <>
              <Row label="שעות תקן — משרד החינוך" value={formatCurrency(totals.totalMinistryIncome)} />
              {totals.totalMinistryGrantIncome > 0 && <Row label="תוספת כללית לתלמיד — משרד החינוך" value={formatCurrency(totals.totalMinistryGrantIncome)} />}
              <Row label={`הכנסה לתלמיד (${totals.totalStudents} תלמידים)`} value={formatCurrency(totals.totalStudentIncome)} />
              {totals.totalTalanIncome > 0 && <Row label='תל"ן — תשלומי הורים' value={formatCurrency(totals.totalTalanIncome)} />}
              {incomeSources.map(s => <Row key={s.id} label={s.name} value={formatCurrency(s.amount)} />)}
            </>
          )}
          <Row label='סה"כ הכנסות' value={formatCurrency(totals.totalIncome)} bold tone="green" />
        </div>

        {/* Expense breakdown */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-800 text-sm border-b-2 border-red-200 pb-1.5 mb-2">הוצאות — על מה זה יוצא</h3>
          {!isSimpleMode && (
            <>
              <Row label={`עלות הוראה (${classes.length} כיתות × ${constants.actualWeeklyHours} ש׳ בחודש)`} value={formatCurrency(totals.totalClassActualCost)} />
              {totals.totalExtraHoursCost > 0 && <Row label="שעות בודדות" value={formatCurrency(totals.totalExtraHoursCost)} />}
              <Row label={`הוצאה לתלמיד (${totals.totalStudents} × ${formatCurrency(constants.expensePerStudent)})`} value={formatCurrency(totals.totalStudentExpenses)} />
              {totals.totalProfDev > 0 && <Row label="פיתוח מקצועי" value={formatCurrency(totals.totalProfDev)} />}
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
              הצעות ייעול — פוטנציאל חיסכון
            </h3>
            {suggestions.map((s, i) => <Row key={i} label={s.label} value={`+${formatCurrency(s.saving)}`} tone="green" />)}
            <Row label='סה"כ פוטנציאל שנתי' value={`+${formatCurrency(suggestionsTotal)}`} bold tone="green" />
            <button type="button" onClick={() => navigate('efficiency')} className="btn-ghost btn-sm mt-2 no-print">
              לכל ההצעות והפירוט
              <ArrowLeft size={13} />
            </button>
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
    </div>
  );
}
