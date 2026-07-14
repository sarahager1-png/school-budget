import { Fragment, useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, HandCoins, ChevronDown, ChevronUp, CheckCircle, Receipt, ClipboardPaste } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';
import { formatCurrency } from '../lib/calculations.js';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Picker from '../components/ui/Picker.jsx';

const PAY_METHODS = [
  { value: 'transfer', label: 'העברה בנקאית' },
  { value: 'cash', label: 'מזומן' },
  { value: 'check', label: 'צ׳ק' },
  { value: 'card', label: 'אשראי' },
  { value: 'other', label: 'אחר' },
];
const methodLabel = (v) => PAY_METHODS.find(m => m.value === v)?.label || v || '';

function payerStatus(due, paid) {
  if (paid >= due && due > 0) return { key: 'paid', label: 'שולם', color: 'bg-green-100 text-green-700' };
  if (paid > 0) return { key: 'partial', label: 'שולם חלקית', color: 'bg-gold-100 text-gold-700' };
  return { key: 'none', label: 'טרם שולם', color: 'bg-red-100 text-red-700' };
}

function PayerModal({ payer, classes, defaultDue, onSave, onClose }) {
  const [form, setForm] = useState({
    name: payer?.name || '',
    className: payer?.className || '',
    amountDue: payer?.amountDue ?? defaultDue ?? '',
    notes: payer?.notes || '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const classOptions = [
    ...classes.map(c => ({ value: c.name, label: c.name })),
    { value: '', label: 'ללא כיתה / אחר' },
  ];

  const handleSave = () => {
    if (!form.name.trim()) return setError('חסר שם תלמיד/ה או משפחה');
    if (form.amountDue === '' || Number(form.amountDue) < 0) return setError('חסר סכום שנתי לגבייה');
    onSave({ ...form, amountDue: Number(form.amountDue) });
    onClose();
  };

  return (
    <Modal title={payer ? 'עריכת רשומת גבייה' : 'הוספת תלמיד/ה לגבייה'} onClose={onClose}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">שם התלמיד/ה או המשפחה</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="משפחת כהן — שרה" />
        </div>
        {classes.length > 0 ? (
          <Picker
            label="כיתה"
            value={form.className}
            onChange={v => set('className', v)}
            options={classOptions}
            placeholder="בחרי כיתה (לא חובה)"
          />
        ) : (
          <div>
            <label className="label">כיתה (לא חובה)</label>
            <input className="input" value={form.className} onChange={e => set('className', e.target.value)} placeholder="א'1" />
          </div>
        )}
        <div>
          <label className="label">שכר לימוד שנתי (₪)</label>
          <input className="input" type="number" inputMode="numeric" min="0" value={form.amountDue} onChange={e => set('amountDue', e.target.value)} />
        </div>
        <div>
          <label className="label">הערות</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="הנחה, הסדר תשלומים..." />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={handleSave} className="btn-primary flex-1 justify-center">שמור</button>
        <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}

function PaymentModal({ payer, remaining, onSave, onClose }) {
  const [form, setForm] = useState({
    amount: remaining > 0 ? remaining : '',
    method: 'transfer',
    paidAt: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.amount || Number(form.amount) <= 0) return setError('חסר סכום');
    onSave({ ...form, amount: Number(form.amount) });
    onClose();
  };

  return (
    <Modal
      title="רישום תשלום"
      subtitle={`${payer.name}${remaining > 0 ? ` — נותרו ${formatCurrency(remaining)}` : ''}`}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">סכום (₪)</label>
          <input className="input" type="number" inputMode="numeric" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} autoFocus />
        </div>
        <Picker label="אמצעי תשלום" value={form.method} onChange={v => set('method', v)} options={PAY_METHODS} />
        <div>
          <label className="label">תאריך</label>
          <input className="input" type="date" value={form.paidAt} onChange={e => set('paidAt', e.target.value)} />
        </div>
        <div>
          <label className="label">הערות</label>
          <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="מספר אסמכתא, פרטים..." />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={handleSave} className="btn-primary flex-1 justify-center">
          <CheckCircle size={14} />
          רשום תשלום
        </button>
        <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}

// ייבוא רשימת תלמידים: מדביקים ישר מאקסל / וואטסאפ — שם [כיתה] [סכום]
function ImportModal({ defaultDue, onImport, onClose }) {
  const [text, setText] = useState('');
  const [due, setDue] = useState(defaultDue || '');
  const [error, setError] = useState('');

  const parsed = useMemo(() => {
    const rows = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      // Excel paste = tab-separated; also accept comma
      const parts = line.split(/\t|,/).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) continue;
      const name = parts[0];
      let className = '';
      let amount = null;
      for (const p of parts.slice(1)) {
        const num = Number(p.replace(/[₪,\s]/g, ''));
        if (!Number.isNaN(num) && p.replace(/[₪,\s]/g, '') !== '') amount = num;
        else className = p;
      }
      rows.push({ name, className, amount });
    }
    return rows;
  }, [text]);

  const handleImport = () => {
    if (parsed.length === 0) return setError('הרשימה ריקה — מדביקים שורה לכל תלמיד/ה');
    const fallback = Number(due) || 0;
    onImport(parsed.map(r => ({
      name: r.name,
      className: r.className,
      amountDue: r.amount ?? fallback,
    })));
    onClose();
  };

  return (
    <Modal
      title="ייבוא רשימת תלמידים"
      subtitle="מעתיקים מאקסל ומדביקים כאן — שורה לכל תלמיד/ה"
      onClose={onClose}
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">הרשימה</label>
          <textarea
            className="input resize-none font-mono text-xs"
            dir="rtl"
            rows={8}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'כל שורה: שם, ואפשר גם כיתה וסכום.\nלמשל:\nשרה כהן\nרבקה לוי\tא\'1\nחיה פרידמן\tב\'2\t4200'}
          />
          <p className="text-xs text-gray-400 mt-1">
            אפשר להדביק ישר עמודות מאקסל (שם | כיתה | סכום) — המערכת מזהה לבד.
          </p>
        </div>
        <div>
          <label className="label">שכר לימוד שנתי למי שלא צוין סכום (₪)</label>
          <input className="input" type="number" inputMode="numeric" min="0" value={due} onChange={e => setDue(e.target.value)} />
        </div>
        {parsed.length > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-3.5 py-2.5 text-sm text-teal-700">
            זוהו <b>{parsed.length}</b> תלמידים/ות
            {parsed.some(r => r.className) ? ' · כולל כיתות' : ''}
            {parsed.some(r => r.amount !== null) ? ' · חלקם עם סכום מותאם' : ''}
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={handleImport} className="btn-primary flex-1 justify-center">
          <ClipboardPaste size={14} />
          ייבוא {parsed.length > 0 ? `(${parsed.length})` : ''}
        </button>
        <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
      </div>
    </Modal>
  );
}

