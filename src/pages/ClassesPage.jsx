import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { calculateClassBudget, getClassType, formatCurrency, formatCurrencyFull } from '../lib/calculations.js';
import { CLASS_TYPE } from '../data/constants.js';

function ClassModal({ cls, onSave, onClose }) {
  const [form, setForm] = useState({
    name: cls?.name || '',
    gradeLevel: cls?.gradeLevel || '',
    section: cls?.section || '',
    studentCount: cls?.studentCount || '',
    notes: cls?.notes || '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name || !form.studentCount) return;
    onSave({ ...form, studentCount: Number(form.studentCount) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 mb-5">{cls ? 'עריכת כיתה' : 'הוספת כיתה'}</h2>
        <div className="space-y-4">
          <div>
            <label className="label">שם הכיתה</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="כיתה א'1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">שכבה</label>
              <input className="input" value={form.gradeLevel} onChange={e => set('gradeLevel', e.target.value)} placeholder="א'" />
            </div>
            <div>
              <label className="label">מקטע</label>
              <input className="input" value={form.section} onChange={e => set('section', e.target.value)} placeholder="1" />
            </div>
          </div>
          <div>
            <label className="label">מספר תלמידים</label>
            <input className="input" type="number" min="1" max="50" value={form.studentCount} onChange={e => set('studentCount', e.target.value)} placeholder="20" />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} className="btn-primary flex-1 justify-center">שמור</button>
          <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
        </div>
      </div>
    </div>
  );
}

function BudgetBreakdown({ budget }) {
  const rows = [
    { label: 'שעות משרד שבועיות', value: `${budget.ministryWeeklyHours} שעות`, neutral: true },
    { label: 'הכנסה ממשרד החינוך', value: formatCurrency(budget.ministryIncome), positive: true },
    { label: 'הכנסה לתלמיד', value: formatCurrency(budget.studentIncome), positive: true },
    ...(budget.caharonIncome > 0 ? [{ label: 'הכנסות צהרון', value: formatCurrency(budget.caharonIncome), positive: true }] : []),
    { label: 'סה״כ הכנסות', value: formatCurrency(budget.totalIncome), bold: true, positive: true },
    null,
    { label: 'עלות הוראה בפועל', value: formatCurrency(budget.actualOperatingCost), negative: true },
    { label: 'הוצאות לתלמיד', value: formatCurrency(budget.studentExpenses), negative: true },
    ...(budget.caharonExpense > 0 ? [{ label: 'הוצאות צהרון', value: formatCurrency(budget.caharonExpense), negative: true }] : []),
    { label: 'פיתוח מקצועי', value: formatCurrency(budget.profDevExpense), negative: true },
    { label: 'סה״כ הוצאות', value: formatCurrency(budget.totalExpenses), bold: true, negative: true },
    null,
    { label: budget.isDeficit ? 'גירעון כיתה' : 'עודף כיתה', value: formatCurrencyFull(budget.balance), bold: true, negative: budget.isDeficit, positive: !budget.isDeficit },
  ];

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm">
      <div className="space-y-1.5">
        {rows.map((row, i) =>
          !row ? (
            <div key={i} className="border-t border-gray-200 my-2" />
          ) : (
            <div key={i} className="flex justify-between items-center">
              <span className={`${row.bold ? 'font-bold' : 'text-gray-600'}`}>{row.label}</span>
              <span className={`font-medium ${row.negative ? 'text-red-600' : row.positive ? 'text-green-600' : 'text-gray-700'} ${row.bold ? 'font-bold text-base' : ''}`}>
                {row.value}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function ClassesPage() {
  const { classes, addClass, updateClass, deleteClass, constants } = useApp();
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const classesWithBudget = useMemo(
    () => classes.map(c => ({ ...c, budget: calculateClassBudget(c, constants) })),
    [classes, constants],
  );

  const filtered = useMemo(() =>
    filter === 'all' ? classesWithBudget : classesWithBudget.filter(c => c.budget.type === filter),
    [classesWithBudget, filter],
  );

  const totals = useMemo(() => ({
    students: classesWithBudget.reduce((s, c) => s + c.studentCount, 0),
    income: classesWithBudget.reduce((s, c) => s + c.budget.totalIncome, 0),
    expenses: classesWithBudget.reduce((s, c) => s + c.budget.totalExpenses, 0),
    balance: classesWithBudget.reduce((s, c) => s + c.budget.balance, 0),
  }), [classesWithBudget]);

  const FILTERS = [
    { key: 'all', label: 'כל הכיתות' },
    { key: 'full', label: 'תקן מלא (21+)' },
    { key: 'half', label: 'תקן חצי (11-20)' },
    { key: 'none', label: 'ללא תקן (<11)' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ניהול כיתות</h2>
          <p className="text-gray-500 text-sm mt-0.5">{classes.length} כיתות · {totals.students} תלמידים</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary">
          <Plus size={16} />
          הוסף כיתה
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'כיתות', value: classes.length, suffix: '', color: 'text-teal-600 bg-teal-50' },
          { label: 'תלמידים', value: totals.students, suffix: '', color: 'text-purple-600 bg-purple-50' },
          { label: 'הכנסות כיתות', value: formatCurrency(totals.income), suffix: '', color: 'text-green-600 bg-green-50' },
          { label: 'יתרת כיתות', value: formatCurrencyFull(totals.balance), suffix: '', color: totals.balance < 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-3 ${card.color.split(' ')[1]}`}>
            <p className="text-gray-500 text-xs">{card.label}</p>
            <p className={`font-black text-lg mt-0.5 ${card.color.split(' ')[0]}`}>{card.value}{card.suffix}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f.key ? 'tab-active' : 'tab-inactive'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">כיתה</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">תלמידים</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">תקן</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">הכנסה ממשרד</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">הכנסה כוללת</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">הוצאות</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">יתרה</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(cls => {
                const typeInfo = CLASS_TYPE[cls.budget.type];
                const isExp = expanded === cls.id;
                return (
                  <>
                    <tr key={cls.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(isExp ? null : cls.id)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{cls.name}</div>
                        {cls.notes && <div className="text-xs text-gray-400 mt-0.5">{cls.notes}</div>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="flex items-center justify-center gap-1 font-medium">
                          <Users size={12} className="text-gray-400" />
                          {cls.studentCount}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`badge ${typeInfo?.color}`}>{typeInfo?.label}</span>
                      </td>
                      <td className="px-3 py-3 text-left text-teal-600 font-medium">
                        {formatCurrency(cls.budget.ministryIncome)}
                      </td>
                      <td className="px-3 py-3 text-left text-green-600 font-medium">
                        {formatCurrency(cls.budget.totalIncome)}
                      </td>
                      <td className="px-3 py-3 text-left text-coral-600 font-medium">
                        {formatCurrency(cls.budget.totalExpenses)}
                      </td>
                      <td className="px-3 py-3 text-left">
                        <span className={`font-bold ${cls.budget.isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrencyFull(cls.budget.balance)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setModal(cls)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(cls.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                          {isExp ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${cls.id}-exp`} className="bg-gray-50/50">
                        <td colSpan={8} className="px-4 pb-4">
                          <BudgetBreakdown budget={cls.budget} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-1">אין כיתות בפילטר זה</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <ClassModal
          cls={modal === 'new' ? null : modal}
          onSave={data => modal === 'new' ? addClass(data) : updateClass(modal.id, data)}
          onClose={() => setModal(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-800 mb-2">מחיקת כיתה</h3>
            <p className="text-gray-500 text-sm mb-5">האם למחוק את הכיתה? לא ניתן לבטל פעולה זו.</p>
            <div className="flex gap-3">
              <button onClick={() => { deleteClass(deleteConfirm); setDeleteConfirm(null); }} className="btn-danger flex-1 justify-center">מחק</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1 justify-center">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
