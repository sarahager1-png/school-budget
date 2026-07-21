import { useMemo, useState } from 'react';
import {
  Lightbulb, Merge, Timer, Clock, UserPlus, PartyPopper, Scissors,
  AlertTriangle, ChevronDown, Plus, Minus, School, ArrowLeft, Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { calculateSchoolTotals, formatCurrency, formatCurrencyFull } from '../lib/calculations.js';
import {
  findMerges, extraHoursReport, hoursCutReport, thresholdReport,
  noStandardReport, eventsCapReport, topExpensesReport, MAX_MERGED_STUDENTS,
} from '../lib/efficiency.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import { CLASS_TYPE } from '../data/constants.js';

function Stepper({ value, onChange, min, max, unit, step = 1, decLabel = 'הפחתה', incLabel = 'הוספה' }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={incLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-9 h-9 rounded-xl border border-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus size={16} />
      </button>
      <span className="min-w-20 text-center text-sm font-black text-gray-800">
        {value.toLocaleString('he-IL')} {unit}
      </span>
      <button
        type="button"
        aria-label={decLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-9 h-9 rounded-xl border border-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Minus size={16} />
      </button>
    </div>
  );
}

const TONES = {
  purple: 'bg-purple-100 text-purple-600',
  teal: 'bg-teal-100 text-teal-600',
  gold: 'bg-gold-100 text-gold-600',
  coral: 'bg-coral-100 text-coral-600',
  green: 'bg-green-100 text-green-600',
};

function SuggestionCard({ icon: Icon, tone = 'teal', title, subtitle, saving, savingLabel = 'חיסכון בשנה', details, children, action, index = 0 }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-5 spring-enter" style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${TONES[tone]}`}>
          <Icon size={21} />
        </div>
        <div className="flex-1 min-w-40">
          <h3 className="font-bold text-gray-800 leading-snug">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{subtitle}</p>}
        </div>
        {saving != null && (
          <div className="text-left flex-shrink-0">
            <p className="text-xl md:text-2xl font-black text-green-600 leading-none">{formatCurrency(saving)}</p>
            <p className="text-xs text-gray-400 mt-1">{savingLabel}</p>
          </div>
        )}
      </div>

      {children && <div className="mt-4">{children}</div>}

      {details && details.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setOpen(p => !p)}
            aria-expanded={open}
            className="w-full flex items-center justify-between py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
          >
            <span>פירוט החישוב</span>
            <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="space-y-1.5 pt-1 fade-in">
              {details.map((d, i) => (
                <div key={i} className="flex justify-between items-baseline gap-3 text-sm">
                  <span className="text-gray-600">{d.label}</span>
                  <span className={`font-bold whitespace-nowrap ${d.tone === 'green' ? 'text-green-600' : d.tone === 'red' ? 'text-red-500' : 'text-gray-800'}`}>
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {action && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={action.onClick} className="btn-outline btn-sm">
            {action.label}
            <ArrowLeft size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function EfficiencyPage() {
  const { classes, incomeSources, expenses, expenseCategories, constants, navigate } = useApp();

  const [hoursCut, setHoursCut] = useState(1);
  const [trimPct, setTrimPct] = useState(10);

  const report = useMemo(() => {
    const merges = findMerges(classes, constants);
    const mergedIds = new Set(merges.flatMap(m => m.members.map(x => x.id)));
    // כיתות שצורפו: השעות הבודדות של החברות הקטנות כבר נחסכות בתוך ה-delta
    // של הצירוף עצמו (mergedClass לוקח מקסימום, לא סכום) — לא סופרים אותן שוב;
    // נשארות רק השעות של הכיתה המאוחדת עצמה (שווה למקסימום מבין החברות).
    const extraClasses = [
      ...classes.filter(c => !mergedIds.has(c.id)),
      ...merges.map(m => m.merged),
    ];
    return {
      merges,
      extra: extraHoursReport(extraClasses, constants),
      hours: hoursCutReport(classes, constants, 1),
      thresholds: thresholdReport(classes, constants, 4, mergedIds),
      noStd: noStandardReport(classes, constants, mergedIds),
      events: eventsCapReport(expenses, expenseCategories, classes),
      top: topExpensesReport(expenses, expenseCategories),
    };
  }, [classes, expenses, expenseCategories, constants]);

  const totals = useMemo(
    () => calculateSchoolTotals(classes, incomeSources, expenses, constants, expenseCategories),
    [classes, incomeSources, expenses, constants, expenseCategories],
  );

  const { merges, extra, hours, thresholds, noStd, events, top } = report;
  const hoursSaving = hours.perHourAllClasses * hoursCut;
  const trimSaving = Math.round(top.total * trimPct / 100);

  const totalPotential =
    merges.reduce((s, m) => s + m.delta, 0) +
    extra.totalCost +
    (hours.maxCut > 0 ? hoursSaving : 0) +
    events.excess +
    (top.rows.length > 0 ? trimSaving : 0) +
    thresholds.totalGain;

  const deficit = totals.isDeficit ? Math.abs(totals.balance) : 0;
  const coverage = deficit > 0 ? Math.min(100, Math.round(totalPotential / deficit * 100)) : null;

  if (classes.length === 0) {
    return (
      <div className="space-y-5">
        <h2 className="text-xl font-bold text-gray-800">הצעות ייעול</h2>
        <EmptyState
          icon={School}
          title="עוד אין כיתות במערכת"
          hint="ההצעות מחושבות מנתוני הכיתות וההוצאות שלך — נתחיל בהוספת הכיתות"
          actionLabel="למסך הכיתות"
          onAction={() => navigate('classes')}
        />
      </div>
    );
  }

  let cardIndex = 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">הצעות ייעול</h2>
        <p className="text-gray-500 text-sm mt-0.5">
          המערכת סרקה את הנתונים שלך ומצאה איפה אפשר לחסוך — כל הצעה עם הסכום המדויק
        </p>
      </div>

      {/* Summary */}
      <div className="card overflow-hidden spring-enter">
        <div className="h-1 bg-gradient-to-l from-purple-500 to-teal-500" />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">מצב נוכחי</p>
            <p className={`text-2xl font-black ${totals.isDeficit ? 'text-red-500' : 'text-green-600'}`}>
              {formatCurrencyFull(totals.balance)}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{totals.isDeficit ? 'גירעון שנתי' : 'עודף שנתי'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">פוטנציאל ההצעות שבמסך</p>
            <p className="text-2xl font-black bg-gradient-to-l from-purple-600 to-teal-500 bg-clip-text text-transparent">
              {formatCurrency(totalPotential)}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">שיפור אפשרי בשנה</p>
          </div>
          {coverage != null && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">כמה מהגירעון זה סוגר</p>
              <p className="text-2xl font-black text-gray-800">{coverage}%</p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2" role="progressbar" aria-label="כמה מהגירעון זה סוגר" aria-valuenow={coverage} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-gradient-to-l from-purple-500 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${coverage}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merges */}
      {merges.map(m => (
        <SuggestionCard
          key={m.merged.id}
          icon={Merge}
          tone="purple"
          index={++cardIndex}
          title={`צירוף כיתות בשכבה ${m.grade}: ${m.members.map(x => x.name).join(' + ')}`}
          subtitle={`${m.members.map(x => `${x.name} (${x.studentCount} תל׳)`).join(' + ')} ← כיתה אחת של ${m.merged.studentCount} תלמידים (${CLASS_TYPE[m.budgetAfter.type].label})`}
          saving={m.delta}
          details={[
            { label: 'הכנסות (משרד + תלמידים) לפני', value: formatCurrency(m.incomeBefore) },
            { label: 'הכנסות אחרי הצירוף', value: formatCurrency(m.incomeAfter), tone: m.incomeAfter < m.incomeBefore ? 'red' : undefined },
            { label: 'עלות הוראה והוצאות לפני', value: formatCurrency(m.costBefore) },
            { label: 'עלות אחרי הצירוף — כיתה אחת במקום ' + m.members.length, value: formatCurrency(m.costAfter), tone: 'green' },
            { label: 'חיסכון נטו בשנה', value: formatCurrencyFull(m.delta), tone: 'green' },
          ]}
          action={{ label: 'למסך הכיתות', onClick: () => navigate('classes') }}
        />
      ))}

      {/* Hours cut */}
      {hours.maxCut > 0 && (
        <SuggestionCard
          icon={Clock}
          tone="teal"
          index={++cardIndex}
          title="הורדת שעות הוראה בפועל"
          subtitle={`היום כל כיתה מקבלת ${hours.currentHours} שעות בחודש, והמשרד מממן ${hours.fundedHours} לכיתה מלאה. כל שעה חודשית שמורידים חוסכת ${formatCurrency(hours.hourlyRate * 12)} לכיתה בשנה.`}
          saving={hoursSaving}
          details={[
            { label: 'כיתות במערכת', value: `${hours.classCount}` },
            { label: 'חיסכון לשעה אחת בכל הכיתות', value: formatCurrency(hours.perHourAllClasses), tone: 'green' },
            { label: `הורדה של ${hoursCut} שעות × ${hours.classCount} כיתות`, value: formatCurrencyFull(hoursSaving), tone: 'green' },
          ]}
          action={{ label: 'לבדיקה בשערוך תקציב', onClick: () => navigate('simulations') }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-teal-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">כמה שעות להוריד מכל כיתה?</span>
            <Stepper value={hoursCut} onChange={setHoursCut} min={1} max={hours.maxCut} unit="שעות" />
          </div>
        </SuggestionCard>
      )}

      {/* Extra hours */}
      {extra.rows.length > 0 && (
        <SuggestionCard
          icon={Timer}
          tone="gold"
          index={++cardIndex}
          title="צמצום שעות בודדות"
          subtitle={`${extra.totalHours} שעות בודדות בחודש עולות ${formatCurrency(extra.totalCost)} בשנה — בלי מימון מהמשרד. כל שעה שמורידים חוסכת ${formatCurrency(extra.perHour)} בשנה.`}
          saving={extra.totalCost}
          savingLabel="אם מורידים הכל"
          details={extra.rows.map(r => ({
            label: `${r.cls.name} — ${r.hours} שעות בחודש`,
            value: formatCurrency(r.annualCost),
          }))}
          action={{ label: 'למסך הכיתות', onClick: () => navigate('classes') }}
        />
      )}

      {/* Threshold opportunities */}
      {thresholds.rows.length > 0 && (
        <SuggestionCard
          icon={UserPlus}
          tone="green"
          index={++cardIndex}
          title="כיתות קרובות לסף תקן — כל תלמיד שווה הרבה"
          subtitle="עוד תלמיד או שניים והכיתה קופצת מדרגת מימון במשרד החינוך. שווה לבדוק רישום נוסף לפני שמקצצים."
          saving={thresholds.totalGain}
          savingLabel="תוספת הכנסה בשנה"
          details={thresholds.rows.map(r => ({
            label: `${r.cls.name} — ${r.cls.studentCount} תל׳, חסרים ${r.gap} ל${r.nextType === 'full' ? 'תקן מלא' : 'חצי תקן'}`,
            value: `+${formatCurrency(r.gain)}`,
            tone: 'green',
          }))}
          action={{ label: 'למסך הכיתות', onClick: () => navigate('classes') }}
        />
      )}

      {/* Events cap */}
      {events.excess > 0 && (
        <SuggestionCard
          icon={PartyPopper}
          tone="coral"
          index={++cardIndex}
          title="הוצאות אירועים מעל תקרת הרשת"
          subtitle={`כלל הרשת: עד ${formatCurrency(events.capPerStudent)} לתלמיד בשנה לפעילויות ואירועים. אצלך: ${formatCurrency(events.eventsTotal)} מול תקרה של ${formatCurrency(events.cap)} (${events.totalStudents} תלמידים).`}
          saving={events.excess}
          savingLabel="חזרה לתקרה"
          action={{ label: 'למסך ההוצאות', onClick: () => navigate('expenses') }}
        />
      )}

      {/* Trim top expenses */}
      {top.rows.length > 0 && (
        <SuggestionCard
          icon={Scissors}
          tone="purple"
          index={++cardIndex}
          title="קיצוץ מדורג בהוצאות הגדולות"
          subtitle={`${top.rows.length} ההוצאות הכלליות הגדולות (בלי שכר) מסתכמות ב-${formatCurrency(top.total)} בשנה. לפעמים משא ומתן עם ספק או שינוי היקף חוסכים אחוזים בלי לפגוע בפעילות.`}
          saving={trimSaving}
          savingLabel={`בקיצוץ של ${trimPct}%`}
          details={top.rows.map(r => ({
            label: `${r.e.name}${r.category ? ` (${r.category})` : ''}`,
            value: `${formatCurrency(r.annual)} ← חיסכון ${formatCurrency(Math.round(r.annual * trimPct / 100))}`,
          }))}
          action={{ label: 'למסך ההוצאות', onClick: () => navigate('expenses') }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-purple-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">אחוז קיצוץ לבדיקה</span>
            <Stepper value={trimPct} onChange={setTrimPct} min={5} max={25} step={5} unit="%" />
          </div>
        </SuggestionCard>
      )}

      {/* Classes without standard — awareness */}
      {noStd.rows.length > 0 && (
        <SuggestionCard
          icon={AlertTriangle}
          tone="coral"
          index={++cardIndex}
          title="כיתות ללא תקן — שוות תשומת לב"
          subtitle="כיתות מתחת לסף המימון: המשרד לא משתתף בעלות שלהן. אם אין אפשרות לצרף או להגדיל — כדאי לוודא שזו החלטה מודעת."
          details={noStd.rows.map(r => ({
            label: `${r.cls.name} — ${r.cls.studentCount} תלמידים`,
            value: formatCurrencyFull(r.budget.balance),
            tone: 'red',
          }))}
          action={{ label: 'למסך הכיתות', onClick: () => navigate('classes') }}
        />
      )}

      {/* Nothing found */}
      {merges.length === 0 && extra.rows.length === 0 && hours.maxCut === 0 &&
        thresholds.rows.length === 0 && events.excess === 0 && top.rows.length === 0 && noStd.rows.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title="לא מצאנו בזבוזים בולטים"
          hint="התקציב שלך מנוהל צמוד — נבדוק שוב אחרי שיתעדכנו נתונים"
        />
      )}

      <p className="text-xs text-gray-400 leading-relaxed flex items-start gap-1.5">
        <Lightbulb size={13} className="flex-shrink-0 mt-0.5" />
        כל הצעה מחושבת בנפרד מהנתונים שלך לפי מודל התקציב. יישום של כמה הצעות יחד עשוי לחפוף חלקית — לבדיקה מדויקת של שילוב, השתמשי בשערוך התקציב.
      </p>
    </div>
  );
}
