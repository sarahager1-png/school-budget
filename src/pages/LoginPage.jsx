import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';

const SCHOOL_NAME = import.meta.env.VITE_SCHOOL_NAME || '';
// לוגו לפי מותג בית הספר: שלהבות (ברירת מחדל) או סמל הרשת בלבד (בתי "בית חינוך").
const LOGO_SRC = import.meta.env.VITE_LOGO || '/logo.png';
// כפתור Google מוצג רק בבתי ספר שה-provider חובר להם (VITE_GOOGLE_AUTH=1),
// אחרת לחיצה עליו מקבלת שגיאת "provider is not enabled" גולמית מהשרת.
const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_AUTH === '1';

function LogoCard({ schoolName }) {
  return (
    <div className="text-center mb-8">
      <div className="bg-white rounded-2xl mb-4 shadow-lg px-5 py-4">
        <img
          src={LOGO_SRC}
          alt={schoolName || 'רשת חינוך חב״ד'}
          className="w-full h-auto max-h-16 object-contain mx-auto"
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

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, authNotice } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(authNotice || '');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) {
      setError(`שגיאה בהתחברות Google: ${oauthError.message}`);
      setGoogleLoading(false);
    }
    // on success the browser redirects to Google, no need to reset state
  };

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
      style={{ background: 'linear-gradient(135deg, #1A0B35 0%, #3D2570 60%, #00B4CC 100%)' }}
    >
      <div className="w-full max-w-sm">
        <LogoCard schoolName={SCHOOL_NAME} />

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-center text-gray-700 font-bold text-lg mb-1">כניסה למערכת</h2>
          <p className="text-center text-gray-400 text-sm mb-5">
            {GOOGLE_ENABLED ? 'התחברי עם חשבון Google שלך' : 'התחברי עם האימייל והסיסמה שקיבלת'}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm text-center mb-4">
              {error}
            </div>
          )}

          {/* Google — רק בבתי ספר שה-provider חובר להם */}
          {GOOGLE_ENABLED && (
            <>
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl py-3 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <svg className="animate-spin w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <GoogleIcon />
                )}
                המשך עם Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-gray-400 text-xs">או</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
            </>
          )}

          {!showEmail && GOOGLE_ENABLED ? (
            <button
              onClick={() => setShowEmail(true)}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 font-medium transition"
            >
              כניסה עם אימייל וסיסמה
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
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
          )}
        </div>

        <div className="flex justify-center mt-6">
          <p className="text-white/50 text-xs font-medium tracking-wide">בנוי ופיתוח: שרה הגר · 0503339770</p>
        </div>
      </div>
    </div>
  );
}
