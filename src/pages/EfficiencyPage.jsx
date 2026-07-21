import { useMemo, useState, useEffect } from 'react';
import {
  Lightbulb, Merge, Clock, UserPlus, PartyPopper, Scissors,
  AlertTriangle, ChevronDown, Plus, Minus, School, ArrowLeft, Sparkles, Layers, Flame, Sun, HandCoins,
  GraduationCap, UserCog, Wallet, Banknote, Save, DoorClosed,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabase.js';
import { calculateSchoolTotals, getClassType, formatCurrency, formatCurrencyFull } from '../lib/calculations.js';
import {
  findMerges, closeClassReport, hoursCutReport, thresholdReport,
  noStandardReport, eventsCapReport, topExpensesReport, dualAgeMergeReport,
  jointShabbatReport, caharonReport, parentContributionReport,
  partaniyotReport, principalTeachingReport, tuitionReport, tuitionSupplementReport,
  DUAL_AGE_EXTRA_MONTHLY_HOURS,
  DEFAULT_SHABBAT_MONTHLY_HOURS, DEFAULT_PARENT_CONTRIBUTION,
  DEFAULT_PARTANIYOT_HOURS, DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS, TEACHER_POSITION_HOURS,
  DEFAULT_TUITION_AMOUNT, DEFAULT_TUITION_COLLECTION_RATE, DEFAULT_TUITION_SUPPLEMENT,
  normalizeSuggestionKey,
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

function SuggestionCard({ icon: Icon, tone = 'teal', title, subtitle, saving, savingLabel = 'חיסכון בשנה', details, children, action, index = 0, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card p-5 spring-enter transition-opacity ${onToggle && !selected ? 'opacity-50' : ''}`} style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}>
      <div className="flex items-start gap-3 flex-wrap">
        {onToggle && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`בחירת ההצעה: ${title}`}
            className="w-5 h-5 accent-purple-600 flex-shrink-0 mt-3 cursor-pointer"
          />
        )}
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

// זיהוי "הטבלה עוד לא הוקמה" (מיגרציה לא רצה) לעומת תקלה חולפת
function isMissingTableError(error) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /does not exist|schema cache/i.test(error.message || '');
}

export default function EfficiencyPage() {
  const { classes, incomeSources, expenses, expenseCategories, constants, navigate, user, currentYear, notify, saveFailed } = useApp();

  const [hoursCut, setHoursCut] = useState(1);
  const [trimPct, setTrimPct] = useState(10);
  const [shabbatHours, setShabbatHours] = useState(DEFAULT_SHABBAT_MONTHLY_HOURS);
  const [parentAmount, setParentAmount] = useState(DEFAULT_PARENT_CONTRIBUTION);
  const [partaniyotHours, setPartaniyotHours] = useState(DEFAULT_PARTANIYOT_HOURS);
  const [principalHours, setPrincipalHours] = useState(DEFAULT_PRINCIPAL_TEACHING_WEEKLY_HOURS);
  const [tuitionAmount, setTuitionAmount] = useState(DEFAULT_TUITION_AMOUNT);
  const [tuitionRate, setTuitionRate] = useState(DEFAULT_TUITION_COLLECTION_RATE);
  const [supplementAmount, setSupplementAmount] = useState(DEFAULT_TUITION_SUPPLEMENT);

  const report = useMemo(() => {
    const merges = findMerges(classes, constants);
    const mergedIds = new Set(merges.flatMap(m => m.members.map(x => x.id)));
    const dualMerges = dualAgeMergeReport(classes, constants, mergedIds);
    const dualMergedIds = new Set(dualMerges.flatMap(m => m.members.map(x => x.id)));
    const allMergedIds = new Set([...mergedIds, ...dualMergedIds]);
    return {
      merges,
      dualMerges,
      closes: closeClassReport(classes, constants, allMergedIds),
      hours: hoursCutReport(classes, constants, 1),
      thresholds: thresholdReport(classes, constants, 4, allMergedIds),
      noStd: noStandardReport(classes, constants, allMergedIds),
      events: eventsCapReport(expenses, expenseCategories, classes),
      top: topExpensesReport(expenses, expenseCategories),
      shabbat: jointShabbatReport(classes, constants, shabbatHours),
      caharon: caharonReport(classes, constants),
      parents: parentContributionReport(classes, parentAmount),
      partaniyot: partaniyotReport(classes, constants, partaniyotHours),
      principal: principalTeachingReport(classes, constants, principalHours),
      tuition: tuitionReport(classes, tuitionAmount, tuitionRate),
      supplement: tuitionSupplementReport(classes, supplementAmount),
    };
  }, [classes, expenses, expenseCategories, constants, shabbatHours, parentAmount, partaniyotHours, principalHours, tuitionAmount, tuitionRate, supplementAmount]);

  const totals = useMemo(
    () => calculateSchoolTotals(classes, incomeSources, expenses, constants, expenseCategories),
    [classes, incomeSources, expenses, constants, expenseCategories],
  );

  const { merges, dualMerges, closes, hours, thresholds, noStd, events, top, shabbat, caharon, parents, partaniyot, principal, tuition, supplement } = report;
  const hoursSaving = hours.perHourAllClasses * hoursCut;
  const trimSaving = Math.round(top.total * trimPct / 100);

  // ── בחירת הצעות: ✓ על כל כרטיס. null = הכל נבחר (ברירת מחדל).
  // נשמר ב-budget_approvals — אותה בחירה בדיוק שמופיעה בסיכום ואישור ובמסמך.
  const [selectedKeys, setSelectedKeys] = useState(null);
  const [savingSelection, setSavingSelection] = useState(false);

  const allKeys = useMemo(() => [
    ...merges.map(m => `merge:${m.merged.id}`),
    ...dualMerges.map(m => `dual:${m.merged.id}`),
    ...(hours.maxCut > 0 ? ['hours-cut'] : []),
    ...(partaniyot.saving > 0 ? ['partaniyot'] : []),
    ...(principal.saving > 0 ? ['principal-teaching'] : []),
    ...(shabbat.saving > 0 ? ['shabbat'] : []),
    ...closes.map(r => `close:${r.cls.id}`),
    ...thresholds.rows.map(r => `threshold:${r.cls.id}`),
    ...(tuition.gain > 0 ? ['tuition'] : []),
    ...(supplement.gain > 0 ? ['tuition-supplement'] : []),
    ...(parents.totalStudents > 0 ? ['parents'] : []),
    ...(caharon.gap > 0 ? ['caharon'] : []),
    ...(events.excess > 0 ? ['events-cap'] : []),
    ...(top.rows.length > 0 ? ['trim'] : []),
  ], [report]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSelected = (key) => selectedKeys == null || selectedKeys.has(key);
  const toggleKey = (key) => setSelectedKeys(prev => {
    const base = prev == null ? new Set(allKeys) : new Set(prev);
    if (base.has(key)) base.delete(key); else base.add(key);
    return base;
  });

  // כרטיס סף-התקן מציג כמה כיתות יחד — הסימון שולט על כולן כאחת
  const thKeys = thresholds.rows.map(r => `threshold:${r.cls.id}`);
  const thChecked = thKeys.length > 0 && thKeys.every(k => isSelected(k));
  const toggleThresholds = () => setSelectedKeys(prev => {
    const base = prev == null ? new Set(allKeys) : new Set(prev);
    if (thChecked) thKeys.forEach(k => base.delete(k));
    else thKeys.forEach(k => base.add(k));
    return base;
  });

  useEffect(() => {
    setSelectedKeys(null);
    if (!user?.schoolId || !currentYear?.id) return;
    supabase.from('budget_approvals')
      .select('selected_suggestion_keys')
      .eq('school_id', user.schoolId)
      .eq('budget_year_id', currentYear.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error(error);
        if (data?.selected_suggestion_keys) setSelectedKeys(new Set(data.selected_suggestion_keys.map(normalizeSuggestionKey)));
      });
  }, [user?.schoolId, currentYear?.id]);

  const saveSelection = async () => {
    setSavingSelection(true);
    const { data, error } = await supabase.from('budget_approvals').upsert({
      school_id: user.schoolId,
      budget_year_id: currentYear.id,
      selected_suggestion_keys: selectedKeys == null ? allKeys : [...selectedKeys],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'school_id,budget_year_id' }).select().single();
    setSavingSelection(false);
    if (isMissingTableError(error)) return notify('שמירת הבחירה עדיין לא הופעלה במוסד זה — יש לפנות לתמיכה', 'error');
    if (error || !data) return saveFailed(error);
    notify('הבחירה נשמרה ✓ — מופיעה גם בסיכום ואישור ובמסמך');
  };

  const totalPotential =
    merges.reduce((s, m) => s + (isSelected(`merge:${m.merged.id}`) ? m.delta : 0), 0) +
    dualMerges.reduce((s, m) => s + (isSelected(`dual:${m.merged.id}`) ? m.delta : 0), 0) +
    closes.reduce((s, r) => s + (isSelected(`close:${r.cls.id}`) ? r.saving : 0), 0) +
    (hours.maxCut > 0 && isSelected('hours-cut') ? hoursSaving : 0) +
    (isSelected('events-cap') ? events.excess : 0) +
    (top.rows.length > 0 && isSelected('trim') ? trimSaving : 0) +
    thresholds.rows.reduce((s, r) => s + (isSelected(`threshold:${r.cls.id}`) ? r.gain : 0), 0) +
    (isSelected('shabbat') ? shabbat.saving : 0) +
    (isSelected('caharon') ? caharon.gap : 0) +
    (isSelected('parents') ? parents.gain : 0) +
    (isSelected('partaniyot') ? partaniyot.saving : 0) +
    (isSelected('principal-teaching') ? principal.saving : 0) +
    (isSelected('tuition') ? tuition.gain : 0) +
    (isSelected('tuition-supplement') ? supplement.gain : 0);

  const deficit = totals.isDeficit ? Math.abs(totals.balance) : 0;
  const coverage = deficit > 0 ? Math.min(100, Math.round(totalPotential / deficit * 100)) : null;
  const projectedBalance = totals.balance + totalPotential;

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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-800">הצעות ייעול</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            המערכת מציעה — את בוחרת: סמני ✓ על ההצעות שמאמצים, והסכומים יתעדכנו מיד
          </p>
        </div>
        <button type="button" onClick={saveSelection} disabled={savingSelection} className="btn-primary btn-sm flex-shrink-0">
          <Save size={14} />
          שמירת הבחירה
        </button>
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">פוטנציאל ההצעות הנבחרות</p>
            <p className="text-2xl font-black bg-gradient-to-l from-purple-600 to-teal-500 bg-clip-text text-transparent">
              {formatCurrency(totalPotential)}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">שיפור אפשרי בשנה</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">מצב אחרי יישום ההצעות</p>
            <p className={`text-2xl font-black ${projectedBalance < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatCurrencyFull(projectedBalance)}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">התחשיב הסופי לפי ההצעות שסימנת</p>
          </div>
        </div>
        {coverage != null && (
          <div className="px-5 pb-5">
            <div className="flex justify-between items-baseline mb-1.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">כמה מהגירעון זה סוגר</p>
              <p className="text-sm font-black text-gray-800">{coverage}%</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-label="כמה מהגירעון זה סוגר" aria-valuenow={coverage} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gradient-to-l from-purple-500 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${coverage}%` }} />
            </div>
          </div>
        )}
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
          selected={isSelected(`merge:${m.merged.id}`)}
          onToggle={() => toggleKey(`merge:${m.merged.id}`)}
        />
      ))}

      {/* Dual-age merges */}
      {dualMerges.map(m => (
        <SuggestionCard
          key={`dual-${m.merged.id}`}
          icon={Layers}
          tone="purple"
          index={++cardIndex}
          title={m.createsStandard
            ? `יצירת תקן — חיבור ${m.members.map(x => x.name).join(' + ')}`
            : `חיבור כיתות: ${m.members.map(x => x.name).join(' + ')}`}
          subtitle={`${m.members.map(x => `${x.name} (${x.studentCount} תל׳, ${CLASS_TYPE[getClassType(x.studentCount, constants)].label})`).join(' + ')} ← כיתה אחת של ${m.merged.studentCount} תלמידים (${CLASS_TYPE[getClassType(m.merged.studentCount, constants)].label}), עם תוספת של ${DUAL_AGE_EXTRA_MONTHLY_HOURS} שעות שבועיות (שעות בודדות) לכיתה המחוברת`}
          saving={m.delta}
          details={[
            { label: 'הכנסות (משרד + תלמידים) לפני', value: formatCurrency(m.incomeBefore) },
            { label: 'הכנסות אחרי החיבור', value: formatCurrency(m.incomeAfter), tone: m.incomeAfter < m.incomeBefore ? 'red' : undefined },
            { label: 'עלות הוראה והוצאות לפני (2 כיתות)', value: formatCurrency(m.costBefore) },
            { label: `תוספת ${DUAL_AGE_EXTRA_MONTHLY_HOURS} שעות שבועיות × ${formatCurrency(constants.actualHourlyRate)} × 12`, value: formatCurrency(m.joinExtraCost) },
            { label: 'עלות אחרי החיבור — כיתה אחת + התוספת', value: formatCurrency(m.costAfter), tone: 'green' },
            { label: 'חיסכון נטו בשנה', value: formatCurrencyFull(m.delta), tone: 'green' },
          ]}
          action={{ label: 'למסך הכיתות', onClick: () => navigate('classes') }}
          selected={isSelected(`dual:${m.merged.id}`)}
          onToggle={() => toggleKey(`dual:${m.merged.id}`)}
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
          selected={isSelected('hours-cut')}
          onToggle={() => toggleKey('hours-cut')}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-teal-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">כמה שעות להוריד מכל כיתה?</span>
            <Stepper value={hoursCut} onChange={setHoursCut} min={1} max={hours.maxCut} unit="שעות" />
          </div>
        </SuggestionCard>
      )}

      {/* Partaniyot hours from teacher position */}
      {partaniyot.saving > 0 && (
        <SuggestionCard
          icon={GraduationCap}
          tone="teal"
          index={++cardIndex}
          title="שעות פרטניות מהמשרה — במקום שעות קנויות"
          subtitle={`ממשרה מלאה של ${TEACHER_POSITION_HOURS} שעות, ${partaniyot.hoursPerClass} שעות פרטניות יכולות להילמד בכיתה כשעה פרונטלית. השעות האלה כבר משולמות במשרת המורה — כל שעה כזו חוסכת שעה שנקנית בנפרד ב-${formatCurrency(partaniyot.hourlyRate)}.`}
          saving={partaniyot.saving}
          details={[
            { label: 'כיתות במערכת', value: `${partaniyot.classCount}` },
            { label: `חיסכון לכיתה — ${partaniyot.hoursPerClass} ש׳ בחודש × ${formatCurrency(partaniyot.hourlyRate)} × 12`, value: formatCurrency(partaniyot.perClassAnnual), tone: 'green' },
            { label: `${partaniyot.classCount} כיתות יחד`, value: formatCurrencyFull(partaniyot.saving), tone: 'green' },
          ]}
          selected={isSelected('partaniyot')}
          onToggle={() => toggleKey('partaniyot')}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-teal-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">שעות פרטניות שנלמדות פרונטלית, לכיתה</span>
            <Stepper value={partaniyotHours} onChange={setPartaniyotHours} min={1} max={5} unit="שעות" />
          </div>
        </SuggestionCard>
      )}

      {/* Principal teaching hours */}
      {principal.saving > 0 && (
        <SuggestionCard
          icon={UserCog}
          tone="purple"
          index={++cardIndex}
          title="שעות הוראה של המנהלת"
          subtitle={`מנהלת מלמדת בבית הספר בין 6 ל-8 שעות שבועיות בפועל. שכרה כבר משולם — כל שעה שהיא מלמדת מחליפה שעת הוראה שהייתה נקנית ב-${formatCurrency(principal.hourlyRate)} לשעה.`}
          saving={principal.saving}
          details={[
            { label: `${principal.weeklyHours} ש׳ שבועיות = ${principal.monthlyHours} ש׳ בחודש`, value: '' },
            { label: `${principal.monthlyHours} ש׳ בחודש × ${formatCurrency(principal.hourlyRate)} × 12`, value: formatCurrencyFull(principal.saving), tone: 'green' },
          ]}
          selected={isSelected('principal-teaching')}
          onToggle={() => toggleKey('principal-teaching')}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-purple-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">כמה שעות שבועיות המנהלת מלמדת?</span>
            <Stepper value={principalHours} onChange={setPrincipalHours} min={1} max={10} unit="שעות" />
          </div>
        </SuggestionCard>
      )}

      {/* Joint Kabbalat Shabbat */}
      {shabbat.saving > 0 && (
        <SuggestionCard
          icon={Flame}
          tone="gold"
          index={++cardIndex}
          title="קבלת שבת משותפת לכל הכיתות"
          subtitle={`במקום קבלת שבת נפרדת בכל כיתה — כולם יחד במליאה אחת. נחסכת שעה שבועית לכל כיתה (${shabbat.monthlyHoursPerClass} ש׳ בחודש), וגם חוויה קהילתית. עובד גם למליאות נוספות: ראש חודש, תפילה, מסיבות.`}
          saving={shabbat.saving}
          details={[
            { label: 'כיתות במערכת', value: `${shabbat.classCount}` },
            { label: `חיסכון לכיתה — ${shabbat.monthlyHoursPerClass} ש׳ בחודש × ${formatCurrency(shabbat.hourlyRate)} × 12`, value: formatCurrency(shabbat.perClassAnnual), tone: 'green' },
            { label: `${shabbat.classCount} כיתות יחד`, value: formatCurrencyFull(shabbat.saving), tone: 'green' },
          ]}
          selected={isSelected('shabbat')}
          onToggle={() => toggleKey('shabbat')}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-gold-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">כמה שעות חודשיות נחסכות לכיתה?</span>
            <Stepper value={shabbatHours} onChange={setShabbatHours} min={1} max={12} unit="שעות" />
          </div>
        </SuggestionCard>
      )}

      {/* Close a losing class — one card per candidate, she picks which */}
      {closes.map(r => (
        <SuggestionCard
          key={`close-${r.cls.id}`}
          icon={DoorClosed}
          tone="coral"
          index={++cardIndex}
          title={`סגירת כיתה ${r.cls.name}`}
          subtitle={`הכיתה הגבוהה ביותר בבית הספר, עם מספר תלמידים נמוך (${r.cls.studentCount} תל׳, ${CLASS_TYPE[r.budget.type].label}) — סגירתה חוסכת את ההפרש נטו בין העלות להכנסות. סמני ✓ רק אם מחליטים לסגור.`}
          saving={r.saving}
          savingLabel="חיסכון נטו בשנה"
          details={[
            { label: 'הוצאות שנחסכות', value: formatCurrency(r.budget.totalExpenses), tone: 'green' },
            { label: 'הכנסות שיירדו (משרד + תלמידים)', value: formatCurrency(r.budget.totalIncome), tone: 'red' },
            { label: 'חיסכון נטו', value: formatCurrencyFull(r.saving), tone: 'green' },
          ]}
          action={{ label: 'למסך הכיתות', onClick: () => navigate('classes') }}
          selected={isSelected(`close:${r.cls.id}`)}
          onToggle={() => toggleKey(`close:${r.cls.id}`)}
        />
      ))}

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
          selected={thChecked}
          onToggle={toggleThresholds}
        />
      )}

      {/* Caharon subsidized */}
      {caharon.gap > 0 && (
        <SuggestionCard
          icon={Sun}
          tone="teal"
          index={++cardIndex}
          title="הצהרון מסובסד — התאמת מחיר לעלות"
          subtitle={`כל תלמיד בצהרון עולה ${formatCurrency(caharon.expense)} בשנה ומשלם ${formatCurrency(caharon.income)} — פער של ${formatCurrency(caharon.perStudentGap)} לתלמיד שיוצא מהתקציב. התאמת המחיר לעלות סוגרת את הפער בלי לצמצם את הפעילות.`}
          saving={caharon.gap}
          savingLabel="בהתאמת מחיר מלאה"
          details={[
            { label: 'תלמידים', value: `${caharon.totalStudents}` },
            { label: 'פער לתלמיד בשנה', value: formatCurrency(caharon.perStudentGap), tone: 'red' },
            { label: `${caharon.totalStudents} תלמידים × ${formatCurrency(caharon.perStudentGap)}`, value: formatCurrencyFull(caharon.gap), tone: 'green' },
          ]}
          action={{ label: 'לעדכון בהגדרות', onClick: () => navigate('settings') }}
          selected={isSelected('caharon')}
          onToggle={() => toggleKey('caharon')}
        />
      )}

      {/* Tuition with realistic collection rate */}
      {tuition.gain > 0 && (
        <SuggestionCard
          icon={Wallet}
          tone="teal"
          index={++cardIndex}
          title="שכר לימוד עם אחוזי גבייה ריאליים"
          subtitle={`קביעת שכר לימוד של ${formatCurrency(tuition.amountPerStudent)} לתלמיד לשנה, עם ${tuition.collectionRatePct}% גבייה ריאלית (לא כולם משלמים במלואם) — ${tuition.totalStudents} תלמידים.`}
          saving={tuition.gain}
          savingLabel="הכנסה ריאלית בשנה"
          details={[
            { label: 'תלמידים בבית הספר', value: `${tuition.totalStudents}` },
            { label: `${tuition.totalStudents} × ${formatCurrency(tuition.amountPerStudent)} × ${tuition.collectionRatePct}%`, value: `+${formatCurrency(tuition.gain)}`, tone: 'green' },
          ]}
          action={{ label: 'למסך הגבייה', onClick: () => navigate('tuition') }}
          selected={isSelected('tuition')}
          onToggle={() => toggleKey('tuition')}
        >
          <div className="flex flex-col gap-3 bg-teal-50/60 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-700">שכר לימוד לתלמיד לשנה</span>
              <Stepper value={tuitionAmount} onChange={setTuitionAmount} min={500} max={10000} step={500} unit="₪" />
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-700">אחוז גבייה ריאלי</span>
              <Stepper value={tuitionRate} onChange={setTuitionRate} min={10} max={100} step={5} unit="%" />
            </div>
          </div>
        </SuggestionCard>
      )}

      {/* Tuition supplement */}
      {supplement.gain > 0 && (
        <SuggestionCard
          icon={Banknote}
          tone="purple"
          index={++cardIndex}
          title="תוספת שכר לימוד"
          subtitle={`תוספת מעל שכר הלימוד הקיים — עד 3,000 ₪ לתלמיד לשנה (כרגע ${formatCurrency(supplement.amountPerStudent)}), ${supplement.totalStudents} תלמידים, לפי ${supplement.collectionRatePct}% גבייה ריאלית.`}
          saving={supplement.gain}
          savingLabel="תוספת הכנסה בשנה"
          details={[
            { label: 'תלמידים בבית הספר', value: `${supplement.totalStudents}` },
            { label: `${supplement.totalStudents} × ${formatCurrency(supplement.amountPerStudent)} × ${supplement.collectionRatePct}%`, value: `+${formatCurrency(supplement.gain)}`, tone: 'green' },
          ]}
          action={{ label: 'למסך הגבייה', onClick: () => navigate('tuition') }}
          selected={isSelected('tuition-supplement')}
          onToggle={() => toggleKey('tuition-supplement')}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-purple-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">תוספת שכר לימוד לתלמיד לשנה (עד 3,000 ₪)</span>
            <Stepper value={supplementAmount} onChange={setSupplementAmount} min={500} max={3000} step={500} unit="₪" />
          </div>
        </SuggestionCard>
      )}

      {/* Parent contribution */}
      {parents.totalStudents > 0 && (
        <SuggestionCard
          icon={HandCoins}
          tone="green"
          index={++cardIndex}
          title="השתתפות הורים שנתית"
          subtitle={`גביית השתתפות שנתית מההורים — מעבר לשכר הלימוד ולתל"ן. כל סכום צנוע לתלמיד מצטבר לתוספת משמעותית: ${parents.totalStudents} תלמידים × ${formatCurrency(parents.amountPerStudent)}.`}
          saving={parents.gain}
          savingLabel="תוספת הכנסה בשנה"
          details={[
            { label: 'תלמידים בבית הספר', value: `${parents.totalStudents}` },
            { label: 'השתתפות לתלמיד בשנה', value: formatCurrency(parents.amountPerStudent) },
            { label: `${parents.totalStudents} × ${formatCurrency(parents.amountPerStudent)}`, value: `+${formatCurrency(parents.gain)}`, tone: 'green' },
          ]}
          action={{ label: 'למסך הגבייה', onClick: () => navigate('tuition') }}
          selected={isSelected('parents')}
          onToggle={() => toggleKey('parents')}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap bg-green-50/60 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">השתתפות לתלמיד לשנה</span>
            <Stepper value={parentAmount} onChange={setParentAmount} min={50} max={1000} step={50} unit="₪" />
          </div>
        </SuggestionCard>
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
          selected={isSelected('events-cap')}
          onToggle={() => toggleKey('events-cap')}
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
          selected={isSelected('trim')}
          onToggle={() => toggleKey('trim')}
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
      {merges.length === 0 && dualMerges.length === 0 && closes.length === 0 && hours.maxCut === 0 &&
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
