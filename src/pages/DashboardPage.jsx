import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle, Users, ArrowLeft,
  School, CreditCard, Settings, Package, ChevronDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import {
  calculateSchoolTotals, calculateSimpleTotals, generateMonthlyData, generateCategoryData,
  categoryTotals, annualAmount, formatCurrency, formatCurrencyFull,
} from '../lib/calculations.js';
import { REQUEST_STATUS, CLASS_TYPE, MANAGERS, OFEK_RATES } from '../data/constants.js';
import CountUp from '../components/ui/CountUp.jsx';

// breakdown: [{label, value, negative?}] — "מה כולל?" נפתח ומראה ממה המספר מורכב
function StatCard({ label, value, rawValue, format, sub, color, icon: Icon, isNegative, index = 0, breakdown }) {
  const [open, setOpen] = useState(false);
  const colors = {
    teal: { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'bg-teal-500', text: 'text-teal-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'bg-purple-500', text: 'text-purple-600' },
    coral: { bg: 'bg-coral-50', border: 'border-coral-200', icon: 'bg-coral-500', text: 'text-coral-600' },
    gold: { bg: 'bg-gold-50', border: 'border-gold-200', icon: 'bg-gold-500', text: 'text-gold-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'bg-green-500', text: 'text-green-600' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-500', text: 'text-red-600' },
  };
  const c = colors[color] || colors.teal;

  return (
    <div className={`card p-5 border-r-4 ${c.border} spring-enter`} style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
        {isNegative !== undefined && (
          isNegative
            ? <TrendingDown size={16} className="text-red-400" />
            : <TrendingUp size={16} className="text-green-400" />
        )}
      </div>
      <p className="text-gray-500 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-black ${isNegative ? 'text-red-600' : 'text-gray-800'}`}>
        {rawValue !== undefined
          ? <CountUp to={rawValue} format={format} delay={index * 70} />
          : value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {breakdown?.some(r => r.value !== 0) && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className={`mt-2.5 text-xs font-bold flex items-center gap-1 ${c.text} hover:opacity-75 transition-opacity`}
          >
            מה כולל?
            <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
              {breakdown.filter(r => r.value !== 0).map(r => (
                <div key={r.label} className="flex justify-between items-baseline gap-2 text-xs">
                  <span className="text-gray-500 truncate">{r.label}</span>
                  <span className={`font-bold flex-shrink-0 ${r.negative ? 'text-red-500' : 'text-gray-700'}`}>
                    {r.negative ? '− ' : ''}{formatCurrency(r.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const RADIAN = Math.PI / 180;
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// First-use guidance: shows only while the year is still empty
function GettingStarted({ navigate, isSimpleMode, hasClasses, hasExpenses }) {
  const steps = isSimpleMode
    ? [
        { done: hasExpenses, label: 'הוסיפי את ההוצאות של בית הספר', page: 'expenses', icon: CreditCard },
        { done: false, label: 'רשמי מקורות הכנסה (תרומות, עירייה...)', page: 'income', icon: TrendingUp },
      ]
    : [
        { done: false, label: 'בדקי את הקבועים הפיננסיים (תעריפים ותקנים)', page: 'settings', icon: Settings },
        { done: hasClasses, label: 'הוסיפי את הכיתות ומספרי התלמידים', page: 'classes', icon: School },
        { done: hasExpenses, label: 'הוסיפי את ההוצאות הכלליות (שכר, בניין...)', page: 'expenses', icon: CreditCard },
      ];

  return (
    <div className="card p-6 border-2 border-teal-200 bg-teal-50/40">
      <h3 className="font-bold text-gray-800 text-lg mb-1">ברוכה הבאה! 👋</h3>
      <p className="text-gray-500 text-sm mb-4">שלושה צעדים קטנים והמערכת מוכנה לעבודה:</p>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => navigate(s.page)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-right transition-all ${
              s.done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-teal-300 hover:shadow-sm'
            }`}
          >
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
              s.done ? 'bg-green-500 text-white' : 'bg-teal-100 text-teal-700'
            }`}>
              {s.done ? '✓' : i + 1}
            </span>
            <span className={`flex-1 text-sm font-medium ${s.done ? 'text-green-700' : 'text-gray-700'}`}>{s.label}</span>
            <ArrowLeft size={15} className="text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// שאלה קריטית: שכר אופק חדש קובע את תעריף עלות ההוראה — נשאלת עד שעונים
function OfekQuestion({ constants, setConstants }) {
  const answer = (yes) => setConstants({
    ...constants,
    ofekSalary: yes,
    actualHourlyRate: yes ? OFEK_RATES.yes : OFEK_RATES.no,
  });
  return (
    <div className="card p-5 border-2 border-gold-300 bg-gold-50/50">
      <h3 className="font-bold text-gray-800 text-lg mb-1">שאלה חשובה לחישוב עלות ההוראה 💡</h3>
      <p className="text-sm text-gray-600 mb-4">
        האם המורות בבית הספר מקבלות שכר לפי <strong>אופק חדש</strong>?
        התשובה קובעת את תעריף השעה בחישוב עלות ההוראה, ואפשר לשנות אותה בכל רגע בהגדרות.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => answer(true)} className="btn-primary flex-1 justify-center">
          כן — שכר אופק ({OFEK_RATES.yes} ₪ לשעה)
        </button>
        <button onClick={() => answer(false)} className="btn-outline flex-1 justify-center">
          לא — ללא אופק ({OFEK_RATES.no} ₪ לשעה)
        </button>
      </div>
    </div>
  );
}

function RecentRequests({ expenseRequests, navigate }) {
  const recent = [...expenseRequests]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">בקשות תשלום אחרונות</h3>
        <button
          onClick={() => navigate('courier')}
          className="text-teal-600 text-sm flex items-center gap-1 hover:text-teal-700"
        >
          <span>כל הבקשות</span>
          <ArrowLeft size={14} className="rotate-180" />
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">
          עוד אין בקשות תשלום. יוצרים בקשה מתוך מסך ההוצאות — ליד כל הוצאה יש כפתור שליחה לשליח.
        </p>
      ) : (
        <div className="space-y-2">
          {recent.map(req => {
            const st = REQUEST_STATUS[req.status];
            return (
              <div key={req.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st?.dot}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{req.name}</p>
                    <p className="text-gray-400 text-xs">{req.createdAt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`badge ${st?.color}`}>{st?.label}</span>
                  <span className="font-bold text-gray-700 text-sm">{formatCurrency(req.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// "ללא תקציב": הכנסות מול הוצאות בפועל, בלי מודל תקציב
function SimpleDashboard() {
  const { incomeSources, expenses, expenseCategories, expenseRequests, navigate } = useApp();

  const totals = useMemo(() => calculateSimpleTotals(incomeSources, expenses), [incomeSources, expenses]);
  const catData = useMemo(
    () => categoryTotals(expenses, expenseCategories).filter(c => c.value > 0),
    [expenses, expenseCategories],
  );
  const pendingCount = expenseRequests.filter(r => r.status === 'pending').length;
  const isEmpty = expenses.length === 0 && incomeSources.length === 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <GettingStarted navigate={navigate} isSimpleMode hasClasses={false} hasExpenses={expenses.length > 0} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="סה״כ הכנסות שנתיות" rawValue={totals.totalIncome} format={formatCurrency} sub={`${incomeSources.length} מקורות`} color="teal" icon={TrendingUp} isNegative={false}
          breakdown={incomeSources.map(s => ({ label: s.name, value: s.amount || 0 }))} />
        <StatCard index={1} label="סה״כ הוצאות שנתיות" rawValue={totals.totalExpenses} format={formatCurrency} sub={`${expenses.length} סעיפים`} color="coral" icon={TrendingDown} isNegative={true}
          breakdown={catData.map(c => ({ label: c.name, value: c.value }))} />
        <StatCard index={2} label="יתרה שנתית" rawValue={totals.balance} format={formatCurrencyFull} sub={totals.isDeficit ? 'גירעון' : 'עודף'} color={totals.isDeficit ? 'red' : 'green'} icon={DollarSign} isNegative={totals.isDeficit}
          breakdown={[
            { label: 'סה״כ הכנסות', value: totals.totalIncome },
            { label: 'סה״כ הוצאות', value: totals.totalExpenses, negative: true },
          ]} />
        <StatCard index={3} label="בקשות ממתינות" rawValue={pendingCount} format={n => n} sub="בקשות תשלום לטיפול" color="gold" icon={Package} />
      </div>

      {catData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">חלוקת הוצאות</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" outerRadius={85} dataKey="value" labelLine={false} label={CustomLabel}>
                  {catData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip
                  formatter={(v, n, p) => [`₪${v.toLocaleString('he-IL')}`, p.payload.name]}
                  contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {catData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-gray-600 truncate">{d.name}</span>
                  </div>
                  <span className="font-medium text-gray-700">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">מקורות הכנסה</h3>
            {incomeSources.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">עוד לא נרשמו מקורות הכנסה</p>
            ) : (
              <div className="space-y-3">
                {incomeSources.map(src => (
                  <div key={src.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{formatCurrency(src.amount)}</span>
                      <span className="text-gray-500 truncate">{src.name}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${Math.min(100, (src.amount / (totals.totalIncome || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <RecentRequests expenseRequests={expenseRequests} navigate={navigate} />
    </div>
  );
}

export default function DashboardPage() {
  const { isSimpleMode } = useApp();
  return isSimpleMode ? <SimpleDashboard /> : <FullDashboard />;
}

function FullDashboard() {
  const { classes, incomeSources, expenses, expenseCategories, expenseRequests, constants, setConstants, user, navigate } = useApp();

  const totals = useMemo(
    () => calculateSchoolTotals(classes, incomeSources, expenses, constants, expenseCategories),
    [classes, incomeSources, expenses, constants, expenseCategories],
  );

  const monthlyData = useMemo(() => generateMonthlyData(totals), [totals]);
  const categoryData = useMemo(
    () => generateCategoryData(expenses, classes, constants, expenseCategories),
    [expenses, classes, constants, expenseCategories],
  );

  const formatK = (v) => `₪${(v / 1000).toFixed(0)}K`;
  const isEmpty = classes.length === 0 && expenses.length === 0;

  // "מה כולל?" — הרכב מלא של כל מספר מסכם
  const incomeBreakdown = [
    { label: 'משרד החינוך לפי תקן', value: totals.totalMinistryIncome },
    { label: 'תוספת כללית לתלמיד — משרד', value: totals.totalMinistryGrantIncome },
    { label: 'הכנסה לתלמיד', value: totals.totalStudentIncome },
    { label: 'תל"ן (תשלומי הורים)', value: totals.totalTalanIncome },
    ...incomeSources.map(s => ({ label: s.name, value: s.amount || 0 })),
  ];
  // שכר מנהלת מוצג בשמו, בנפרד מקטגוריית השכר שהוא רשום בה
  const principalLine = expenses.find(e => e.name === 'שכר מנהלת');
  const principalAnnual = principalLine ? annualAmount(principalLine) : 0;
  const expenseBreakdown = [
    { label: 'עלות הוראה לפי תקן', value: totals.totalClassActualCost },
    { label: 'שעות בודדות', value: totals.totalExtraHoursCost },
    { label: 'הוצאות תלמיד', value: totals.totalStudentExpenses },
    { label: 'פיתוח מקצועי', value: totals.totalProfDev },
    ...(principalAnnual > 0 ? [{ label: 'שכר מנהלת', value: principalAnnual }] : []),
    ...categoryTotals(expenses, expenseCategories)
      .filter(c => c.kind !== 'profdev')
      .map(c => (principalLine && c.id === principalLine.categoryId
        ? { label: c.name, value: c.value - principalAnnual }
        : { label: c.name, value: c.value }))
      .filter(c => c.value > 0),
  ];
  const balanceBreakdown = [
    { label: 'סה״כ הכנסות', value: totals.totalIncome },
    { label: 'סה״כ הוצאות', value: totals.totalExpenses, negative: true },
  ];
  const gapBreakdown = [
    { label: 'עלות הוראה בפועל', value: totals.totalClassActualCost },
    { label: 'מימון משרד לפי תקן', value: totals.totalMinistryIncome, negative: true },
  ];

  return (
    <div className="space-y-6">
      {constants.ofekSalary == null && MANAGERS.includes(user?.role) && (
        <OfekQuestion constants={constants} setConstants={setConstants} />
      )}

      {isEmpty && (
        <GettingStarted
          navigate={navigate}
          isSimpleMode={false}
          hasClasses={classes.length > 0}
          hasExpenses={expenses.length > 0}
        />
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0}
          label="סה״כ הכנסות שנתיות"
          rawValue={totals.totalIncome}
          format={formatCurrency}
          sub={`${totals.totalStudents} תלמידים`}
          color="teal"
          icon={TrendingUp}
          isNegative={false}
          breakdown={incomeBreakdown}
        />
        <StatCard
          index={1}
          label="סה״כ הוצאות שנתיות"
          rawValue={totals.totalExpenses}
          format={formatCurrency}
          sub={`${classes.length} כיתות`}
          color="coral"
          icon={TrendingDown}
          isNegative={true}
          breakdown={expenseBreakdown}
        />
        <StatCard
          index={2}
          label="יתרה שנתית"
          rawValue={totals.balance}
          format={formatCurrencyFull}
          sub={totals.isDeficit ? 'גירעון' : 'עודף'}
          color={totals.isDeficit ? 'red' : 'green'}
          icon={DollarSign}
          isNegative={totals.isDeficit}
          breakdown={balanceBreakdown}
        />
        <StatCard
          index={3}
          label="פער עלות הוראה"
          rawValue={totals.ministryGap}
          format={formatCurrency}
          sub="כמה ההוראה עולה מעבר למימון המשרד"
          color="purple"
          icon={AlertCircle}
          isNegative={true}
          breakdown={gapBreakdown}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Bar Chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold text-gray-800 mb-4">הכנסות מול הוצאות — לפי חודש</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip
                formatter={(v, n) => [`₪${v.toLocaleString('he-IL')}`, n]}
                contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Bar dataKey="הכנסות" fill="#00B4CC" radius={[3, 3, 0, 0]} />
              <Bar dataKey="הוצאות" fill="#F07A20" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Pie Chart */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-4">חלוקת הוצאות</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                labelLine={false}
                label={CustomLabel}
              >
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n, p) => [`₪${v.toLocaleString('he-IL')}`, p.payload.name]}
                contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {categoryData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                  <span className="text-gray-600 truncate">{d.name}</span>
                </div>
                <span className="font-medium text-gray-700">{formatK(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Income vs Expense Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Income Breakdown */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-4">מקורות הכנסה</h3>
          <div className="space-y-3">
            {[
              { label: 'משרד החינוך', value: totals.totalMinistryIncome + totals.totalMinistryGrantIncome, color: '#00B4CC' },
              { label: 'הכנסה לתלמיד', value: totals.totalStudentIncome, color: '#4B2E83' },
              { label: 'הכנסות נוספות', value: totals.additionalIncome, color: '#F5C518' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{formatCurrency(item.value)}</span>
                  <span className="text-gray-500">{item.label}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (item.value / (totals.totalIncome || 1)) * 100)}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Class Summary */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">סיכום כיתות</h3>
            <button
              onClick={() => navigate('classes')}
              className="text-teal-600 text-sm flex items-center gap-1 hover:text-teal-700"
            >
              <span>כל הכיתות</span>
              <ArrowLeft size={14} className="rotate-180" />
            </button>
          </div>
          {totals.classBreakdowns.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">עוד לא הוגדרו כיתות לשנה זו</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-right py-2 text-gray-500 font-medium">כיתה</th>
                    <th className="text-center py-2 text-gray-500 font-medium">תלמידים</th>
                    <th className="text-center py-2 text-gray-500 font-medium">סוג</th>
                    <th className="text-left py-2 text-gray-500 font-medium">יתרה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {totals.classBreakdowns.slice(0, 6).map(cls => {
                    const typeInfo = CLASS_TYPE[cls.budget.type];
                    const isDeficit = cls.budget.isDeficit;
                    return (
                      <tr key={cls.id} className="hover:bg-gray-50">
                        <td className="py-2 font-medium text-gray-800">{cls.name}</td>
                        <td className="py-2 text-center">
                          <span className="flex items-center justify-center gap-1 text-gray-600">
                            <Users size={12} />
                            {cls.studentCount}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <span className={`badge ${typeInfo?.color}`}>{typeInfo?.label}</span>
                        </td>
                        <td className="py-2 text-left">
                          <span className={`font-bold ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrencyFull(cls.budget.balance)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <RecentRequests expenseRequests={expenseRequests} navigate={navigate} />
    </div>
  );
}
