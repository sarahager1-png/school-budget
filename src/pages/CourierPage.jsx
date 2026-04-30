import { useState } from 'react';
import { Upload, CheckCircle, Clock, PlayCircle, XCircle, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { formatCurrency } from '../lib/calculations.js';
import { REQUEST_STATUS } from '../data/constants.js';

function StatusStepper({ status }) {
  const steps = [
    { key: 'pending', label: 'ממתין' },
    { key: 'in_progress', label: 'בביצוע' },
    { key: 'paid', label: 'שולם' },
    { key: 'completed', label: 'הושלם' },
  ];
  const activeIdx = steps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-1 mt-3">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1">
          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
            i <= activeIdx ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-400'
          }`}>
            {i < activeIdx ? '✓' : i + 1}
          </div>
          <div className="flex-1 mx-1">
            <div className={`h-1 rounded-full ${i < activeIdx ? 'bg-teal-500' : 'bg-gray-200'}`} />
          </div>
          {i === steps.length - 1 && (
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
              activeIdx === steps.length - 1 ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              ✓
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReceiptModal({ request, onSave, onClose }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');

  const handleUpload = () => {
    const url = file ? URL.createObjectURL(file) : `receipt-${request.id}-${Date.now()}.pdf`;
    onSave({ receiptUrl: url, status: 'paid', paidAt: new Date().toISOString().split('T')[0], notes });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 mb-1">העלאת קבלה</h2>
        <p className="text-gray-500 text-sm mb-5">{request.name} — {formatCurrency(request.amount)}</p>
        <div className="space-y-4">
          <div>
            <label className="label">קובץ קבלה / חשבונית</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer" onClick={() => document.getElementById('receipt-input').click()}>
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">{file ? file.name : 'לחץ לבחירת קובץ'}</p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG</p>
            </div>
            <input id="receipt-input" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setFile(e.target.files[0])} />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות נוספות..." />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleUpload} className="btn-primary flex-1 justify-center">
            <Upload size={14} />
            העלה וסמן שולם
          </button>
          <button onClick={onClose} className="btn-outline flex-1 justify-center">ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default function CourierPage() {
  const { expenseRequests, updateExpenseRequest, user, expenses } = useApp();
  const [filterStatus, setFilterStatus] = useState('all');
  const [receiptModal, setReceiptModal] = useState(null);

  const myRequests = user?.role === 'courier'
    ? expenseRequests.filter(r => r.assignedTo === user.id)
    : expenseRequests;

  const filtered = filterStatus === 'all'
    ? myRequests
    : myRequests.filter(r => r.status === filterStatus);

  const expenseMap = Object.fromEntries(expenses.map(e => [e.id, e]));

  const statusCounts = Object.fromEntries(
    ['pending', 'in_progress', 'paid', 'completed'].map(s => [
      s, myRequests.filter(r => r.status === s).length,
    ]),
  );

  const FILTERS = [
    { key: 'all', label: 'הכל', count: myRequests.length },
    { key: 'pending', label: 'ממתין', count: statusCounts.pending },
    { key: 'in_progress', label: 'בביצוע', count: statusCounts.in_progress },
    { key: 'paid', label: 'שולם', count: statusCounts.paid },
    { key: 'completed', label: 'הושלם', count: statusCounts.completed },
  ];

  const handleStart = (id) => updateExpenseRequest(id, { status: 'in_progress' });
  const handleComplete = (id) => updateExpenseRequest(id, { status: 'completed' });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">בקשות תשלום</h2>
        <p className="text-gray-500 text-sm mt-0.5">{myRequests.length} בקשות סה״כ</p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'ממתין', count: statusCounts.pending, color: 'bg-gold-50 text-gold-700 border-gold-200', icon: Clock },
          { label: 'בביצוע', count: statusCounts.in_progress, color: 'bg-teal-50 text-teal-700 border-teal-200', icon: PlayCircle },
          { label: 'שולם', count: statusCounts.paid, color: 'bg-blue-50 text-blue-700 border-blue-200', icon: FileText },
          { label: 'הושלם', count: statusCounts.completed, color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className={`rounded-xl border p-3 flex items-center gap-3 ${color}`}>
            <Icon size={20} className="flex-shrink-0" />
            <div>
              <p className="text-2xl font-black">{count}</p>
              <p className="text-xs opacity-75">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === f.key ? 'tab-active' : 'tab-inactive'}`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filterStatus === f.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Request Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(req => {
          const st = REQUEST_STATUS[req.status];
          const exp = expenseMap[req.expenseId];
          return (
            <div key={req.id} className="card p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-base leading-tight">{req.name}</p>
                  {exp && <p className="text-xs text-gray-400 mt-0.5">{exp.name}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mr-3">
                  <span className={`badge ${st?.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st?.dot}`} />
                    {st?.label}
                  </span>
                  <span className="font-black text-lg text-gray-800">{formatCurrency(req.amount)}</span>
                </div>
              </div>

              {req.notes && (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-2.5 mb-3">{req.notes}</p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>נוצר: {req.createdAt}</span>
                {req.paidAt && <span>שולם: {req.paidAt}</span>}
                {req.receiptUrl && (
                  <span className="flex items-center gap-1 text-teal-600">
                    <FileText size={12} />
                    יש קבלה
                  </span>
                )}
              </div>

              {/* Stepper */}
              <StatusStepper status={req.status} />

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                {req.status === 'pending' && (
                  <button onClick={() => handleStart(req.id)} className="btn-primary btn-sm flex-1 justify-center">
                    <PlayCircle size={14} />
                    התחל ביצוע
                  </button>
                )}
                {req.status === 'in_progress' && (
                  <button onClick={() => setReceiptModal(req)} className="btn-primary btn-sm flex-1 justify-center">
                    <Upload size={14} />
                    העלה קבלה
                  </button>
                )}
                {req.status === 'paid' && (
                  <button onClick={() => handleComplete(req.id)} className="btn-secondary btn-sm flex-1 justify-center">
                    <CheckCircle size={14} />
                    סמן הושלם
                  </button>
                )}
                {req.status === 'completed' && (
                  <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                    <CheckCircle size={16} />
                    <span>הבקשה הושלמה בהצלחה</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-xl mb-2">אין בקשות</p>
          <p className="text-sm">לא נמצאו בקשות תשלום בסטטוס זה</p>
        </div>
      )}

      {receiptModal && (
        <ReceiptModal
          request={receiptModal}
          onSave={data => updateExpenseRequest(receiptModal.id, data)}
          onClose={() => setReceiptModal(null)}
        />
      )}
    </div>
  );
}
