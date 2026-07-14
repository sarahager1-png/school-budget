import { useState, useMemo, useEffect } from 'react';
import { RotateCcw, Save, FolderOpen, Trash2, Bookmark } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';
import { calculateClassBudget, formatCurrency, formatCurrencyFull } from '../lib/calculations.js';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

function NumberInput({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-black text-teal-600">
          {unit === '₪' ? formatCurrency(value) : `${value.toLocaleString('he-IL')}${unit ? ' ' + unit : ''}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full bg-gray-200 appearance-none cursor-pointer accent-teal-500"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{unit === '₪' ? formatCurrency(min) : `${min}${unit ? ' ' + unit : ''}`}</span>
        <span>{unit === '₪' ? formatCurrency(max) : `${max}${unit ? ' ' + unit : ''}`}</span>
      </div>
    </div>
  );
}

function BalanceBar({ income, expenses }) {
  const balance = income - expenses;
  const max = Math.max(income, expenses) || 1;
  const incomeW = Math.round((income / max) * 100);
  const expW = Math.round((expenses / max) * 100);
  const surplus = balance >= 0;
  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>הכנסות</span>
          <span className="font-bold text-green-600">{formatCurrencyFull(income)}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-400 rounded-full transition-all duration-500" style={{ width: `${incomeW}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>הוצאות</span>
          <span className="font-bold text-red-500">{formatCurrencyFull(expenses)}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-400 rounded-full transition-all duration-500" style={{ width: `${expW}%` }} />
        </div>
      </div>
      <div className={`flex justify-between items-center text-sm font-black pt-1 border-t ${surplus ? 'text-green-600' : 'text-red-600'}`}>
        <span>{surplus ? 'עודף' : 'גירעון'}</span>
        <span>{formatCurrencyFull(balance)}</span>
      </div>
    </div>
  );
}

function DeltaBadge({ current, simulated }) {
  const delta = simulated - current;
  if (Math.abs(delta) < 1) return null;
  const positive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {positive ? '+' : ''}{formatCurrencyFull(delta)}
    </span>
  );
}

function calcSimTotals(simClasses, additionalIncome, expenses, simParams) {
  const classBudgets = simClasses.map(c => calculateClassBudget(c, simParams));
  const totalIncome = classBudgets.reduce((s, b) => s + b.totalIncome, 0) + additionalIncome;
  const totalClassCost = classBudgets.reduce((s, b) => s + b.totalExpenses, 0);
  const totalExpenses = totalClassCost + expenses;
  const balance = totalIncome - totalExpenses;
  return { totalIncome, totalExpenses, balance };
}

function SaveScenarioModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) return setError('חסר שם לתרחיש — למשל: תקציב עם כיתה נוספת');
    onSave(name.trim());
    onClose();
  };

  return (
    <Modal title="שמירת תרחיש" subtitle="התקציב שבנית יישמר ותוכלי לחזור אליו בכל רגע" onClose={onClose} maxWidth="max-w-sm">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div>
        <label className="label">שם התרחיש</label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="למשל: תקציב עם כיתה נוספת"
        />
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={handleSave} className="btn-primary flex-1 justify-center">
          <Save size={14} />
          שמור
        </button>
        <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}

