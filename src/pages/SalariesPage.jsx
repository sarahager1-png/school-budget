import { useState, useEffect, useMemo } from 'react';
import { Plus, Upload, CheckCircle, Trash2, Save, Users, Calendar, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';
import { formatCurrency } from '../lib/calculations.js';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { MANAGERS } from '../data/constants.js';

function getSchoolMonths(year) {
  // School year: Sep year → Aug year+1
  const months = [];
  for (let m = 8; m <= 11; m++) {
    months.push(new Date(year, m, 1));
  }
  for (let m = 0; m <= 7; m++) {
    months.push(new Date(year + 1, m, 1));
  }
  return months;
}

function monthKey(date) {
  return date.toISOString().split('T')[0].slice(0, 7);
}

function EmployeeForm({ employee, onSave, onClose }) {
  const [form, setForm] = useState(employee || { name: '', role: '', monthlySalary: '', notes: '' });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return setError('חסר שם עובד/ת');
    if (!form.monthlySalary || Number(form.monthlySalary) <= 0) return setError('חסרה משכורת חודשית');
    onSave({ ...form, monthlySalary: Number(form.monthlySalary) });
    onClose();
  };

  return (
    <Modal title={employee ? 'עריכת עובד/ת' : 'הוספת עובד/ת'} onClose={onClose} maxWidth="max-w-sm">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">שם מלא</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="שם העובד/ת" />
        </div>
        <div>
          <label className="label">תפקיד</label>
          <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="מנהלת / מזכירה / ..." />
        </div>
        <div>
          <label className="label">משכורת חודשית (₪)</label>
          <input className="input" type="number" inputMode="numeric" min="0" value={form.monthlySalary} onChange={e => set('monthlySalary', e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="label">הערות</label>
          <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="הערות..." />
        </div>
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

function PaymentModal({ employee, month, payment, user, notify, onSave, onClose }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState(payment?.notes || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const monthLabel = new Date(month + '-01').toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  const handlePay = async () => {
    if (!file) {
      onSave({ status: 'paid', notes, receiptUrl: null });
      onClose();
      return;
    }
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${user.schoolId}/salaries/${employee.id}-${month}.${ext}`;
      const { error: upErr } = await supabase.storage.from('school-documents').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('school-documents').getPublicUrl(path);
      onSave({ status: 'paid', notes, receiptUrl: publicUrl });
      onClose();
    } catch (err) {
      setError('שגיאה בהעלאת הקובץ — אפשר גם לאשר תשלום בלי קובץ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="אישור תשלום משכורת"
      subtitle={`${employee.name} — ${monthLabel} — ${formatCurrency(employee.monthlySalary)}`}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">קובץ אסמכתא (לא חובה)</label>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-teal-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('salary-receipt').click()}
          >
            <Upload size={20} className="mx-auto text-gray-400 mb-1" />
            <p className="text-sm text-gray-500">{file ? file.name : 'לחצי לבחירת קובץ'}</p>
          </div>
          <input id="salary-receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setFile(e.target.files[0])} />
        </div>
        <div>
          <label className="label">הערות</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות..." />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={handlePay} disabled={uploading} className="btn-primary flex-1 justify-center disabled:opacity-60">
          <CheckCircle size={14} />
          {uploading ? 'מעלה...' : 'אשר תשלום'}
        </button>
        <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}

export default function SalariesPage() {
  const { user, currentYear, notify } = useApp();
  const canEdit = MANAGERS.includes(user?.role);
  const [activeTab, setActiveTab] = useState('monthly');
  const [employees, setEmployees] = useState([]);
  const [payments, setPayments] = useState({}); // { 'empId-YYYY-MM': { status, receiptUrl, notes } }
  const [selectedMonth, setSelectedMonth] = useState('');
  const [employeeForm, setEmployeeForm] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null); // { employee, month }
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentYear?.year || new Date().getFullYear();
  const months = useMemo(() => getSchoolMonths(year), [year]);

  // Default selected month = current month
  useEffect(() => {
    setSelectedMonth(monthKey(new Date()));
  }, []);

  // Load employees + payments
  useEffect(() => {
    if (!user?.schoolId) return;

    const loadData = async () => {
      const [empRes, payRes] = await Promise.all([
        supabase.from('employees').select('*').eq('school_id', user.schoolId).eq('is_active', true).order('name'),
        supabase.from('salary_payments').select('*').eq('school_id', user.schoolId),
      ]);
      if (empRes.data) {
        setEmployees(empRes.data.map(e => ({
          id: e.id, name: e.name, role: e.role,
          monthlySalary: Number(e.monthly_salary), isActive: e.is_active, notes: e.notes,
        })));
      }
      if (payRes.data) {
        const map = {};
        payRes.data.forEach(p => {
          map[`${p.employee_id}-${p.month.slice(0, 7)}`] = {
            id: p.id, status: p.status, receiptUrl: p.receipt_url, notes: p.notes,
          };
        });
        setPayments(map);
      }
      setLoading(false);
    };
    loadData();
  }, [user?.schoolId]);

  const addEmployee = async (data) => {
    const { data: row, error } = await supabase.from('employees').insert({
      school_id: user.schoolId, name: data.name, role: data.role,
      monthly_salary: data.monthlySalary, notes: data.notes, is_active: true,
    }).select().single();
    if (error || !row) return notify('הפעולה לא נשמרה — נסי שוב', 'error');
    setEmployees(prev => [...prev, { id: row.id, name: row.name, role: row.role, monthlySalary: Number(row.monthly_salary), isActive: true, notes: row.notes }]);
    notify('העובד/ת נוספו ✓');
  };

  const deleteEmployee = async (id) => {
    const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', id);
    if (error) return notify('הפעולה לא נשמרה — נסי שוב', 'error');
    setEmployees(prev => prev.filter(e => e.id !== id));
    notify('העובד/ת הוסרו');
  };

  const handlePayment = async (employee, month, data) => {
    const key = `${employee.id}-${month}`;
    const existing = payments[key];
    const dbData = {
      school_id: user.schoolId, employee_id: employee.id,
      month: month + '-01', amount: employee.monthlySalary,
      status: data.status, receipt_url: data.receiptUrl,
      notes: data.notes, paid_at: new Date().toISOString(), paid_by: user.id,
    };
    let error;
    if (existing?.id) {
      ({ error } = await supabase.from('salary_payments').update(dbData).eq('id', existing.id));
      dbData.id = existing.id;
    } else {
      const res = await supabase.from('salary_payments').insert(dbData).select().single();
      error = res.error;
      if (res.data) dbData.id = res.data.id;
    }
    if (error) return notify('התשלום לא נשמר — נסי שוב', 'error');
    setPayments(prev => ({ ...prev, [key]: { id: dbData.id, status: data.status, receiptUrl: data.receiptUrl, notes: data.notes } }));
    notify('התשלום נרשם ✓');
  };

  const monthPayments = employees.map(emp => ({
    emp,
    payment: payments[`${emp.id}-${selectedMonth}`] || null,
  }));

  const paidCount = monthPayments.filter(p => p.payment?.status === 'paid').length;
  const totalMonth = employees.reduce((s, e) => s + e.monthlySalary, 0);

  if (loading) return <div className="card p-8 text-center text-gray-400">טוען...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">ניהול משכורות</h2>
        <p className="text-gray-500 text-sm mt-0.5">{employees.length} עובדים — סה״כ חודשי {formatCurrency(totalMonth)}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full">
        {[
          { key: 'monthly', label: 'תשלום חודשי', icon: Calendar },
          { key: 'employees', label: 'עובדים', icon: Users },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'tab-active' : 'tab-inactive'}`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Monthly Tab */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {employees.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="עוד אין עובדים"
              hint='קודם מוסיפים את העובדים בלשונית "עובדים", ואז מסמנים כאן כל חודש מי קיבל משכורת.'
              actionLabel={canEdit ? 'הוספת עובד/ת' : undefined}
              onAction={canEdit ? () => { setActiveTab('employees'); setEmployeeForm({}); } : undefined}
            />
          ) : (
            <>
              {/* Month selector */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {months.map(m => {
                  const key = monthKey(m);
                  const monthPaid = employees.filter(e => payments[`${e.id}-${key}`]?.status === 'paid').length;
                  const isSelected = key === selectedMonth;
                  const label = m.toLocaleDateString('he-IL', { month: 'short' });
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedMonth(key)}
                      className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                        isSelected
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      <span>{label}</span>
                      <span className={`text-xs mt-0.5 font-bold ${isSelected ? 'text-white/80' : monthPaid === employees.length && employees.length > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                        {monthPaid}/{employees.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4 text-center">
                  <p className="text-2xl font-black text-green-600">{paidCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">שולמו</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-black text-gold-600">{employees.length - paidCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">ממתינים</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-lg font-black text-teal-600">{formatCurrency(totalMonth)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">סה״כ חודשי</p>
                </div>
              </div>

              {/* Employee list for selected month */}
              <div className="space-y-2">
                {monthPayments.map(({ emp, payment }) => {
                  const paid = payment?.status === 'paid';
                  return (
                    <div key={emp.id} className={`card p-4 flex items-center gap-4 ${paid ? 'border-green-200 bg-green-50/30' : ''}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${paid ? 'bg-green-500' : 'bg-gray-400'}`}>
                        {paid ? <CheckCircle size={18} /> : emp.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.role}</p>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="font-black text-gray-800">{formatCurrency(emp.monthlySalary)}</p>
                        {paid ? (
                          <p className="text-xs text-green-600 font-medium">שולם ✓</p>
                        ) : (
                          <p className="text-xs text-gold-600">ממתין</p>
                        )}
                      </div>
                      {!paid && canEdit && (
                        <button
                          onClick={() => setPaymentModal({ employee: emp, month: selectedMonth })}
                          className="btn-primary btn-sm flex-shrink-0"
                        >
                          <CheckCircle size={13} />
                          שולם
                        </button>
                      )}
                      {paid && payment?.receiptUrl && (
                        <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm flex-shrink-0 text-xs">
                          קבלה
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{employees.length} עובדים פעילים</p>
            {canEdit && (
              <button onClick={() => setEmployeeForm({})} className="btn-primary btn-sm">
                <Plus size={14} />
                הוסף עובד/ת
              </button>
            )}
          </div>

          {employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="עוד אין עובדים"
              hint="מוסיפים כל עובד/ת עם המשכורת החודשית — ואז אפשר לסמן תשלומים חודש-חודש."
              actionLabel={canEdit ? 'הוספת עובד/ת' : undefined}
              onAction={canEdit ? () => setEmployeeForm({}) : undefined}
            />
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">שם</th>
                    <th className="text-right px-3 py-3 text-gray-500 font-medium">תפקיד</th>
                    <th className="text-left px-3 py-3 text-gray-500 font-medium">משכורת</th>
                    {canEdit && <th className="px-3 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                      <td className="px-3 py-3 text-gray-500">{emp.role}</td>
                      <td className="px-3 py-3 text-left font-bold text-gray-800">{formatCurrency(emp.monthlySalary)}</td>
                      {canEdit && (
                        <td className="px-3 py-3 text-left">
                          <button
                            onClick={() => setDeleteConfirm(emp)}
                            aria-label={`הסרת ${emp.name}`}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-700" colSpan={2}>סה״כ חודשי</td>
                    <td className="px-3 py-3 text-left font-black text-teal-600">{formatCurrency(totalMonth)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {employeeForm !== null && (
        <EmployeeForm
          employee={Object.keys(employeeForm).length ? employeeForm : null}
          onSave={addEmployee}
          onClose={() => setEmployeeForm(null)}
        />
      )}

      {paymentModal && (
        <PaymentModal
          employee={paymentModal.employee}
          month={paymentModal.month}
          payment={payments[`${paymentModal.employee.id}-${paymentModal.month}`]}
          user={user}
          notify={notify}
          onSave={data => handlePayment(paymentModal.employee, paymentModal.month, data)}
          onClose={() => setPaymentModal(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="הסרת עובד/ת"
          message={`להסיר את ${deleteConfirm.name} מרשימת העובדים? היסטוריית התשלומים נשמרת.`}
          confirmLabel="הסרה"
          onConfirm={() => deleteEmployee(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
