import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { calculateClassBudget, formatCurrency } from '../lib/calculations.js';
import { CLASS_TYPE } from '../data/constants.js';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Picker from '../components/ui/Picker.jsx';

const INCOME_TYPE_LABELS = {
  donation: 'תרומות',
  municipal: 'עירייה',
  events: 'אירועים',
  parents: 'הורים',
  other: 'אחר',
};

function IncomeModal({ src, onSave, onClose }) {
  const [form, setForm] = useState({
    name: src?.name || '',
    amount: src?.amount || '',
    type: src?.type || 'other',
    notes: src?.notes || '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return setError('חסר שם למקור ההכנסה — למשל: מענק עירייה');
    if (!form.amount || Number(form.amount) <= 0) return setError('חסר סכום');
    onSave({ ...form, amount: Number(form.amount) });
    onClose();
  };

  return (
    <Modal title={src ? 'עריכת מקור הכנסה' : 'הוספת מקור הכנסה'} onClose={onClose}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">שם מקור ההכנסה</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="תרומות שנתיות" />
        </div>
        <div>
          <label className="label">סכום שנתי (₪)</label>
          <input className="input" type="number" inputMode="numeric" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="50000" />
        </div>
        <Picker
          label="סוג"
          value={form.type}
          onChange={v => set('type', v)}
          options={Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
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

export default function IncomePage() {
  const { classes, incomeSources, addIncomeSource, updateIncomeSource, deleteIncomeSource, constants, isSimpleMode } = useApp();
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const classBreakdowns = useMemo(
    () => classes.map(c => ({ ...c, budget: calculateClassBudget(c, constants) })),
    [classes, constants],
  );

  const totalMinistry = isSimpleMode ? 0 : classBreakdowns.reduce((s, c) => s + c.budget.ministryIncome, 0);
  const totalMinistryGrant = isSimpleMode ? 0 : classBreakdowns.reduce((s, c) => s + c.budget.ministryGrantIncome, 0);
  const totalStudentIncome = isSimpleMode ? 0 : classBreakdowns.reduce((s, c) => s + c.budget.studentIncome, 0);
  const totalAdditional = incomeSources.reduce((s, i) => s + (i.amount || 0), 0);
  const grandTotal = totalMinistry + totalMinistryGrant + totalStudentIncome + totalAdditional;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">הכנסות</h2>
          <p className="text-gray-500 text-sm mt-0.5">סה״כ שנתי: {formatCurrency(grandTotal)}</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex-shrink-0">
          <Plus size={16} />
          הוסף מקור הכנסה
        </button>
      </div>

      {/* Summary Row — budget mode only */}
      {!isSimpleMode && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'תקן משרד החינוך', value: totalMinistry, bar: 'bg-teal-500', pct: grandTotal ? totalMinistry / grandTotal * 100 : 0 },
            { label: 'תוספת לתלמיד — משרד', value: totalMinistryGrant, bar: 'bg-blue-500', pct: grandTotal ? totalMinistryGrant / grandTotal * 100 : 0 },
            { label: 'הכנסה לתלמיד', value: totalStudentIncome, bar: 'bg-purple-500', pct: grandTotal ? totalStudentIncome / grandTotal * 100 : 0 },
            { label: 'הכנסות נוספות', value: totalAdditional, bar: 'bg-gold-500', pct: grandTotal ? totalAdditional / grandTotal * 100 : 0 },
          ].map(item => (
            <div key={item.label} className="card p-4">
              <p className="text-gray-500 text-sm mb-1">{item.label}</p>
              <p className="text-xl md:text-2xl font-black text-gray-800">{formatCurrency(item.value)}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.bar}`} style={{ width: `${item.pct}%` }} />
                </div>
                <span className="text-xs text-gray-400">{item.pct.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ministry Breakdown by Class — budget mode only */}
      {!isSimpleMode && classes.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-teal-500" />
            פירוט הכנסות משרד החינוך לפי כיתה
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">כיתה</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">תלמידים</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">תקן</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">שעות/שבוע</th>
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">תקן משרד</th>
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">תוספת לתלמיד</th>
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">הכנסה לתלמיד</th>
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">סה״כ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {classBreakdowns.map(cls => {
                  const typeInfo = CLASS_TYPE[cls.budget.type];
                  return (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{cls.name}</td>
                      <td className="px-3 py-3 text-center text-gray-600">{cls.studentCount}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`badge ${typeInfo?.color}`}>{typeInfo?.label}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-teal-600">{cls.budget.ministryWeeklyHours}</td>
                      <td className="px-3 py-3 text-left font-medium text-teal-600">{formatCurrency(cls.budget.ministryIncome)}</td>
                      <td className="px-3 py-3 text-left font-medium text-blue-600">{formatCurrency(cls.budget.ministryGrantIncome)}</td>
                      <td className="px-3 py-3 text-left font-medium text-purple-600">{formatCurrency(cls.budget.studentIncome)}</td>
                      <td className="px-3 py-3 text-left font-bold text-gray-800">{formatCurrency(cls.budget.totalIncome)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className="px-4 py-3 font-bold text-gray-800">סה״כ</td>
                  <td className="px-3 py-3 text-center font-bold">{classes.reduce((s, c) => s + c.studentCount, 0)}</td>
                  <td />
                  <td />
                  <td className="px-3 py-3 text-left font-bold text-teal-600">{formatCurrency(totalMinistry)}</td>
                  <td className="px-3 py-3 text-left font-bold text-blue-600">{formatCurrency(totalMinistryGrant)}</td>
                  <td className="px-3 py-3 text-left font-bold text-purple-600">{formatCurrency(totalStudentIncome)}</td>
                  <td className="px-3 py-3 text-left font-bold text-gray-800">{formatCurrency(totalMinistry + totalMinistryGrant + totalStudentIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Additional Income Sources */}
      {incomeSources.length === 0 && isSimpleMode ? (
        <EmptyState
          icon={TrendingUp}
          title="עוד אין מקורות הכנסה"
          hint="רושמים כאן כל הכנסה: תרומות, מענקים, תשלומי הורים, אירועים."
          actionLabel="הוספת מקור הכנסה"
          onAction={() => setModal('new')}
        />
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{isSimpleMode ? 'מקורות הכנסה' : 'הכנסות נוספות'}</h3>
            <span className="font-bold text-gray-700">{formatCurrency(totalAdditional)}</span>
          </div>
          <div className="space-y-2">
            {incomeSources.map(src => (
              <div key={src.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex-1 min-w-0 basis-40">
                  <p className="font-medium text-gray-800 truncate">{src.name}</p>
                  {src.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{src.notes}</p>}
                </div>
                <span className="badge bg-gold-100 text-gold-700">{INCOME_TYPE_LABELS[src.type] || src.type}</span>
                <span className="font-bold text-gray-700 text-sm">{formatCurrency(src.amount)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal(src)} aria-label={`עריכת ${src.name}`} className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-teal-600 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteConfirm(src)} aria-label={`מחיקת ${src.name}`} className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {incomeSources.length === 0 && (
              <p className="text-center text-gray-400 py-6">
                עוד אין מקורות הכנסה נוספים — תרומות, עירייה, אירועים. מוסיפים בכפתור למעלה.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Grand Total */}
      <div className="card p-5 border-2 border-teal-200 bg-teal-50">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-teal-800 text-lg">סה״כ הכנסות שנתיות</h3>
          <span className="text-2xl md:text-3xl font-black text-teal-600">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {modal && (
        <IncomeModal
          src={modal === 'new' ? null : modal}
          onSave={data => modal === 'new' ? addIncomeSource(data) : updateIncomeSource(modal.id, data)}
          onClose={() => setModal(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="מחיקת מקור הכנסה"
          message={`למחוק את "${deleteConfirm.name}"? לא ניתן לבטל.`}
          onConfirm={() => deleteIncomeSource(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
