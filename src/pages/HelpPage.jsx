import { useApp } from '../context/AppContext.jsx';
import { annualAmount, formatCurrency } from '../lib/calculations.js';
import { EVENTS_CAP_PER_STUDENT } from '../data/constants.js';
import {
  AlertTriangle, CheckCircle, BookOpen, Calculator, Users, CreditCard,
  TrendingUp, BarChart2, Settings, Package, Wallet, FlaskConical, Printer,
} from 'lucide-react';

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
  const { expenses, classes, constants, school, expenseCategories, isSimpleMode } = useApp();

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const eventCatIds = new Set(expenseCategories.filter(c => c.kind === 'events').map(c => c.id));
  const eventsTotal = expenses
    .filter(e => eventCatIds.has(e.categoryId))
    .reduce((s, e) => s + annualAmount(e), 0);
  const perStudent = totalStudents > 0 ? Math.round(eventsTotal / totalStudents) : 0;
  const perStudentMonthly = totalStudents > 0 ? Math.round(eventsTotal / totalStudents / 10) : 0;
  const overCap = perStudent > EVENTS_CAP_PER_STUDENT;

  const c = constants;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-800">מדריך השימוש</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            כל מה שצריך לדעת על המערכת{school?.name ? ` — ${school.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <a href="/guide.html" target="_blank" rel="noopener noreferrer" className="btn-outline">
            <Printer size={15} />
            מדריך מלא להדפסה
          </a>
          <a href="/courier-guide.html" target="_blank" rel="noopener noreferrer" className="btn-outline">
            <Package size={15} />
            מדריך לשליח
          </a>
        </div>
      </div>

      {/* Events Budget Cap — budget mode only */}
      {!isSimpleMode && totalStudents > 0 && (
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
                מסיבות, אירועים וצוות לא יעלו על <strong>{EVENTS_CAP_PER_STUDENT.toLocaleString('he-IL')} ₪ לתלמיד</strong> בשנה
              </p>
              <div className="flex flex-wrap gap-4 mt-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">סה"כ פעילויות ואירועים</p>
                  <p className="font-black text-lg text-gray-800">₪{eventsTotal.toLocaleString('he-IL')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">לתלמיד (שנתי)</p>
                  <p className={`font-black text-lg ${overCap ? 'text-red-600' : 'text-green-600'}`}>
                    ₪{perStudent.toLocaleString('he-IL')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">לתלמיד (חודשי)</p>
                  <p className="font-black text-lg text-gray-700">₪{perStudentMonthly.toLocaleString('he-IL')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">תקרה</p>
                  <p className="font-black text-lg text-purple-600">₪{EVENTS_CAP_PER_STUDENT.toLocaleString('he-IL')}</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className={overCap ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                    {Math.round((perStudent / EVENTS_CAP_PER_STUDENT) * 100)}% מהתקרה
                  </span>
                  <span className="text-gray-400">תקרה: ₪{EVENTS_CAP_PER_STUDENT.toLocaleString('he-IL')}</span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overCap ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min((perStudent / EVENTS_CAP_PER_STUDENT) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Rules — budget mode only, driven by THIS school's constants */}
      {!isSimpleMode && (
        <div>
          <h3 className="text-base font-bold text-gray-700 mb-3">כללי תקציב</h3>
          <div className="grid gap-4">
            <RuleCard icon={Calculator} color="border-teal-500" title="חישוב תקן כיתה">
              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="badge bg-teal-100 text-teal-700">תקן מלא</span>
                  <span>{c.fullClassStudentThreshold}+ תלמידים — {c.fullClassMinistryHours} שעות/שבוע × {c.ministryHourlyRate} ₪ × {c.schoolWeeks} שבועות</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge bg-gold-100 text-gold-700">תקן חצי</span>
                  <span>{c.halfClassStudentThreshold}–{c.fullClassStudentThreshold - 1} תלמידים — {c.halfClassMinistryHours} שעות/שבוע × {c.ministryHourlyRate} ₪ × {c.schoolWeeks} שבועות</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge bg-red-100 text-red-700">ללא תקן</span>
                  <span>עד {c.halfClassStudentThreshold - 1} תלמידים — ללא מימון ממשרד החינוך</span>
                </div>
              </div>
            </RuleCard>

            <RuleCard icon={TrendingUp} color="border-green-500" title="מקורות הכנסה">
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>הכנסה ממשרד: שעות תקן × {c.ministryHourlyRate} ₪/שעה × {c.schoolWeeks} שבועות</span></li>
                {c.ministryGrantPerStudent > 0 && (
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>תוספת משרד לתלמיד: {formatCurrency(c.ministryGrantPerStudent)} לשנה</span></li>
                )}
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>הכנסה מתלמיד: {formatCurrency(c.incomePerStudent)} לשנה</span></li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>מקורות נוספים: תרומות, מענקים עירוניים, אירועי גיוס כספים</span></li>
                {c.incomePerStudentCaharon > 0 && (
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span>צהרון: {formatCurrency(c.incomePerStudentCaharon)} הכנסה לתלמיד לשנה</span></li>
                )}
              </ul>
            </RuleCard>

            <RuleCard icon={CreditCard} color="border-coral-500" title="מבנה הוצאות">
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>עלות הוראה:</strong> {c.actualWeeklyHours} שעות/שבוע × {c.actualHourlyRate} ₪/שעה × {c.schoolWeeks} שבועות לכל כיתה</span></li>
                <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>הוצאות תלמיד:</strong> {formatCurrency(c.expensePerStudent)} לתלמיד לשנה</span></li>
                <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>פיתוח מקצועי:</strong> {formatCurrency(c.professionalDevPerClass)} לכיתה לשנה</span></li>
                <li className="flex items-start gap-2"><span className="text-coral-500 mt-0.5">•</span><span><strong>הוצאות כלליות:</strong> שכר, בניין, אירועים וציוד — נרשמות במסך ההוצאות לפי קטגוריה</span></li>
              </ul>
            </RuleCard>
          </div>
        </div>
      )}

      {/* Pages Guide */}
      <div>
        <h3 className="text-base font-bold text-gray-700 mb-3">מדריך מהיר לדפים</h3>
        <div className="card p-4 space-y-2">
          <PageCard icon={BookOpen} color="bg-teal-500" title="דף הבית" desc="מבט-על על המצב הכספי — הכנסות, הוצאות, יתרה ובקשות אחרונות." />
          <PageCard icon={Users} color="bg-purple-500" title="כיתות" desc={isSimpleMode
            ? 'רישום הכיתות ומספרי התלמידים.'
            : 'הוספה ועריכה של כיתות. לחיצה על כיתה פותחת פירוט תקציב מלא.'} />
          <PageCard icon={TrendingUp} color="bg-green-500" title="הכנסות" desc={isSimpleMode
            ? 'רישום כל מקורות ההכנסה: תרומות, עירייה, הורים, אירועים.'
            : 'הכנסות משרד החינוך מחושבות אוטומטית לפי הכיתות; כאן מוסיפים הכנסות נוספות.'} />
          <PageCard icon={Wallet} color="bg-teal-600" title="גבייה" desc="מעקב שכר לימוד: מייבאים את רשימת התלמידים מאקסל, רושמים כל תשלום שנכנס — ורואים מיד מי שילם, מי חלקית ומה נותר לגבות." />
          <PageCard icon={CreditCard} color="bg-coral-500" title="הוצאות" desc="רישום כל הוצאה לפי קטגוריה. מכל הוצאה אפשר לשלוח בקשת תשלום לשליח." />
          <PageCard icon={Package} color="bg-gold-500" title="בקשות תשלום" desc="מעקב אחרי ביצוע תשלומים: ממתין ← בביצוע ← שולם ← הושלם, כולל העלאת קבלות." />
          <PageCard icon={Wallet} color="bg-pink-500" title="משכורות" desc="רשימת העובדים והמשכורות, וסימון תשלום חודש-חודש עם אסמכתא." />
          {!isSimpleMode && (
            <PageCard icon={FlaskConical} color="bg-indigo-500" title="סימולציות" desc='בדיקת "מה יקרה אם" — עוד תלמידים? עוד כיתה? רואים את ההשפעה מיד, ואפשר לשמור כל תקציב שבנית כתרחיש ולחזור אליו.' />
          )}
          <PageCard icon={BarChart2} color="bg-blue-500" title="דוחות" desc="דוחות חודשיים וקטגוריות, סיכום שנתי, ייצוא לאקסל והדפסה." />
          <PageCard icon={Settings} color="bg-gray-500" title="הגדרות" desc="פרטי בית הספר, שנות תקציב, קבועים פיננסיים ומשתמשים." />
        </div>
      </div>

      {/* Tips */}
      <div className="card p-5 bg-purple-50 border border-purple-100">
        <h3 className="font-bold text-purple-800 mb-3">טיפים לשימוש</h3>
        <ul className="space-y-2 text-sm text-purple-700">
          {!isSimpleMode && (
            <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>משנים קבועים פיננסיים בהגדרות — וכל החישובים מתעדכנים לבד.</span></li>
          )}
          <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>הוצאה חודשית מוכפלת אוטומטית ב-12 בכל הסיכומים השנתיים.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>אחרי כל שמירה מופיעה הודעת אישור ירוקה למטה — אם לא ראית אותה, הנתון לא נשמר.</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5">💡</span><span>אפשר להתקין את המערכת כאפליקציה בטלפון: בדפדפן בוחרים "הוספה למסך הבית".</span></li>
        </ul>
      </div>

      <p className="text-center text-gray-400 text-xs">בנוי ופיתוח: שרה הגר · 0503339770</p>
      <p className="text-center text-gray-400 text-xs">יעוץ ארגוני | פתרונות דיגיטליים · מהבנת הארגון לפתרון שעובד.</p>
    </div>
  );
}
