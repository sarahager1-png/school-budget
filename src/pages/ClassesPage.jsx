import { Fragment, useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Users, School } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { calculateClassBudget, formatCurrency, formatCurrencyFull } from '../lib/calculations.js';
import { CLASS_TYPE, MANAGERS } from '../data/constants.js';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

function ClassModal({ cls, onSave, onClose }) {
  const [form, setForm] = useState({
    name: cls?.name || '',
    gradeLevel: cls?.gradeLevel || '',
    section: cls?.section || '',
    studentCount: cls?.studentCount || '',
    extraHours: cls?.extraHours || '',
    notes: cls?.notes || '',
  });
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return setError('חסר שם כיתה — למשל: כיתה א\'1');
    if (!form.studentCount || Number(form.studentCount) < 1) return setError('חסר מספר תלמידים');
    onSave({ ...form, studentCount: Number(form.studentCount), extraHours: Number(form.extraHours) || 0 });
    onClose();
  };

  return (
    <Modal title={cls ? 'עריכת כיתה' : 'הוספת כיתה'} onClose={onClose}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
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
            <label className="label">מספר מקביל</label>
            <input className="input" value={form.section} onChange={e => set('section', e.target.value)} placeholder="1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">מספר תלמידים</label>
            <input className="input" type="number" inputMode="numeric" min="1" max="50" value={form.studentCount} onChange={e => set('studentCount', e.target.value)} placeholder="20" />
          </div>
          <div>
            <label className="label">שעות בודדות בחודש</label>
            <input className="input" type="number" inputMode="numeric" min="0" max="100" value={form.extraHours} onChange={e => set('extraHours', e.target.value)} placeholder="0" />
            <p className="text-xs text-gray-400 mt-1">מתווספות לעלות ההוראה בלבד</p>
          </div>
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
    </Modal>
  );
}