export default function SimulationsPage() {
  const { classes, incomeSources, expenses, constants, currentYear, user, notify } = useApp();

  const currentAdditionalIncome = incomeSources.reduce((s, src) => s + (src.amount || 0), 0);
  const currentOtherExpenses = expenses
    .filter(e => e.period !== undefined)
    .reduce((s, e) => s + (e.period === 'monthly' ? e.amount * 12 : e.amount), 0);

  const [studentDelta, setStudentDelta] = useState(0);
  const [extraClasses, setExtraClasses] = useState(0);
  const [incomePerStudent, setIncomePerStudent] = useState(constants.incomePerStudent);
  const [expensePerStudent, setExpensePerStudent] = useState(constants.expensePerStudent);
  const [ministryRate, setMinistryRate] = useState(constants.ministryHourlyRate);
  const [ministryGrant, setMinistryGrant] = useState(constants.ministryGrantPerStudent);
  const [extraIncome, setExtraIncome] = useState(0);
  const [extraExpense, setExtraExpense] = useState(0);

  // Saved scenarios — the built budget persists per school+year
  const [scenarios, setScenarios] = useState([]);
  const [saveModal, setSaveModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeScenarioId, setActiveScenarioId] = useState(null);

  useEffect(() => {
    if (!user?.schoolId || !currentYear?.id) return;
    supabase.from('budget_scenarios')
      .select('*')
      .eq('school_id', user.schoolId)
      .eq('budget_year_id', currentYear.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setScenarios(data ?? []));
  }, [user?.schoolId, currentYear?.id]);

  const currentParams = () => ({
    studentDelta, extraClasses, incomePerStudent, expensePerStudent,
    ministryRate, ministryGrant, extraIncome, extraExpense,
  });

  const saveScenario = async (name) => {
    const { data, error } = await supabase.from('budget_scenarios').insert({
      school_id: user.schoolId,
      budget_year_id: currentYear.id,
      name,
      params: currentParams(),
    }).select().single();
    if (error || !data) return notify('התרחיש לא נשמר — נסי שוב', 'error');
    setScenarios(prev => [data, ...prev]);
    setActiveScenarioId(data.id);
    notify('התרחיש נשמר ✓');
  };

  const applyScenario = (s) => {
    const p = s.params || {};
    setStudentDelta(p.studentDelta ?? 0);
    setExtraClasses(p.extraClasses ?? 0);
    setIncomePerStudent(p.incomePerStudent ?? constants.incomePerStudent);
    setExpensePerStudent(p.expensePerStudent ?? constants.expensePerStudent);
    setMinistryRate(p.ministryRate ?? constants.ministryHourlyRate);
    setMinistryGrant(p.ministryGrant ?? constants.ministryGrantPerStudent);
    setExtraIncome(p.extraIncome ?? 0);
    setExtraExpense(p.extraExpense ?? 0);
    setActiveScenarioId(s.id);
    notify(`"${s.name}" נטען ✓`);
  };

  const removeScenario = async (id) => {
    const { error } = await supabase.from('budget_scenarios').delete().eq('id', id);
    if (error) return notify('המחיקה נכשלה — נסי שוב', 'error');
    setScenarios(prev => prev.filter(s => s.id !== id));
    if (activeScenarioId === id) setActiveScenarioId(null);
    notify('התרחיש נמחק');
  };

  const reset = () => {
    setStudentDelta(0);
    setExtraClasses(0);
    setIncomePerStudent(constants.incomePerStudent);
    setExpensePerStudent(constants.expensePerStudent);
    setMinistryRate(constants.ministryHourlyRate);
    setMinistryGrant(constants.ministryGrantPerStudent);
    setExtraIncome(0);
    setExtraExpense(0);
    setActiveScenarioId(null);
  };

  const simParams = useMemo(() => ({
    ...constants,
    incomePerStudent,
    expensePerStudent,
    ministryHourlyRate: ministryRate,
    ministryGrantPerStudent: ministryGrant,
  }), [constants, incomePerStudent, expensePerStudent, ministryRate, ministryGrant]);

  const currentTotals = useMemo(() => {
    const classBudgets = classes.map(c => calculateClassBudget(c, constants));
    const totalIncome = classBudgets.reduce((s, b) => s + b.totalIncome, 0) + currentAdditionalIncome;
    const totalClassCost = classBudgets.reduce((s, b) => s + b.totalExpenses, 0);
    const totalExpenses = totalClassCost + currentOtherExpenses;
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  }, [classes, constants, currentAdditionalIncome, currentOtherExpenses]);

  const simTotals = useMemo(() => {
    const avgStudents = classes.length > 0
      ? Math.round(classes.reduce((s, c) => s + c.studentCount, 0) / classes.length)
      : 25;

    const simClasses = [
      ...classes.map(c => ({ ...c, studentCount: Math.max(1, c.studentCount + studentDelta) })),
      ...Array.from({ length: extraClasses }, (_, i) => ({
        id: `sim-${i}`,
        name: `כיתה חדשה ${i + 1}`,
        studentCount: avgStudents,
      })),
    ];

    const simAdditional = currentAdditionalIncome + extraIncome;
    const simOther = currentOtherExpenses + extraExpense;

    return calcSimTotals(simClasses, simAdditional, simOther, simParams);
  }, [classes, studentDelta, extraClasses, simParams, currentAdditionalIncome, currentOtherExpenses, extraIncome, extraExpense]);

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const simTotalStudents = totalStudents + studentDelta * classes.length + extraClasses * (
    classes.length > 0 ? Math.round(classes.reduce((s, c) => s + c.studentCount, 0) / classes.length) : 25
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-800">סימולציית תקציב — שערוך</h2>
          <p className="text-gray-500 text-sm mt-0.5">שני פרמטרים, ראי את ההשפעה מיד — ושמרי את התקציב שבנית</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setSaveModal(true)} className="btn-primary btn-sm">
            <Save size={14} />
            שמירת תרחיש
          </button>
          <button onClick={reset} className="btn-outline btn-sm">
            <RotateCcw size={14} />
            איפוס
          </button>
        </div>
      </div>

      {/* Saved scenarios */}
      {scenarios.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
            <Bookmark size={15} className="text-teal-500" />
            תרחישים שמורים — {currentYear?.label}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {scenarios.map(s => (
              <div
                key={s.id}
                className={`rounded-xl border p-3 flex items-center gap-2 transition-all ${
                  activeScenarioId === s.id ? 'border-teal-400 bg-teal-50/50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.created_at?.split('T')[0]}</p>
                </div>
                <button
                  onClick={() => applyScenario(s)}
                  aria-label={`טעינת ${s.name}`}
                  title="טעינה"
                  className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
                >
                  <FolderOpen size={16} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(s)}
                  aria-label={`מחיקת ${s.name}`}
                  title="מחיקה"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Controls */}
        <div className="space-y-4">
          <div className="card p-5 space-y-5">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide border-b pb-2">כיתות ותלמידים</h3>
            <NumberInput
              label={`שינוי מספר תלמידים לכיתה (${classes.length} כיתות × ${studentDelta >= 0 ? '+' : ''}${studentDelta})`}
              value={studentDelta}
              onChange={setStudentDelta}
              min={-10}
              max={15}
              unit="תלמידים"
            />
            <NumberInput
              label="הוספת כיתות חדשות"
              value={extraClasses}
              onChange={setExtraClasses}
              min={0}
              max={5}
              unit="כיתות"
            />
          </div>

          <div className="card p-5 space-y-5">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide border-b pb-2">הכנסות</h3>
            <NumberInput
              label="הכנסה לתלמיד"
              value={incomePerStudent}
              onChange={setIncomePerStudent}
              min={0}
              max={1500}
              step={50}
              unit="₪"
            />
            <NumberInput
              label="תוספת משרד החינוך לתלמיד"
              value={ministryGrant}
              onChange={setMinistryGrant}
              min={0}
              max={1000}
              step={10}
              unit="₪"
            />
            <NumberInput
              label="תעריף שעה — משרד החינוך"
              value={ministryRate}
              onChange={setMinistryRate}
              min={200}
              max={800}
              step={10}
              unit="₪"
            />
            <NumberInput
              label="הכנסות נוספות חד-פעמיות"
              value={extraIncome}
              onChange={setExtraIncome}
              min={0}
              max={200000}
              step={1000}
              unit="₪"
            />
          </div>

          <div className="card p-5 space-y-5">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide border-b pb-2">הוצאות</h3>
            <NumberInput
              label="הוצאה לתלמיד"
              value={expensePerStudent}
              onChange={setExpensePerStudent}
              min={0}
              max={4000}
              step={50}
              unit="₪"
            />
            <NumberInput
              label="הוצאות נוספות חד-פעמיות"
              value={extraExpense}
              onChange={setExtraExpense}
              min={0}
              max={200000}
              step={1000}
              unit="₪"
            />
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {/* Current */}
          <div className="card p-5 border-2 border-gray-200">
            <h3 className="font-bold text-gray-600 text-sm mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
              מצב נוכחי
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              {classes.length} כיתות · {totalStudents} תלמידים
            </p>
            <BalanceBar income={currentTotals.totalIncome} expenses={currentTotals.totalExpenses} />
          </div>

          {/* Simulated */}
          <div className="card p-5 border-2 border-teal-300 bg-teal-50/30">
            <h3 className="font-bold text-teal-700 text-sm mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
              סימולציה
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {classes.length + extraClasses} כיתות · {simTotalStudents} תלמידים
            </p>
            <BalanceBar income={simTotals.totalIncome} expenses={simTotals.totalExpenses} />
          </div>

          {/* Delta Summary */}
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-gray-700 text-sm border-b pb-2">שינוי משוער</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">הכנסות</span>
                <DeltaBadge current={currentTotals.totalIncome} simulated={simTotals.totalIncome} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">הוצאות</span>
                <DeltaBadge current={currentTotals.totalExpenses} simulated={simTotals.totalExpenses} />
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-bold text-gray-700">השפעה על יתרה</span>
                {(() => {
                  const delta = simTotals.balance - currentTotals.balance;
                  const positive = delta >= 0;
                  return (
                    <span className={`font-black text-base ${positive ? 'text-green-600' : 'text-red-600'}`}>
                      {positive ? '+' : ''}{formatCurrencyFull(delta)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Modals */}
          {saveModal && (
            <SaveScenarioModal onSave={saveScenario} onClose={() => setSaveModal(false)} />
          )}
          {deleteConfirm && (
            <ConfirmDialog
              title="מחיקת תרחיש"
              message={`למחוק את "${deleteConfirm.name}"? לא ניתן לבטל.`}
              onConfirm={() => removeScenario(deleteConfirm.id)}
              onClose={() => setDeleteConfirm(null)}
            />
          )}

          {/* Class breakdown */}
          {classes.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-700 text-sm border-b pb-2 mb-3">השוואה לפי כיתה</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {classes.map(c => {
                  const before = calculateClassBudget(c, constants);
                  const after = calculateClassBudget({ ...c, studentCount: Math.max(1, c.studentCount + studentDelta) }, simParams);
                  const delta = after.balance - before.balance;
                  return (
                    <div key={c.id} className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-gray-700 flex-1 truncate">{c.name}</span>
                      <span className="text-gray-400 text-xs">{c.studentCount + studentDelta} תל׳</span>
                      <span className={`font-bold text-xs ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {delta >= 0 ? '+' : ''}{formatCurrencyFull(delta)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
