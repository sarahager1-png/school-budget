import { useState } from 'react';
import { Save, Plus, Trash2, CheckCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { CONSTANTS_LABELS, ROLES, SCHOOL_MODES } from '../data/constants.js';
import { formatCurrency } from '../lib/calculations.js';
import { schoolYearLabel } from '../lib/hebrewYear.js';
import Picker from '../components/ui/Picker.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

const TABS = [
  { key: 'school', label: 'בית הספר', simpleMode: true },
  { key: 'years', label: 'שנות תקציב', simpleMode: true },
  { key: 'financial', label: 'קבועים פיננסיים', simpleMode: false },
  { key: 'users', label: 'משתמשים', simpleMode: true, adminOnly: true },
];

function SchoolTab() {
  const { school, setSchool } = useApp();
  const [form, setForm] = useState({ name: school.name, mode: school.mode || 'full' });
  const [logo, setLogo] = useState(school.logoUrl);

  const handleSave = () => {
    setSchool({ name: form.name, logoUrl: logo, mode: form.mode });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogo(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="card p-6 max-w-lg space-y-5">
      <h3 className="font-bold text-gray-800">פרטי בית הספר</h3>

      <div>
        <label className="label">לוגו</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
            {logo ? (
              <img src={logo} alt="לוגו בית הספר" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🏫</span>
            )}
          </div>
          <div>
            <label className="btn-outline btn-sm cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              העלה לוגו
            </label>
            {logo && (
              <button onClick={() => setLogo(null)} className="btn-ghost btn-sm mr-2 text-red-500">הסר</button>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="label">שם בית הספר</label>
        <input
          className="input"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        />
      </div>

      <Picker
        label="אופן העבודה"
        value={form.mode}
        onChange={v => setForm(p => ({ ...p, mode: v }))}
        options={Object.entries(SCHOOL_MODES).map(([k, v]) => ({ value: k, label: v.label, hint: v.hint }))}
      />
      {form.mode === 'simple' && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            במצב מעקב פשוט המערכת מציגה רק הכנסות, הוצאות, בקשות תשלום ומשכורות —
            בלי חישובי תקן וסימולציות. אפשר לחזור למצב מלא בכל רגע, שום נתון לא נמחק.
          </span>
        </div>
      )}

      <button onClick={handleSave} className="btn-primary">
        <Save size={16} /> שמור שינויים
      </button>
    </div>
  );
}

function YearsTab() {
  const { budgetYears, addBudgetYear, activateBudgetYear } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [newYear, setNewYear] = useState({ year: new Date().getFullYear() + 1 });

  const handleAdd = () => {
    const yr = Number(newYear.year);
    if (!yr || yr < 2020 || yr > 2100) return;
    addBudgetYear({
      year: yr,
      label: schoolYearLabel(yr),
      startDate: `${yr}-09-01`,
      endDate: `${yr + 1}-08-31`,
      isActive: false,
      status: 'active',
    });
    setShowNew(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">שנות תקציב</h3>
        <button onClick={() => setShowNew(p => !p)} className="btn-primary btn-sm">
          <Plus size={14} />
          הוסף שנה
        </button>
      </div>

      {showNew && (
        <div className="card p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="label">שנת הלימודים מתחילה בספטמבר</label>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={newYear.year}
                onChange={e => setNewYear({ year: e.target.value })}
                placeholder="2026"
              />
            </div>
            <button onClick={handleAdd} className="btn-primary">הוסף</button>
            <button onClick={() => setShowNew(false)} className="btn-outline">ביטול</button>
          </div>
          {Number(newYear.year) >= 2020 && Number(newYear.year) <= 2100 && (
            <p className="text-xs text-teal-600 mt-2">
              תיווסף: {schoolYearLabel(Number(newYear.year))} · הקבועים הפיננסיים יועתקו מהשנה הנוכחית
            </p>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">שנה</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium hidden sm:table-cell">תקופה</th>
              <th className="text-center px-3 py-3 text-gray-500 font-medium">סטטוס</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {budgetYears.map(yr => (
              <tr key={yr.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{yr.label}</td>
                <td className="px-4 py-3 text-gray-600 text-sm hidden sm:table-cell">{yr.startDate} — {yr.endDate}</td>
                <td className="px-3 py-3 text-center">
                  {yr.isActive ? (
                    <span className="badge bg-teal-100 text-teal-700">פעיל</span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-500">{yr.status === 'archived' ? 'ארכיון' : 'לא פעיל'}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {!yr.isActive && (
                    <button onClick={() => activateBudgetYear(yr.id)} className="btn-outline btn-sm">
                      <CheckCircle size={12} />
                      הפעל
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinancialTab() {
  const { constants, setConstants } = useApp();
  const [form, setForm] = useState({ ...constants });

  const set = (k, v) => setForm(p => ({ ...p, [k]: Number(v) }));

  const annualMinistryFull = form.fullClassMinistryHours * form.ministryHourlyRate * form.schoolWeeks;
  const annualActual = form.actualWeeklyHours * form.actualHourlyRate * form.schoolWeeks;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(CONSTANTS_LABELS).map(([key, meta]) => (
          <div key={key} className="card p-4">
            <label className="label">{meta.label}</label>
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                type="number"
                inputMode="numeric"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
              />
              <span className="text-xs text-gray-400 flex-shrink-0">{meta.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="card p-5 bg-teal-50 border border-teal-200">
        <h4 className="font-bold text-teal-800 mb-3">תצוגה מקדימה — כיתה מלאה</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">הכנסה ממשרד (שנתית)</p>
            <p className="font-bold text-teal-700">{formatCurrency(annualMinistryFull)}</p>
          </div>
          <div>
            <p className="text-gray-500">עלות הוראה בפועל (שנתית)</p>
            <p className="font-bold text-coral-600">{formatCurrency(annualActual)}</p>
          </div>
          <div>
            <p className="text-gray-500">פער לכיתה מלאה</p>
            <p className="font-bold text-red-600">{formatCurrency(annualActual - annualMinistryFull)}</p>
          </div>
        </div>
      </div>

      <button onClick={() => setConstants(form)} className="btn-primary">
        <Save size={16} /> שמור קבועים
      </button>
    </div>
  );
}

function UsersTab() {
  const { usersList, deleteUser, user: currentUser } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-800">ניהול משתמשים</h3>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-sm text-blue-700 max-w-lg">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <span>
          להוספת משתמש חדש (מנהלת או שליח) פונים לשרה הגר · 0503339770 —
          ההקמה כוללת חשבון כניסה מאובטח ולכן נעשית מרכזית.
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">שם</th>
              <th className="text-center px-3 py-3 text-gray-500 font-medium">תפקיד</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {usersList.map(u => {
              const roleInfo = ROLES[u.role];
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                        {u.initials || u.name?.[0]}
                      </div>
                      <span className="font-medium text-gray-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`badge ${roleInfo?.color}`}>{roleInfo?.label}</span>
                  </td>
                  <td className="px-3 py-3 text-left">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => setDeleteConfirm(u)}
                        aria-label={`הסרת ${u.name}`}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deleteConfirm && (
        <ConfirmDialog
          title="הסרת משתמש"
          message={`להסיר את ${deleteConfirm.name}? המשתמש לא יוכל יותר להיכנס למערכת.`}
          confirmLabel="הסרה"
          onConfirm={() => deleteUser(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, isSimpleMode } = useApp();
  const [activeTab, setActiveTab] = useState('school');

  const availableTabs = TABS.filter(t =>
    (!t.adminOnly || user?.role === 'admin') && (!isSimpleMode || t.simpleMode)
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">הגדרות</h2>
        <p className="text-gray-500 text-sm mt-0.5">ניהול מערכת ותצורה</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full">
        {availableTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'tab-active' : 'tab-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'school' && <SchoolTab />}
      {activeTab === 'years' && <YearsTab />}
      {activeTab === 'financial' && !isSimpleMode && <FinancialTab />}
      {activeTab === 'users' && user?.role === 'admin' && <UsersTab />}
    </div>
  );
}