function BudgetBreakdown({ budget }) {
  const rows = [
    { label: 'שעות תקן בחודש', value: `${budget.ministryWeeklyHours} שעות`, neutral: true },
    { label: 'הכנסה ממשרד בחודש', value: formatCurrency(budget.ministryMonthlyIncome), positive: true },
    { label: 'הכנסה ממשרד בשנה (12 ח׳)', value: formatCurrency(budget.ministryIncome), positive: true },
    ...(budget.ministryGrantIncome > 0 ? [{ label: 'תוספת לתלמיד — משרד', value: formatCurrency(budget.ministryGrantIncome), positive: true }] : []),
    { label: 'הכנסה לתלמיד', value: formatCurrency(budget.studentIncome), positive: true },
    ...(budget.talanIncome > 0 ? [{ label: 'תל"ן (תשלומי הורים)', value: formatCurrency(budget.talanIncome), positive: true }] : []),
    ...(budget.caharonIncome > 0 ? [{ label: 'הכנסות צהרון', value: formatCurrency(budget.caharonIncome), positive: true }] : []),
    { label: 'סה״כ הכנסות', value: formatCurrency(budget.totalIncome), bold: true, positive: true },
    null,
    { label: 'עלות הוראה בפועל', value: formatCurrency(budget.actualOperatingCost), negative: true },
    ...(budget.extraHoursCost > 0 ? [{ label: `שעות בודדות (${budget.extraHours} בחודש)`, value: formatCurrency(budget.extraHoursCost), negative: true }] : []),
    ...(budget.counselingCost > 0 ? [{ label: `ייעוץ (${budget.counselingHours} ש׳ בחודש)`, value: formatCurrency(budget.counselingCost), negative: true }] : []),
    ...(budget.clubsExpense > 0 ? [{ label: 'תוספת 2 חוגים (600 ₪ שבועי)', value: formatCurrency(budget.clubsExpense), negative: true }] : []),
    { label: 'הוצאות לתלמיד', value: formatCurrency(budget.studentExpenses), negative: true },
    ...(budget.caharonExpense > 0 ? [{ label: 'הוצאות צהרון', value: formatCurrency(budget.caharonExpense), negative: true }] : []),
    ...(budget.profDevExpense > 0 ? [{ label: 'פיתוח מקצועי', value: formatCurrency(budget.profDevExpense), negative: true }] : []),
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
  const { classes, addClass, updateClass, deleteClass, constants, isSimpleMode, user } = useApp();
  const canEdit = MANAGERS.includes(user?.role);
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
    balance: classesWithBudget.reduce((s, c) => s + c.budget.balance, 0),
  }), [classesWithBudget]);

  const FILTERS = [
    { key: 'all', label: 'כל הכיתות' },
    { key: 'full', label: `תקן מלא (${constants.fullClassStudentThreshold}+)` },
    { key: 'half', label: `חצי תקן (${constants.halfClassStudentThreshold}-${constants.fullClassStudentThreshold - 1})` },
    { key: 'none', label: `ללא תקן (<${constants.halfClassStudentThreshold})` },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ניהול כיתות</h2>
          <p className="text-gray-500 text-sm mt-0.5">{classes.length} כיתות · {totals.students} תלמידים</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal('new')} className="btn-primary flex-shrink-0">
            <Plus size={16} />
            הוסף כיתה
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className={`grid gap-3 ${isSimpleMode ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {[
          { label: 'כיתות', value: classes.length, color: 'text-teal-600 bg-teal-50' },
          { label: 'תלמידים', value: totals.students, color: 'text-purple-600 bg-purple-50' },
          ...(isSimpleMode ? [] : [
            { label: 'הכנסות כיתות', value: formatCurrency(totals.income), color: 'text-green-600 bg-green-50' },
            { label: 'יתרת כיתות', value: formatCurrencyFull(totals.balance), color: totals.balance < 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
          ]),
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-3 ${card.color.split(' ')[1]}`}>
            <p className="text-gray-500 text-xs">{card.label}</p>
            <p className={`font-black text-lg mt-0.5 ${card.color.split(' ')[0]}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs — budget mode only */}
      {!isSimpleMode && classes.length > 0 && (
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f.key ? 'tab-active' : 'tab-inactive'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState
          icon={School}
          title="עוד אין כיתות"
          hint="מוסיפים כל כיתה עם מספר התלמידים שלה — והמערכת מחשבת הכל לבד."
          actionLabel={canEdit ? 'הוספת כיתה ראשונה' : undefined}
          onAction={canEdit ? () => setModal('new') : undefined}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((cls, i) => {
              const typeInfo = CLASS_TYPE[cls.budget.type];
              const isExp = expanded === cls.id;
              return (
                <div key={cls.id} className="card p-4 spring-enter" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                  <div className="flex items-start justify-between gap-2">
                    <button className="flex-1 min-w-0 text-right" onClick={() => setExpanded(isExp ? null : cls.id)}>
                      <p className="font-bold text-gray-800">{cls.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Users size={11} /> {cls.studentCount} תלמידים
                        {cls.notes ? ` · ${cls.notes}` : ''}
                      </p>
                    </button>
                    {!isSimpleMode && <span className={`badge ${typeInfo?.color} flex-shrink-0`}>{typeInfo?.label}</span>}
                  </div>

                  {!isSimpleMode && (
                    <button
                      className="w-full flex items-center justify-between mt-3 pt-3 border-t border-gray-50"
                      onClick={() => setExpanded(isExp ? null : cls.id)}
                      aria-expanded={isExp}
                    >
                      <span className={`font-bold text-sm ${cls.budget.isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                        {cls.budget.isDeficit ? 'גירעון: ' : 'עודף: '}{formatCurrencyFull(cls.budget.balance)}
                      </span>
                      <span className="text-teal-600 text-xs flex items-center gap-1">
                        {isExp ? 'סגירת פירוט' : 'פירוט תקציב'}
                        {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </span>
                    </button>
                  )}

                  {isExp && !isSimpleMode && <BudgetBreakdown budget={cls.budget} />}

                  {canEdit && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setModal(cls)} className="btn-outline btn-sm flex-1 justify-center">
                        <Edit2 size={13} /> עריכה
                      </button>
                      <button onClick={() => setDeleteConfirm(cls)} className="btn-outline btn-sm flex-1 justify-center text-red-500 hover:bg-red-50">
                        <Trash2 size={13} /> מחיקה
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">כיתה</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-medium">תלמידים</th>
                    {!isSimpleMode && (
                      <>
                        <th className="text-center px-3 py-3 text-gray-500 font-medium">תקן</th>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium">הכנסה ממשרד</th>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium">הכנסה כוללת</th>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium">הוצאות</th>
                        <th className="text-left px-3 py-3 text-gray-500 font-medium">יתרה</th>
                      </>
                    )}
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(cls => {
                    const typeInfo = CLASS_TYPE[cls.budget.type];
                    const isExp = expanded === cls.id;
                    return (
                      <Fragment key={cls.id}>
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => !isSimpleMode && setExpanded(isExp ? null : cls.id)}
                        >
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
                          {!isSimpleMode && (
                            <>
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
                            </>
                          )}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => setModal(cls)}
                                    aria-label={`עריכת ${cls.name}`}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(cls)}
                                    aria-label={`מחיקת ${cls.name}`}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                              {!isSimpleMode && (isExp ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />)}
                            </div>
                          </td>
                        </tr>
                        {isExp && !isSimpleMode && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={8} className="px-4 pb-4">
                              <BudgetBreakdown budget={cls.budget} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-1">אין כיתות בסינון זה</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {modal && (
        <ClassModal
          cls={modal === 'new' ? null : modal}
          onSave={data => modal === 'new' ? addClass(data) : updateClass(modal.id, data)}
          onClose={() => setModal(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="מחיקת כיתה"
          message={`למחוק את ${deleteConfirm.name}? לא ניתן לבטל פעולה זו.`}
          onConfirm={() => deleteClass(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
