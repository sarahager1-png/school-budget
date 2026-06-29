import { useApp } from '../context/AppContext.jsx';
import { annualAmount } from '../lib/calculations.js';
import { AlertTriangle, CheckCircle, BookOpen, Calculator, Users, CreditCard, TrendingUp, BarChart2, Settings, Package } from 'lucide-react';

function RuleCard({ icon: Icon, color, title, children }) {
  return (
    <div className={`card p-5 border-r-4 ${color}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
          <Icon size={18} className={color.replace('border-', 'text-').replace('-500', '-600')} />
        </div>
        <h3 className="font-bold text-gray-800 text-base">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PageCard({ icon: Icon, title, desc, color }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={15} className="text-white" />
      </div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const { expenses, classes } = useApp();

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const ec3Total = expenses
    .filter(e => e.categoryId === 'ec3')
    .reduce((s, e) => s + annualAmount(e), 0);
  const ec3PerStudent = totalStudents > 0 ? Math.round(ec3Total / totalStudents) : 0;
  const ec3PerStudentMonthly = totalStudents > 0 ? Math.round(ec3Total / totalStudents / 10) : 0;
  const CAP = 1400;
  const overCap = ec3PerStudent > CAP;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">מדריך השימוש</h2>
        <p className="text-gray-500 text-sm mt-0.5">כל מה שצריך לדעת על מערכת ניהול תקציב שלהבות חב"ד</p>
      </div>

      {/* Events Budget Cap Alert */}
      <div className={`rounded-2xl p-5 ${overCap ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-start gap-3">
          {overCap
            ? <AlertTriangle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
            : <CheckCircle size={22} className="text-green-500 flex-shrink-0 mt-0.5" />
          }
          <div className="flex-1">
            <p className={`font-bold text-base ${overCap ? 'text-red-700' : 'text-green-700'}`}>
              כלל תקציב אירועים — סך הוצאות שוטפות לתלמיד
            </p>
            <p className={`text-sm mt-1 ${overCap ? 'text-red-600' : 'text-green-600'}`}>
              מסיבות, ארועים וצוות לא יעלו על <strong>1,400 ₪ לתלמיד</strong> בשנה
            </p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">סה"כ פעילויות שוטפות</p>
                <p className="font-black text-lg text-gray-800">₪{ec3Total.toLocaleString('he-IL')}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">לתלמיד (שנתי)</p>
                <p className={`font-black text-lg ${overCap ? 'text-red-600' : 'text-green-600'}`}>
                  ₪{ec3PerStudent.toLocaleString('he-IL')}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">לתלמיד (חודשי)</p>
                <p className="font-black text-lg text-gray-700">₪{ec3PerStudentMonthly.toLocaleString('he-IL')}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">תקרה</p>
                <p className="font-black text-lg text-purple-600">₪{CAP.toLocaleString('he-IL')}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className={overCap ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                  {Math.round((ec3PerStudent / CAP) * 100)}% מהתקרה
                </span>
                <span className="text-gray-400">תקרה: ₪{CAP.toLocaleString('he-IL')}</span>
              </div>
              <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${overCap ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min((ec3PerStudent / CAP) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Rules */}
      <div>
        <h3 className="text-base font-bold text-gray-700 mb-3">כללי תקציב</h3>
        <div className="grid gap-4">
          <RuleCard icon={Calculator} color="border-teal-500" title="חישוב תקן כיתה">
            <div className="space-y-1.5 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="badge bg-teal-100 text-teal-700">תקן מלא</span>
                <span>21+ תלמידים — 22 שעות/שבוע × 400 ₪ × 36 שבועות</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-gold-100 text-gold-700">תקן חצי</span>
                <span>11–20 תלמידים — 11 שעות/שבוע × 400 ₪ × 36 שבועות</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-red-100 text-red-700">ללא תקן</span>
                <span>עד 10 תלמידים — ללא מימון ממשרד החינוך</span>
              </div>
            </div>
          </RuleCard>

          <RuleCard icon={TrendingUp} color="border-green-500" title="מקורות הכנסה">
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>הכנסה ממשרד: שעות תקן × 400 ₪/שעה × 36 שבועות</span></li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>הכנסה מתלמיד: 350 ₪ לתלמיד לשנה</span></li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>מקורות נוספים: תרומות, מענקים עירוניים, אירועי גיוס כספים</span></li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>צהרון (אם מופעל): הכנסה והוצאה נוספת לפי תלמיד</span></li>
            </ul>
          </RuleCard>

          <RuleCard icon={CreditCard} color="border-coral-500" title="מבנה הוצאות">
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>שכר:</strong> משכורות מנהלת, מזכירה, שרת, יועצת — חודשי × 12</span></li>
              <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>בניין:</strong> שכר דירה, תחזוקה, ביטוח</span></li>
              <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>פעילויות שוטפות:</strong> ארועים, חגים, צוות, הדפסות — <em>כפוף לכלל 1,400 ₪/תלמיד</em></span></li>
              <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>קיץ — תשתיות:</strong> שיפוצים, ריהוט, מיזוג, תקשוב לאוגוסט</span></li>
              <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>עלות הוראה:</strong> 29 שעות/שבוע × 600 ₪/שעה × 36 שבועות לכל כיתה</span></li>
              <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>הוצאות תלמיד:</strong> 1,400 ₪ לתלמיד לשנה</span></li>
              <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>פיתוח מקצועי:</strong> 2,000 ₪ לכיתה לשנה</span></li>
            </ul>
          </RuleCard>
        </div>
      </div>

      {/* Pages Guide */}
      <div>
        <h3 className="text-base font-bold text-gray-700 mb-3">מדריך מהיר לדפים</h3>
        <div className="card p-4 space-y-2">
          <PageCard icon={BarChart2} color="bg-teal-500" title="לוח מחוונים" desc="סקירה כללית של המצב הפיננסי — הכנסות, הוצאות, יתרה, גרפים ובקשות אחרונות." />
          <PageCard icon={Users} color="bg-purple-500" title="כיתות" desc="הוספה ועריכה של כיתות. לחיצה על שורה פורשת פירוט תקציב מלא לכיתה." />
          <PageCard icon={TrendingUp} color="bg-green-500" title="הכנסות" desc="ניהול מקורות הכנסה נוספים (תרומות, מענקים, ארועים) מעל הכנסות המשרד." />
          <PageCard icon={CreditCard} color="bg-coral-500" title="הוצאות" desc="ניהול כל ההוצאות לפי קטגוריה. לחץ Send ליצירת בקשת תשלום לשליח." />
          <PageCard icon={Package} color="bg-gold-500" title="בקשות תשלום" desc="תצוגת השליח — מעקב אחר ביצוע תשלומים והעלאת קבלות." />
          <PageCard icon={BarChart2} color="bg-indigo-500" title="דוחות" desc="דוחות חודשיים, לפי כיתה ולפי קטגוריה, סיכום שנתי ואפשרות הדפסה." />
          <PageCard icon={Settings} color="bg-gray-500" title="הגדרות" desc="עדכון פרטי בית הספר, שנות תקציב, קבועים פיננסיים ומשתמשים." />
        </div>
      </div>

      {/* Tips */}
      <div className="card p-5 bg-purple-50 border border-purple-100">
        <h3 className="font-bold text-purple-800 mb-3">טיפים לשימוש</h3>
        <ul className="space-y-2 text-sm text-purple-700">
          <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>שנה קבועים פיננסיים בהגדרות — כל החישובים מתעדכנים אוטומטית.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>לחץ על שורת כיתה לפירוט מלא של הכנסות והוצאות לאותה כיתה.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>הוצאות חודשיות מחושבות אוטומטית × 12 לתצוגה שנתית.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>בקר בדף זה כדי לבדוק את מד תקציב הארועים לפני אישור פעילויות חדשות.</span></li>
        </ul>
      </div>

      <p className="text-center text-gray-400 text-xs">בנוי ופיתוח: שרה הגר · 0503339770</p>
      <p className="text-center text-gray-400 text-xs">יעוץ ארגוני | פתרונות דיגיטליים · מהבנת הארגון לפתרון שעובד.</p>
    </div>
  );
}
