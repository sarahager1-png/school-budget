import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Send, AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { annualAmount, formatCurrency, categoryColor } from '../lib/calculations.js';
import { EXPENSE_STATUS, EVENTS_CAP_PER_STUDENT } from '../data/constants.js';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Picker from '../components/ui/Picker.jsx';

function ExpenseModal({ exp, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    name: exp?.name || '',
    categoryId: exp?.categoryId || categories[0]?.id || '',
    amount: exp?.amount || '',
    period: exp?.period || 'monthly',
    status: exp?.status || 'approved',
    isRecurring: exp?.isRecurring ?? false,
    notes: exp?.notes || '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return setError('חסר שם להוצאה — למשל: שכר דירה');
    if (!form.amount || Number(form.amount) <= 0) return setError('חסר סכום');
    onSave({ ...form, amount: Number(form.amount) });
    onClose();
  };

  return (
    <Modal title={exp ? 'עריכת הוצאה' : 'הוספת הוצאה'} onClose={onClose}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">שם ההוצאה</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="למשל: שכר דירה" />
        </div>
        <Picker
          label="קטגוריה"
          value={form.categoryId}
          onChange={v => set('categoryId', v)}
          options={categories.map((c, i) => ({ value: c.id, label: c.name, color: categoryColor(c, i) }))}
        />
        <Picker
          label="תדירות"
          value={form.period}
          onChange={v => set('period', v)}
          options={[
            { value: 'monthly', label: 'חודשי', hint: 'הסכום יוכפל ב-12 לחישוב השנתי' },
            { value: 'yearly', label: 'שנתי', hint: 'סכום אחד לכל השנה' },
          ]}
        />
        <div>
          <label className="label">סכום ({form.period === 'monthly' ? '₪ לחודש' : '₪ לשנה'})</label>
          <input className="input" type="number" inputMode="numeric" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
          {form.period === 'monthly' && form.amount > 0 && (
            <p className="text-xs text-teal-600 mt-1">סה״כ שנתי: {formatCurrency(Number(form.amount) * 12)}</p>
          )}
        </div>
        <Picker
          label="סטטוס"
          value={form.status}
          onChange={v => set('status', v)}
          options={[
            { value: 'approved', label: 'מאושר' },
            { value: 'pending', label: 'ממתין אישור' },
            { value: 'rejected', label: 'נדחה' },
          ]}
        />
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

function RequestModal({ exp, onSave, onClose }) {
  const [form, setForm] = useState({
    name: exp?.name || '',
    amount: exp?.amount || '',
    notes: '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSend = () => {
    if (!form.name.trim()) return setError('חסר תיאור לבקשה');
    if (!form.amount || Number(form.amount) <= 0) return setError('חסר סכום');
    onSave({ name: form.name, notes: form.notes, amount: Number(form.amount), expenseId: exp.id });
    onClose();
  };

  return (
    <Modal title="יצירת בקשת תשלום" subtitle="הבקשה תישלח לשליח לביצוע" onClose={onClose} maxWidth="max-w-sm">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">תיאור הבקשה</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">סכום (₪)</label>
          <input className="input" type="number" inputMode="numeric" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>
        <div>
          <label className="label">הערות לשליח</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="איפה קונים, למי לשלם..." />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={handleSend} className="btn-primary flex-1 justify-center">
          <Send size={14} />
          שלח לשליח
        </button>
        <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}

function EventsBudgetBanner({ expenses, classes, categories }) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const eventCatIds = new Set(categories.filter(c => c.kind === 'events').map(c => c.id));
  const eventsTotal = expenses.filter(e => eventCatIds.has(e.categoryId)).reduce((s, e) => s + annualAmount(e), 0);
  const perStudent = totalStudents > 0 ? Math.round(eventsTotal / totalStudents) : 0;
  const perStudentMonthly = totalStudents > 0 ? Math.round(eventsTotal / totalStudents / 10) : 0;
  const pct = Math.min(Math.round((perStudent / EVENTS_CAP_PER_STUDENT) * 100), 100);
  const over = perStudent > EVENTS_CAP_PER_STUDENT;

  if (totalStudents === 0) return null;

  return (
    <div className={`rounded-xl p-4 border ${over ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-start gap-2.5">
        {over
          ? <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          : <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className={`font-bold text-sm ${over ? 'text-red-700' : 'text-green-700'}`}>
            כלל תקציב אירועים — מסיבות, אירועים וצוות
          </p>
          <p className={`text-xs mt-0.5 ${over ? 'text-red-600' : 'text-green-600'}`}>
            תקרה: {EVENTS_CAP_PER_STUDENT.toLocaleString('he-IL')} ₪ לתלמיד לשנה
          </p>
          <div className="flex flex-wrap gap-4 mt-2.5">
            <div>
              <p className="text-xs text-gray-500">סה"כ פעילויות ואירועים</p>
              <p className="font-black text-base text-gray-800">₪{eventsTotal.toLocaleString('he-IL')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">לתלמיד / שנה</p>
              <p className={`font-black text-base ${over ? 'text-red-600' : 'text-green-600'}`}>
                ₪{perStudent.toLocaleString('he-IL')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">לתלמיד / חודש</p>
              <p className="font-black text-base text-gray-700">₪{perStudentMonthly.toLocaleString('he-IL')}</p>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className={over ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>{pct}% מהתקרה</span>
              <span className="text-gray-400">תקרה: ₪{EVENTS_CAP_PER_STUDENT.toLocaleString('he-IL')}</span>
            </div>
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { expenses, expenseCategories, classes, addExpense, updateExpense, deleteExpense, addExpenseRequest, isSimpleMode } = useApp();
  const [activeCategory, setActiveCategory] = useState('all');
  const [modal, setModal] = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const categoryMap = useMemo(() =>
    Object.fromEntries(expenseCategories.map(c => [c.id, c])),
    [expenseCategories],
  );
  const colorOf = (catId) => {
    const i = expenseCategories.findIndex(c => c.id === catId);
    return categoryColor(categoryMap[catId], Math.max(i, 0));
  };

  const filtered = useMemo(() =>
    activeCategory === 'all' ? expenses : expenses.filter(e => e.categoryId === activeCategory),
    [expenses, activeCategory],
  );

  const totalsByCategory = useMemo(() =>
    Object.fromEntries(
      expenseCategories.map(cat => [
        cat.id,
        expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + annualAmount(e), 0),
      ]),
    ),
    [expenses, expenseCategories],
  );

  const grandTotal = Object.values(totalsByCategory).reduce((s, v) => s + v, 0);

  const TABS = [
    { key: 'all', label: 'הכל', amount: grandTotal },
    ...expenseCategories.map(c => ({ key: c.id, label: c.name, amount: totalsByCategory[c.id] })),
  ];

  const showEventsBanner = !isSimpleMode &&
    (activeCategory === 'all' || categoryMap[activeCategory]?.kind === 'events');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ניהול הוצאות</h2>
          <p className="text-gray-500 text-sm mt-0.5">סה״כ שנתי: {formatCurrency(grandTotal)}</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex-shrink-0">
          <Plus size={16} />
          הוסף הוצאה
        </button>
      </div>

      {/* Events Budget Banner */}
      {showEventsBanner && (
        <EventsBudgetBanner expenses={expenses} classes={classes} categories={expenseCategories} />
      )}

      {/* Category Tab Bar */}
      {expenses.length > 0 && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeCategory === tab.key ? 'tab-active' : 'tab-inactive'}`}
            >
              <span>{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${activeCategory === tab.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}`}>
                {formatCurrency(tab.amount)}
              </span>
            </button>
          ))}
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="עוד אין הוצאות"
          hint="מוסיפים כל הוצאה קבועה או חד-פעמית — שכר, שכירות, אירועים — והמערכת מסכמת הכל לשנה."
          actionLabel="הוספת הוצאה ראשונה"
          onAction={() => setModal('new')}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(exp => {
              const cat = categoryMap[exp.categoryId];
              const st = EXPENSE_STATUS[exp.status];
              return (
                <div key={exp.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800">{exp.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {cat && (
                          <span className="badge bg-gray-100 text-gray-600">
                            <span className="w-2 h-2 rounded-full" style={{ background: colorOf(exp.categoryId) }} />
                            {cat.name}
                          </span>
                        )}
                        <span className={`badge ${st?.color}`}>{st?.label}</span>
                      </div>
                      {exp.notes && <p className="text-xs text-gray-400 mt-1.5">{exp.notes}</p>}
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="font-black text-gray-800">{formatCurrency(annualAmount(exp))}</p>
                      <p className="text-xs text-gray-400">
                        {exp.period === 'monthly' ? `${formatCurrency(exp.amount)} לחודש` : 'לשנה'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                    <button onClick={() => setRequestModal(exp)} className="btn-outline btn-sm flex-1 justify-center text-teal-600">
                      <Send size={13} /> לתשלום
                    </button>
                    <button onClick={() => setModal(exp)} className="btn-outline btn-sm flex-1 justify-center">
                      <Edit2 size={13} /> עריכה
                    </button>
                    <button onClick={() => setDeleteConfirm(exp)} className="btn-outline btn-sm flex-1 justify-center text-red-500 hover:bg-red-50">
                      <Trash2 size={13} /> מחיקה
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="card text-center py-10 text-gray-400">אין הוצאות בקטגוריה זו</div>
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">שם ההוצאה</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-medium">קטגוריה</th>
                    <th className="text-left px-3 py-3 text-gray-500 font-medium">סכום</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-medium">תדירות</th>
                    <th className="text-left px-3 py-3 text-gray-500 font-medium">שנתי</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-medium">סטטוס</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(exp => {
                    const cat = categoryMap[exp.categoryId];
                    const st = EXPENSE_STATUS[exp.status];
                    return (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{exp.name}</div>
                          {exp.notes && <div className="text-xs text-gray-400 mt-0.5">{exp.notes}</div>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {cat && (
                            <span className="badge bg-gray-100 text-gray-600">
                              <span className="w-2 h-2 rounded-full" style={{ background: colorOf(exp.categoryId) }} />
                              {cat.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-left font-medium text-gray-700">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="badge bg-gray-100 text-gray-600">
                            {exp.period === 'monthly' ? 'חודשי' : 'שנתי'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-left font-bold text-gray-800">
                          {formatCurrency(annualAmount(exp))}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`badge ${st?.color}`}>{st?.label}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => setRequestModal(exp)}
                              title="יצירת בקשת תשלום"
                              aria-label={`בקשת תשלום — ${exp.name}`}
                              className="p-1.5 hover:bg-teal-50 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
                            >
                              <Send size={13} />
                            </button>
                            <button
                              onClick={() => setModal(exp)}
                              aria-label={`עריכת ${exp.name}`}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(exp)}
                              aria-label={`מחיקת ${exp.name}`}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">אין הוצאות בקטגוריה זו</div>
            )}
          </div>

          {/* Totals per category */}
          {activeCategory === 'all' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {expenseCategories.map((cat, i) => (
                <button key={cat.id} className="card p-4 text-right cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveCategory(cat.id)}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: categoryColor(cat, i) }} />
                    <p className="text-gray-500 text-xs">{cat.name}</p>
                  </div>
                  <p className="font-black text-lg text-gray-800">{formatCurrency(totalsByCategory[cat.id] || 0)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {expenses.filter(e => e.categoryId === cat.id).length} סעיפים
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {modal && (
        <ExpenseModal
          exp={modal === 'new' ? null : modal}
          categories={expenseCategories}
          onSave={data => modal === 'new' ? addExpense(data) : updateExpense(modal.id, data)}
          onClose={() => setModal(null)}
        />
      )}

      {requestModal && (
        <RequestModal
          exp={requestModal}
          onSave={data => addExpenseRequest(data)}
          onClose={() => setRequestModal(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="מחיקת הוצאה"
          message={`למחוק את "${deleteConfirm.name}"? לא ניתן לבטל.`}
          onConfirm={() => deleteExpense(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
