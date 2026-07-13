import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Printer, Download } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import {
  calculateSchoolTotals, calculateSimpleTotals, generateMonthlyData, generateCategoryData,
  categoryTotals, formatCurrency, formatCurrencyFull,
} from '../lib/calculations.js';

function exportCSV(filename, headers, rows) {
  const BOM = '﻿';
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { classes, incomeSources, expenses, expenseCategories, constants, currentYear, isSimpleMode } = useApp();

  const TABS = [
    { key: 'monthly', label: 'חודשי' },
    ...(isSimpleMode ? [] : [{ key: 'classes', label: 'כיתות' }]),
    { key: 'categories', label: 'קטגוריות' },
    { key: 'summary', label: 'סיכום שנתי' },
  ];
  const [activeTab, setActiveTab] = useState('monthly');

  const totals = useMemo(
    () => isSimpleMode
      ? calculateSimpleTotals(incomeSources, expenses)
      : calculateSchoolTotals(classes, incomeSources, expenses, constants, expenseCategories),
    [isSimpleMode, classes, incomeSources, expenses, constants, expenseCategories],
  );

  const monthlyData = useMemo(() => generateMonthlyData(totals), [totals]);

  const categoryData = useMemo(
    () => isSimpleMode
      ? categoryTotals(expenses, expenseCategories).filter(c => c.value > 0)
      : generateCategoryData(expenses, classes, constants, expenseCategories),
    [isSimpleMode, expenses, classes, constants, expenseCategories],
  );

  const classChartData = useMemo(() =>
    isSimpleMode ? [] : totals.classBreakdowns.map(c => ({
      name: c.name,
      הכנסות: Math.round(c.budget.totalIncome),
      הוצאות: Math.round(c.budget.totalExpenses),
    })),
    [isSimpleMode, totals],
  );

  const handleExport = () => {
    if (activeTab === 'monthly') {
      exportCSV(
        `דוח_חודשי_${currentYear?.year || ''}.csv`,
        ['חודש', 'הכנסות', 'הוצאות', 'יתרה'],
        monthlyData.map(r => [r.month, r.הכנסות, r.הוצאות, r.יתרה]),
      );
    } else if (activeTab === 'classes' && !isSimpleMode) {
      exportCSV(
        `דוח_כיתות_${currentYear?.year || ''}.csv`,
        ['כיתה', 'תלמידים', 'הכנסה ממשרד', 'הכנסה כוללת', 'הוצאות', 'יתרה'],
        totals.classBreakdowns.map(c => [
          c.name, c.studentCount,
          Math.round(c.budget.ministryIncome),
          Math.round(c.budget.totalIncome),
          Math.round(c.budget.totalExpenses),
          Math.round(c.budget.balance),
        ]),
      );
    } else if (activeTab === 'categories') {
      exportCSV(
        `דוח_קטגוריות_${currentYear?.year || ''}.csv`,
        ['קטגוריה', 'סכום', 'אחוז'],
        categoryData.map(item => [
          item.name,
          item.value,
          `${((item.value / (totals.totalExpenses || 1)) * 100).toFixed(1)}%`,
        ]),
      );
    } else {
      const rows = isSimpleMode
        ? [
            ...incomeSources.map(s => [`הכנסה — ${s.name}`, Math.round(s.amount)]),
            ['סה״כ הכנסות', Math.round(totals.totalIncome)],
            ...categoryData.map(c => [`הוצאות — ${c.name}`, Math.round(c.value)]),
            ['סה״כ הוצאות', Math.round(totals.totalExpenses)],
            [totals.isDeficit ? 'גירעון' : 'עודף', Math.round(Math.abs(totals.balance))],
          ]
        : [
            ['הכנסות ממשרד החינוך', Math.round(totals.totalMinistryIncome + totals.totalMinistryGrantIncome)],
            ['הכנסות לתלמיד', Math.round(totals.totalStudentIncome)],
            ['הכנסות נוספות', Math.round(totals.additionalIncome)],
            ['סה״כ הכנסות', Math.round(totals.totalIncome)],
            ['עלות הוראה בפועל', Math.round(totals.totalClassActualCost)],
            ['הוצאות תלמידים', Math.round(totals.totalStudentExpenses)],
            ['פיתוח מקצועי', Math.round(totals.totalProfDev)],
            ['שכר', Math.round(totals.salaryExpenses)],
            ['בניין ותחזוקה', Math.round(totals.buildingExpenses)],
            ['פעילויות ואירועים', Math.round(totals.operationExpenses)],
            ['ציוד ותשתיות', Math.round(totals.summerExpenses)],
            ['אחר', Math.round(totals.miscExpenses)],
            ['סה״כ הוצאות', Math.round(totals.totalExpenses)],
            [totals.isDeficit ? 'גירעון' : 'עודף', Math.round(Math.abs(totals.balance))],
          ];
      exportCSV(`סיכום_שנתי_${currentYear?.year || ''}.csv`, ['פריט', 'סכום'], rows);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-800">דוחות כספיים</h2>
          <p className="text-gray-500 text-sm mt-0.5">{currentYear?.label}</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExport} className="btn-outline">
            <Download size={16} />
            ייצוא לאקסל
          </button>
          <button onClick={() => window.print()} className="btn-outline">
            <Printer size={16} />
            הדפסה
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto no-print">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'tab-active' : 'tab-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Monthly Tab */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">הכנסות מול הוצאות — חודשי</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  formatter={(v, n) => [`₪${v.toLocaleString('he-IL')}`, n]}
                  contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '13px' }} />
                <Bar dataKey="הכנסות" fill="#0FA3B1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="הוצאות" fill="#F07A20" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">חודש</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">הכנסות</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">הוצאות</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">יתרה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthlyData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{row.month}</td>
                      <td className="px-4 py-2.5 text-left text-green-600 font-medium">{formatCurrency(row.הכנסות)}</td>
                      <td className="px-4 py-2.5 text-left text-red-500 font-medium">{formatCurrency(row.הוצאות)}</td>
                      <td className="px-4 py-2.5 text-left">
                        <span className={`font-bold ${row.יתרה < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrencyFull(row.יתרה)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                    <td className="px-4 py-3">סה״כ</td>
                    <td className="px-4 py-3 text-left text-green-600">{formatCurrency(totals.totalIncome)}</td>
                    <td className="px-4 py-3 text-left text-red-500">{formatCurrency(totals.totalExpenses)}</td>
                    <td className="px-4 py-3 text-left">
                      <span className={totals.isDeficit ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrencyFull(totals.balance)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Classes Tab — budget mode only */}
      {activeTab === 'classes' && !isSimpleMode && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">הכנסות מול הוצאות לפי כיתה</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={classChartData} layout="vertical" margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={70} />
                <Tooltip
                  formatter={(v, n) => [`₪${v.toLocaleString('he-IL')}`, n]}
                  contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '13px' }} />
                <Bar dataKey="הכנסות" fill="#0FA3B1" radius={[0, 3, 3, 0]} />
                <Bar dataKey="הוצאות" fill="#F07A20" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">כיתה</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-medium">תלמידים</th>
                    <th className="text-left px-3 py-3 text-gray-500 font-medium">הכנסה ממשרד</th>
                    <th className="text-left px-3 py-3 text-gray-500 font-medium">הכנסה כוללת</th>
                    <th className="text-left px-3 py-3 text-gray-500 font-medium">הוצאות</th>
                    <th className="text-left px-3 py-3 text-gray-500 font-medium">יתרה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {totals.classBreakdowns.map(cls => (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{cls.name}</td>
                      <td className="px-3 py-2.5 text-center text-gray-600">{cls.studentCount}</td>
                      <td className="px-3 py-2.5 text-left text-teal-600">{formatCurrency(cls.budget.ministryIncome)}</td>
                      <td className="px-3 py-2.5 text-left text-green-600 font-medium">{formatCurrency(cls.budget.totalIncome)}</td>
                      <td className="px-3 py-2.5 text-left text-red-500">{formatCurrency(cls.budget.totalExpenses)}</td>
                      <td className="px-3 py-2.5 text-left">
                        <span className={`font-bold ${cls.budget.isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrencyFull(cls.budget.balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">חלוקת הוצאות לפי קטגוריה</h3>
            {categoryData.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">עוד אין הוצאות לשנה זו</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false}>
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
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">פירוט לפי קטגוריה</h3>
            <div className="space-y-3">
              {categoryData.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.fill }} />
                      <span className="text-sm text-gray-700">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-800 text-sm">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(item.value / (totals.totalExpenses || 1)) * 100}%`,
                        background: item.fill,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 text-left">
                    {((item.value / (totals.totalExpenses || 1)) * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Yearly Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {!isSimpleMode && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'סה״כ כיתות', value: classes.length, unit: 'כיתות', color: 'text-teal-600' },
                { label: 'סה״כ תלמידים', value: totals.totalStudents, unit: 'תלמידים', color: 'text-purple-600' },
                { label: 'הכנסה ממשרד', value: formatCurrency(totals.totalMinistryIncome), unit: '', color: 'text-teal-600' },
                { label: 'פער עלות הוראה', value: formatCurrency(totals.ministryGap), unit: '', color: 'text-coral-600' },
              ].map(item => (
                <div key={item.label} className="card p-4">
                  <p className="text-gray-500 text-xs mb-1">{item.label}</p>
                  <p className={`font-black text-xl ${item.color}`}>{item.value}</p>
                  {item.unit && <p className="text-xs text-gray-400">{item.unit}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="card p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-5">סיכום כספי שנתי — {currentYear?.label}</h3>
            <div className="space-y-3">
              {(isSimpleMode
                ? [
                    ...incomeSources.map(s => ({ label: s.name, value: s.amount, type: 'income' })),
                    { label: null },
                    { label: 'סה״כ הכנסות', value: totals.totalIncome, type: 'total-income' },
                    { label: null },
                    ...categoryData.map(c => ({ label: c.name, value: c.value, type: 'expense' })),
                    { label: null },
                    { label: 'סה״כ הוצאות', value: totals.totalExpenses, type: 'total-expense' },
                    { label: null },
                    { label: totals.isDeficit ? 'גירעון שנתי' : 'עודף שנתי', value: totals.balance, type: 'balance' },
                  ]
                : [
                    { label: 'הכנסות ממשרד החינוך', value: totals.totalMinistryIncome + totals.totalMinistryGrantIncome, type: 'income' },
                    { label: 'הכנסות לתלמיד', value: totals.totalStudentIncome, type: 'income' },
                    { label: 'הכנסות נוספות (תרומות, עירייה וכו׳)', value: totals.additionalIncome, type: 'income' },
                    { label: null },
                    { label: 'סה״כ הכנסות', value: totals.totalIncome, type: 'total-income' },
                    { label: null },
                    { label: 'עלות הוראה בפועל', value: totals.totalClassActualCost, type: 'expense' },
                    { label: 'הוצאות לתלמיד', value: totals.totalStudentExpenses, type: 'expense' },
                    { label: 'פיתוח מקצועי', value: totals.totalProfDev, type: 'expense' },
                    { label: 'שכר', value: totals.salaryExpenses, type: 'expense' },
                    { label: 'בניין ותחזוקה', value: totals.buildingExpenses, type: 'expense' },
                    { label: 'פעילויות ואירועים', value: totals.operationExpenses, type: 'expense' },
                    { label: 'ציוד ותשתיות', value: totals.summerExpenses, type: 'expense' },
                    ...(totals.miscExpenses > 0 ? [{ label: 'אחר', value: totals.miscExpenses, type: 'expense' }] : []),
                    { label: null },
                    { label: 'סה״כ הוצאות', value: totals.totalExpenses, type: 'total-expense' },
                    { label: null },
                    { label: totals.isDeficit ? 'גירעון שנתי' : 'עודף שנתי', value: totals.balance, type: 'balance' },
                  ]
              ).map((row, i) =>
                !row.label ? (
                  <div key={i} className="border-t border-gray-100 my-1" />
                ) : (
                  <div key={i} className={`flex justify-between items-center py-1.5 ${
                    ['total-income', 'total-expense', 'balance'].includes(row.type) ? 'bg-gray-50 rounded-lg px-3' : ''
                  }`}>
                    <span className={`text-sm ${['total-income', 'total-expense', 'balance'].includes(row.type) ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
                      {row.label}
                    </span>
                    <span className={`font-bold ${
                      row.type === 'income' ? 'text-green-600' :
                      row.type === 'total-income' ? 'text-green-700 text-base' :
                      row.type === 'expense' ? 'text-red-500' :
                      row.type === 'total-expense' ? 'text-red-600 text-base' :
                      totals.isDeficit ? 'text-red-700 text-xl' : 'text-green-700 text-xl'
                    }`}>
                      {row.type === 'balance' ? formatCurrencyFull(row.value) : formatCurrency(row.value)}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
