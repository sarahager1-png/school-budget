import { useApp } from '../context/AppContext.jsx';

const ROLES = [
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
    gradient: 'from-coral-500 to-coral-700',
    bg: 'bg-coral-50 hover:bg-coral-100 border-coral-200',
    text: 'text-coral-700',
  },
];

export default function LoginPage() {
  const { login } = useApp();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1E0A3C 0%, #0B3B47 60%, #0FA3B1 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/15 backdrop-blur mb-4 overflow-hidden">
            <img src="/logo.png" alt="לוגו" className="w-full h-full object-contain p-1" onError={e => { e.target.style.display='none'; e.target.parentElement.innerHTML='<span style="font-size:2.5rem">🏫</span>'; }} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">ניהול תקציב</h1>
          <p className="text-white/70 text-lg font-medium">שלהבות חב"ד</p>
          <p className="text-white/50 text-sm mt-1">מערכת תקציב שנתי מלאה</p>
        </div>

        {/* Role Selection Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-center text-gray-500 text-sm font-medium mb-5 uppercase tracking-wide">
            בחרי תפקיד להתחברות
          </h2>

          <div className="space-y-3">
            {ROLES.map(role => (
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

          <p className="text-center text-gray-400 text-xs mt-5">
            גרסת הדגמה — ללא צורך בסיסמה
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-white/30 text-xs mt-6">
          © 2026 כל הזכויות שמורות לשרה הגר
        </p>
      </div>
    </div>
  );
}
