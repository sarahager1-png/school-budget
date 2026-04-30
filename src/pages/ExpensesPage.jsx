import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Send, AlertTriangle, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { annualAmount, formatCurrency } from '../lib/calculations.js';
import { EXPENSE_STATUS } from '../data/constants.js';

const CATEGORY_COLORS = {
  ec1: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  ec2: { bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700' },
  ec3: { bg: 'bg-coral-50', text: 'text-coral-600', dot: 'bg-coral-500', badge: 'bg-coral-100 text-coral-700' },
  ec4: { bg: 'bg-gold-50', text: 'text-gold-600', dot: 'bg-gold-500', badge: 'bg-gold-100 text-gold-700' },
  ec5: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
};

function ExpenseModal({ exp, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    name: exp?.name || '',
    categoryId: exp?.categoryId || categories[0]?.id || '',
    amount: exp?.amount || '',
    period: exp?.period || 'monthly',
    status: exp?.status || 'pending',
    isRecurring: exp?.isRecurring ?? false,
    notes: exp?.notes || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 mb-5">{exp ? 'עריכת הוצאה' : 'הוספת הוצאה'}</h2>
        <div className="space-y-4">
          <div>
            <label className="label">שם ההוצאה</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="שם ההוצאה" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">קטגוריה</label>
              <select className="input" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">תדירות</label>
              <select className="input" value={form.period} onChange={e => set('period', e.target.value)}>
                <option value="monthly">חודשי</option>
                <option value="yearly">שנתי</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">סכום ({form.period === 'monthly' ? '₪/חודש' : '₪/שנה'})</label>
            <input className="input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
            {form.period === 'monthly' && form.amount && (
              <p className="text-xs text-teal-600 mt-1">שנתי: {formatCurrency(Number(form.amount) * 12)}</p>
            )}
          </div>
          <div>
            <label className="label">סטטוס</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pending">ממתין אישור</option>
              <option value="approved">מאושר</option>
              <option value="rejected">נדחה</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="recurring" checked={form.isRecurring} onChange={e => set('isRecurring', e.target.checked)} className="w-4 h-4 text-teal-500" />
            <label htmlFor="recurring" className="text-sm text-gray-700">הוצאה חוזרת</label>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { onSave({ ...form, amount: Number(form.amount) }); onClose(); }}
            className="btn-primary flex-1 justify-center"
          >
            שמור
          </button>
          <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
        </div>
      </div>
    </div>
  );
}

function RequestModal({ exp, assignees, onSave, onClose }) {
  const [form, setForm] = useState({
    name: exp?.name || '',
    amount: exp?.amount || '',
    notes: exp?.notes || '',
    assignedTo: 'u2',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 mb-1">צור בקשת תשלום</h2>
        <p className="text-gray-500 text-sm mb-5">ישלח לשליח לביצוע</p>
        <div className="space-y-4">
          <div>
            <label className="label">תיאור הבקשה</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">סכום (₪)</label>
            <input className="input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="label">הערות לשליח</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { onSave({ ...form, amount: Number(form.amount), expenseId: exp.id, status: 'pending' }); onClose(); }}
            className="btn-primary flex-1 justify-center"
          >
            <Send size={14} />
            שלח לשליח
          </button>
          <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
        </div>
      </div>
    </div>
  );
}

const EVENTS_CAP_PER_STUDENT = 1400;

function EventsBudgetBanner({ expenses, classes }) {
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const ec3Total = expenses.filter(e => e.categoryId === 'ec3').reduce((s, e) => s + annualAmount(e), 0);
  const perStudent = totalStudents > 0 ? Math.round(ec3Total / totalStudents) : 0;
  const perStudentMonthly = totalStudents > 0 ? Math.round(ec3Total / totalStudents / 10) : 0;
  const pct = Math.min(Math.round((perStudent / EVENTS_CAP_PER_STUDENT) * 100), 100);
  const over = perStudent > EVENTS_CAP_PER_STUDENT;

  return (
    <div className={`rounded-xl p-4 border ${over ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-start gap-2.5">
        {over
          ? <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          : <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className={`font-bold text-sm ${over ? 'text-red-700' : 'text-green-700'}`}>
            כלל תקציב אירועים — מסיבות, ארועים וצוות
          </p>
          <p className={`text-xs mt-0.5 ${over ? 'text-red-600' : 'text-green-600'}`}>
            תקרה: {EVENTS_CAP_PER_STUDENT.toLocaleString('he-IL')} ₪ לתלמיד לשנה
          </p>
          <div className="flex flex-wrap gap-4 mt-2.5">
            <div>
              <p className="text-xs text-gray-500">סה"כ פעילויות</p>
              <p className="font-black text-base text-gray-800">₪{ec3Total.toLocaleString('he-IL')}</p>
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
  const { expenses, expenseCategories, classes, addExpense, updateExpense, deleteExpense, addExpenseRequest } = useApp();
  const [activeCategory, setActiveCategory] = useState('all');
  const [modal, setModal] = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const categoryMap = useMemo(() =>
    Object.fromEntries(expenseCategories.map(c => [c.id, c])),
    [expenseCategories],
  );

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ניהול הוצאות</h2>
          <p className="text-gray-500 text-sm mt-0.5">סה״כ שנתי: {formatCurrency(grandTotal)}</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary">
          <Plus size={16} />
          הוסף הוצאה
        </button>
      </div>

      {/* Events Budget Banner */}
      {(activeCategory === 'all' || activeCategory === 'ec3') && (
        <EventsBudgetBanner expenses={expenses} classes={classes} />
      )}

      {/* Category Tab Bar */}
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

      {/* Expense Table */}
      <div className="card overflow-hidden">
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
                const cc = CATEGORY_COLORS[exp.categoryId] || CATEGORY_COLORS.ec1;
                const st = EXPENSE_STATUS[exp.status];
                return (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{exp.name}</div>
                      {exp.notes && <div className="text-xs text-gray-400 mt-0.5">{exp.notes}</div>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {cat && (
                        <span className={`badge ${cc.badge}`}>{cat.name}</span>
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
                          title="צור בקשת תשלום"
                          className="p-1.5 hover:bg-teal-50 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
                        >
                          <Send size={13} />
                        </button>
                        <button
                          onClick={() => setModal(exp)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(exp.id)}
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
          {expenseCategories.map(cat => {
            const cc = CATEGORY_COLORS[cat.id] || CATEGORY_COLORS.ec1;
            return (
              <div key={cat.id} className={`card p-4 cursor-pointer hover:shadow-md transition-shadow`} onClick={() => setActiveCategory(cat.id)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />
                  <p className="text-gray-500 text-xs">{cat.name}</p>
                </div>
                <p className={`font-black text-lg ${cc.text}`}>{formatCurrency(totalsByCategory[cat.id] || 0)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {expenses.filter(e => e.categoryId === cat.id).length} סעיפים
                </p>
              </div>
            );
          })}
        </div>
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
          onSave={data => addExpenseRequest({ ...data, assignedTo: 'u2' })}
          onClose={() => setRequestModal(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-800 mb-2">מחיקת הוצאה</h3>
            <p className="text-gray-500 text-sm mb-5">האם למחוק? לא ניתן לבטל.</p>
            <div className="flex gap-3">
              <button onClick={() => { deleteExpense(deleteConfirm); setDeleteConfirm(null); }} className="btn-danger flex-1 justify-center">מחק</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1 justify-center">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
