import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { isMockMode } from '../lib/supabase.js';

const MOCK_ROLES = [
  {
    key: 'principal',
    title: 'מנהלת',
    subtitle: 'ניהול תקציב, כיתות, הכנסות והוצאות',
    emoji: '👩‍💼',
    gradient: 'from-purple-500 to-purple-700',
    bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    text: 'text-purple-700',
  },
  {
    key: 'courier',
    title: 'שליח',
    subtitle: 'ביצוע תשלומים והעלאת קבלות',
    emoji: '🧑‍💼',
    gradient: 'from-teal-500 to-teal-700',
    bg: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
    text: 'text-teal-700',
  },
  {
    key: 'admin',
    title: 'מנהל מערכת',
    subtitle: 'ניהול משתמשים, הגדרות ומערכת',
    emoji: '🧑‍💻',
    gradient: 'from-orange-500 to-orange-700',
    bg: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    text: 'text-orange-700',
  },
];

function LogoCard({ schoolName }) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white mb-4 overflow-hidden shadow-lg">
        <img
          src="/logo.png"
          alt="לוגו"
          className="w-full h-full object-contain p-1"
          onError={e => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = '<span style="font-size:2.5rem">🏫</span>';
          }}
        />
      </div>
      <h1 className="text-3xl font-black text-white mb-2">ניהול תקציב</h1>
      {schoolName && <p className="text-white/70 text-lg font-medium">{schoolName}</p>}
      <p className="text-white/50 text-sm mt-1">מערכת תקציב שנתי מלאה</p>
    </div>
  );
}

function MockLogin({ login }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1E0A3C 0%, #0B3B47 60%, #0FA3B1 100%)' }}
    >
      <div className="w-full max-w-md">
        <LogoCard />

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-center text-gray-500 text-sm font-medium mb-5 uppercase tracking-wide">
            בחרי תפקיד להתחברות
          </h2>
          <div className="space-y-3">
            {MOCK_ROLES.map(role => (
              <button
                key={role.key}
                onClick={() => login(role.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${role.bg}`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center text-2xl flex-shrink-0 shadow-md`}>
                  {role.emoji}
                </div>
                <div className="text-right flex-1">
                  <p className={`font-bold text-base ${role.text}`}>{role.title}</p>
                  <p className="text-gray-500 text-sm">{role.subtitle}</p>
                </div>
                <svg className={`w-5 h-5 ${role.text} rotate-180 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
          <p className="text-center text-gray-400 text-xs mt-5">גרסת הדגמה — ללא צורך בסיסמה</p>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">© 2026 כל הזכויות שמורות לשרה הגר</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useApp();

  if (isMockMode) return <MockLogin login={login} />;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('נא למלא אימייל וסיסמה');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { error: loginError } = await login(email, password);
      if (loginError) {
        setError(loginError.message === 'Invalid login credentials'
          ? 'אימייל או סיסמה שגויים'
          : `שגיאה: ${loginError.message}`);
      }
    } catch (err) {
      setError(`שגיאה טכנית: ${err.message}`);
    }
    setSubmitting(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1E0A3C 0%, #0B3B47 60%, #0FA3B1 100%)' }}
    >
      <div className="w-full max-w-sm">
        <LogoCard />

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <h2 className="text-center text-gray-700 font-bold text-lg mb-1">כניסה למערכת</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="label">כתובת אימייל</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@school.edu"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <label className="label">סיסמה</label>
            <div className="relative">
              <input
                className="input pl-10"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                מתחבר...
              </span>
            ) : 'כניסה'}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">© 2026 כל הזכויות שמורות לשרה הגר</p>
      </div>
    </div>
  );
}