export default function TuitionPage() {
  const { user, currentYear, classes, constants, notify, isSimpleMode } = useApp();
  const [payers, setPayers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payerModal, setPayerModal] = useState(null);   // 'new' | payer
  const [paymentModal, setPaymentModal] = useState(null); // payer
  const [importModal, setImportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user?.schoolId || !currentYear?.id) return;
    setLoading(true);
    Promise.all([
      supabase.from('tuition_payers').select('*')
        .eq('school_id', user.schoolId).eq('budget_year_id', currentYear.id).order('name'),
      supabase.from('tuition_payments').select('*')
        .eq('school_id', user.schoolId).order('paid_at', { ascending: false }),
    ]).then(([payersRes, paymentsRes]) => {
      setPayers((payersRes.data ?? []).map(p => ({
        id: p.id, name: p.name, className: p.class_name, amountDue: Number(p.amount_due), notes: p.notes,
      })));
      setPayments((paymentsRes.data ?? []).map(p => ({
        id: p.id, payerId: p.payer_id, amount: Number(p.amount),
        method: p.method, paidAt: p.paid_at, notes: p.notes,
      })));
      setLoading(false);
    });
  }, [user?.schoolId, currentYear?.id]);

  const paidByPayer = useMemo(() => {
    const map = {};
    for (const p of payments) map[p.payerId] = (map[p.payerId] || 0) + p.amount;
    return map;
  }, [payments]);

  const totals = useMemo(() => {
    const due = payers.reduce((s, p) => s + p.amountDue, 0);
    const collected = payers.reduce((s, p) => s + Math.min(paidByPayer[p.id] || 0, Infinity), 0);
    return { due, collected, remaining: Math.max(0, due - collected) };
  }, [payers, paidByPayer]);

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const expectedFromBudget = totalStudents * (constants.incomePerStudent || 0);

  // ── CRUD ──
  const addPayer = async (data) => {
    const { data: row, error } = await supabase.from('tuition_payers').insert({
      school_id: user.schoolId, budget_year_id: currentYear.id,
      name: data.name, class_name: data.className || null, amount_due: data.amountDue, notes: data.notes,
    }).select().single();
    if (error || !row) return notify('הרשומה לא נשמרה — נסי שוב', 'error');
    setPayers(prev => [...prev, { id: row.id, name: row.name, className: row.class_name, amountDue: Number(row.amount_due), notes: row.notes }]
      .sort((a, b) => a.name.localeCompare(b.name, 'he')));
    notify('נוסף לגבייה ✓');
  };

  const updatePayer = async (id, data) => {
    const { error } = await supabase.from('tuition_payers').update({
      name: data.name, class_name: data.className || null, amount_due: data.amountDue, notes: data.notes,
    }).eq('id', id);
    if (error) return notify('העדכון לא נשמר — נסי שוב', 'error');
    setPayers(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    notify('עודכן ✓');
  };

  const importPayers = async (rows) => {
    const { data, error } = await supabase.from('tuition_payers').insert(
      rows.map(r => ({
        school_id: user.schoolId, budget_year_id: currentYear.id,
        name: r.name, class_name: r.className || null, amount_due: r.amountDue, notes: null,
      }))
    ).select();
    if (error || !data) return notify('הייבוא נכשל — נסי שוב', 'error');
    setPayers(prev => [...prev, ...data.map(row => ({
      id: row.id, name: row.name, className: row.class_name, amountDue: Number(row.amount_due), notes: row.notes,
    }))].sort((a, b) => a.name.localeCompare(b.name, 'he')));
    notify(`${data.length} תלמידים/ות נוספו לגבייה ✓`);
  };

  const deletePayer = async (id) => {
    const { error } = await supabase.from('tuition_payers').delete().eq('id', id);
    if (error) return notify('המחיקה נכשלה — נסי שוב', 'error');
    setPayers(prev => prev.filter(p => p.id !== id));
    setPayments(prev => prev.filter(p => p.payerId !== id));
    notify('הרשומה נמחקה');
  };

  const addPayment = async (payer, data) => {
    const { data: row, error } = await supabase.from('tuition_payments').insert({
      school_id: user.schoolId, payer_id: payer.id,
      amount: data.amount, method: data.method, paid_at: data.paidAt, notes: data.notes,
    }).select().single();
    if (error || !row) return notify('התשלום לא נשמר — נסי שוב', 'error');
    setPayments(prev => [{
      id: row.id, payerId: row.payer_id, amount: Number(row.amount),
      method: row.method, paidAt: row.paid_at, notes: row.notes,
    }, ...prev]);
    notify('התשלום נרשם ✓');
  };

  const deletePayment = async (id) => {
    const { error } = await supabase.from('tuition_payments').delete().eq('id', id);
    if (error) return notify('המחיקה נכשלה — נסי שוב', 'error');
    setPayments(prev => prev.filter(p => p.id !== id));
    notify('התשלום נמחק');
  };

  if (loading) return <div className="card p-8 text-center text-gray-400">טוען...</div>;

  const pct = totals.due > 0 ? Math.round((totals.collected / totals.due) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">גבייה — שכר לימוד</h2>
          <p className="text-gray-500 text-sm mt-0.5">{payers.length} רשומות · {currentYear?.label}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setImportModal(true)} className="btn-outline">
            <ClipboardPaste size={15} />
            ייבוא רשימה
          </button>
          <button onClick={() => setPayerModal('new')} className="btn-primary">
            <Plus size={16} />
            הוסף לגבייה
          </button>
        </div>
      </div>

      {/* Summary */}
      {payers.length > 0 && (
        <div className="card p-5 spring-enter">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-xl md:text-2xl font-black text-gray-800">{formatCurrency(totals.due)}</p>
              <p className="text-xs text-gray-500 mt-0.5">סה״כ לגבייה</p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-2xl font-black text-green-600">{formatCurrency(totals.collected)}</p>
              <p className="text-xs text-gray-500 mt-0.5">נגבה</p>
            </div>
            <div className="text-center">
              <p className={`text-xl md:text-2xl font-black ${totals.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(totals.remaining)}</p>
              <p className="text-xs text-gray-500 mt-0.5">נותר לגבות</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-l from-teal-500 to-purple-500 transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-purple-600">{pct}%</span>
          </div>
          {!isSimpleMode && totalStudents > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              לפי התקציב: {totalStudents} תלמידים × {formatCurrency(constants.incomePerStudent)} = צפי {formatCurrency(expectedFromBudget)} לשנה
            </p>
          )}
        </div>
      )}

      {payers.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="עוד אין רשומות גבייה"
          hint='הכי מהיר: "ייבוא רשימה" למעלה — מדביקים את שמות התלמידים ישר מאקסל, וכולם נכנסים בבת אחת עם שכר הלימוד. ואז מסמנים כל תשלום שנכנס ורואים מי שילם ומה נשאר.'
          actionLabel="ייבוא רשימת תלמידים"
          onAction={() => setImportModal(true)}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {payers.map((p, i) => {
              const paid = paidByPayer[p.id] || 0;
              const st = payerStatus(p.amountDue, paid);
              const isExp = expanded === p.id;
              const payerPayments = payments.filter(x => x.payerId === p.id);
              return (
                <div key={p.id} className="card p-4 spring-enter" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.className ? `${p.className} · ` : ''}שולם {formatCurrency(paid)} מתוך {formatCurrency(p.amountDue)}
                      </p>
                    </div>
                    <span className={`badge ${st.color} flex-shrink-0`}>{st.label}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
                    <div className={`h-full rounded-full ${st.key === 'paid' ? 'bg-green-500' : st.key === 'partial' ? 'bg-gold-500' : 'bg-red-300'}`}
                      style={{ width: `${p.amountDue > 0 ? Math.min((paid / p.amountDue) * 100, 100) : 0}%` }} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    {paid < p.amountDue && (
                      <button onClick={() => setPaymentModal(p)} className="btn-primary btn-sm flex-1 justify-center">
                        <CheckCircle size={13} /> רישום תשלום
                      </button>
                    )}
                    <button onClick={() => setExpanded(isExp ? null : p.id)} className="btn-outline btn-sm flex-1 justify-center">
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />} תשלומים ({payerPayments.length})
                    </button>
                    <button onClick={() => setPayerModal(p)} aria-label={`עריכת ${p.name}`} className="btn-outline btn-sm justify-center px-2.5">
                      <Edit2 size={13} />
                    </button>
                  </div>
                  {isExp && (
                    <PaymentsList payments={payerPayments} onDelete={deletePayment} onDeletePayer={() => setDeleteConfirm(p)} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">שם</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">כיתה</th>
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">שכר לימוד</th>
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">שולם</th>
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">נותר</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">סטטוס</th>
                  <th className="px-3 py-3 text-center text-gray-500 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payers.map(p => {
                  const paid = paidByPayer[p.id] || 0;
                  const st = payerStatus(p.amountDue, paid);
                  const isExp = expanded === p.id;
                  const payerPayments = payments.filter(x => x.payerId === p.id);
                  return (
                    <Fragment key={p.id}>
                      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(isExp ? null : p.id)}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{p.name}</div>
                          {p.notes && <div className="text-xs text-gray-400 mt-0.5">{p.notes}</div>}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">{p.className || '—'}</td>
                        <td className="px-3 py-3 text-left font-medium text-gray-700">{formatCurrency(p.amountDue)}</td>
                        <td className="px-3 py-3 text-left font-medium text-green-600">{formatCurrency(paid)}</td>
                        <td className="px-3 py-3 text-left font-bold">
                          <span className={p.amountDue - paid > 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(Math.max(0, p.amountDue - paid))}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`badge ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-center" onClick={e => e.stopPropagation()}>
                            {paid < p.amountDue && (
                              <button onClick={() => setPaymentModal(p)} title="רישום תשלום" aria-label={`רישום תשלום — ${p.name}`}
                                className="p-1.5 hover:bg-teal-50 rounded-lg text-gray-400 hover:text-teal-600 transition-colors">
                                <CheckCircle size={14} />
                              </button>
                            )}
                            <button onClick={() => setPayerModal(p)} aria-label={`עריכת ${p.name}`}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-purple-600 transition-colors">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setDeleteConfirm(p)} aria-label={`מחיקת ${p.name}`}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
                            {isExp ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                          </div>
                        </td>
                      </tr>
                      {isExp && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={7} className="px-4 pb-4">
                            <PaymentsList payments={payerPayments} onDelete={deletePayment} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {payerModal && (
        <PayerModal
          payer={payerModal === 'new' ? null : payerModal}
          classes={classes}
          defaultDue={constants.incomePerStudent}
          onSave={data => payerModal === 'new' ? addPayer(data) : updatePayer(payerModal.id, data)}
          onClose={() => setPayerModal(null)}
        />
      )}

      {importModal && (
        <ImportModal
          defaultDue={constants.incomePerStudent}
          onImport={importPayers}
          onClose={() => setImportModal(false)}
        />
      )}

      {paymentModal && (
        <PaymentModal
          payer={paymentModal}
          remaining={Math.max(0, paymentModal.amountDue - (paidByPayer[paymentModal.id] || 0))}
          onSave={data => addPayment(paymentModal, data)}
          onClose={() => setPaymentModal(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="מחיקת רשומת גבייה"
          message={`למחוק את ${deleteConfirm.name} כולל היסטוריית התשלומים? לא ניתן לבטל.`}
          onConfirm={() => deletePayer(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

function PaymentsList({ payments, onDelete, onDeletePayer }) {
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
      {payments.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-2">עוד לא נרשמו תשלומים</p>
      ) : (
        <div className="space-y-1.5">
          {payments.map(pay => (
            <div key={pay.id} className="flex items-center gap-3 text-sm py-1">
              <Receipt size={13} className="text-gray-400 flex-shrink-0" />
              <span className="font-bold text-gray-800">{formatCurrency(pay.amount)}</span>
              <span className="text-gray-500 text-xs">{methodLabel(pay.method)}</span>
              <span className="text-gray-400 text-xs flex-1">{pay.paidAt}{pay.notes ? ` · ${pay.notes}` : ''}</span>
              <button onClick={() => onDelete(pay.id)} aria-label="מחיקת תשלום"
                className="p-1 hover:bg-white rounded text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {onDeletePayer && (
        <button onClick={onDeletePayer} className="text-xs text-red-400 hover:text-red-600 mt-2">
          מחיקת הרשומה כולה
        </button>
      )}
    </div>
  );
}
