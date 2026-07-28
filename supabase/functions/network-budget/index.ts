// מבט רשת — אגרגטור קריאה-בלבד של כל 12 מערכות התקציב עבור הפורטל
// chabad-budget-hub.surge.sh. מאובטח בקוד גישה (HUB_ACCESS_CODE) ומחזיק את
// מפתחות השירות בסוד SCHOOL_KEYS = {"<ref>":"<service key>", ...}.
// החישוב משקף אחד-לאחד את src/lib/calculations.js (שעות חודשיות × תעריף × 12).
//
// פריסה (הפונקציה יושבת בפרויקט של אשקלון; הפורטל קורא בלי JWT):
//   set SUPABASE_ACCESS_TOKEN=sbp_...
//   npx supabase functions deploy network-budget --project-ref ogkwvrerolofujhydhsl --no-verify-jwt
// בדיקה לפני פריסה:  npx deno check supabase/functions/network-budget/index.ts
//                    node scripts/verify-engine-parity.mjs

import {
  buildSuggestionRows, selectedSuggestions, sumSavings, sumClassDelta, classChangeSummary,
  normalizeSuggestionKey, planFromSnapshot, totalsFromSnapshot,
} from './budget-engine.js';

// disableClubs — בתי ספר שבהם תוספת החוגים הרשתית כבויה (VITE_DISABLE_CLUBS=1
// ב-.env של אותו בית ספר). חייב להישאר תואם, אחרת המספרים כאן לא יתאימו למערכת.
type School = { slug: string; name: string; ref: string; url: string; disableClubs?: boolean };

const SCHOOLS: School[] = [
  { slug: 'raanana', name: 'בית חינוך רעננה - בנים', ref: 'jhtajcejwxfcksvjzkzx', url: 'https://chabad-raanana-budget.surge.sh', disableClubs: true },
  { slug: 'mazkeret', name: 'שלהבות מזכרת בתיה', ref: 'njsanabfbmnaqvwraqdh', url: 'https://chabad-mazkeret-budget.surge.sh' },
  { slug: 'ashkelon', name: 'שלהבות אשקלון', ref: 'ogkwvrerolofujhydhsl', url: 'https://chabad-ashkelon-budget.surge.sh' },
  { slug: 'or-akiva', name: 'שלהבות אור עקיבא', ref: 'fqzyouwodkorgrhoulnf', url: 'https://chabad-or-akiva-budget.surge.sh' },
  { slug: 'jerusalem', name: 'שלהבות ירושלים', ref: 'yzzautohkioeikjoufpb', url: 'https://chabad-jerusalem-budget.surge.sh', disableClubs: true },
  { slug: 'kiryat-bialik', name: 'שלהבות קרית ביאליק', ref: 'qecoccsdkmunowyjzzoc', url: 'https://chabad-kiryat-bialik-budget.surge.sh' },
  { slug: 'ganei-tikva', name: 'שלהבות גני תקוה', ref: 'spvcflsbjleayhzsknph', url: 'https://chabad-ganei-tikva-budget.surge.sh' },
  { slug: 'ramat-yishai', name: 'שלהבות רמת ישי', ref: 'bvxoywkqefpnyxvjydpz', url: 'https://chabad-ramat-yishai-budget.surge.sh' },
  { slug: 'afula', name: 'בית חינוך עפולה', ref: 'inwiirkalzcbpnxngqpi', url: 'https://chabad-afula-budget.surge.sh', disableClubs: true },
  { slug: 'herzliya', name: 'שלהבות הרצליה', ref: 'qawlduxrovrodmxpehvv', url: 'https://chabad-herzliya-budget.surge.sh' },
  { slug: 'haifa', name: 'שלהבות חיפה', ref: 'ygmwcdxthcmvrdrbtwuy', url: 'https://chabad-haifa-budget.surge.sh' },
  { slug: 'raanana-girls', name: 'בית חינוך רעננה - בנות', ref: 'dqxwsovaryixondmhgyz', url: 'https://chabad-raanana-girls-budget.surge.sh' },
];

const PAYMENT_MONTHS = 12;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const annualAmount = (e: { amount: number; period: string }) =>
  e.period === 'monthly' ? Number(e.amount) * 12 : Number(e.amount);

async function fetchSchool(s: School, key: string) {
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const base = `https://${s.ref}.supabase.co/rest/v1`;
  const get = async (path: string) => {
    const r = await fetch(`${base}/${path}`, { headers: h });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  };

  const [schoolRows, years] = await Promise.all([
    get('schools?select=name,mode&limit=1'),
    get('budget_years?select=id,label,is_active'),
  ]);
  const year = years.find((y: { is_active: boolean }) => y.is_active) ?? years[0];
  if (!year) return { slug: s.slug, name: s.name, url: s.url, empty: true };

  const [classes, income, expenses, cats, constRows] = await Promise.all([
    get(`classes?budget_year_id=eq.${year.id}&select=id,name,grade_level,student_count,extra_hours`),
    get(`income_sources?budget_year_id=eq.${year.id}&select=name,amount`),
    get(`expenses?budget_year_id=eq.${year.id}&select=id,name,amount,period,category_id`),
    get('expense_categories?select=id,name,kind'),
    get(`financial_constants?budget_year_id=eq.${year.id}&select=*`),
  ]);

  // הבחירה של המנהלת בהצעות הייעול. הטבלה לא קיימת בכל המוסדות (מיגרציה v16/v18)
  // ואז נשארים בברירת המחדל של המערכת — כל ההצעות נחשבות נבחרות.
  // summary מחזיק את הסנפשוט הנעול: מרגע שהתקציב נשמר, הפורטל מציג בדיוק את
  // המספרים שנשמרו ולא מחשב מחדש — אחרת שינוי במנוע היה מזיז תקציב נעול.
  let selectedKeys: Set<string> | null = null;
  let frozenSummary: unknown = null;
  try {
    const rows = await get(`budget_approvals?budget_year_id=eq.${year.id}&select=selected_suggestion_keys,summary&limit=1`);
    const keys = rows?.[0]?.selected_suggestion_keys;
    if (Array.isArray(keys)) selectedKeys = new Set(keys.map(normalizeSuggestionKey));
    frozenSummary = rows?.[0]?.summary ?? null;
  } catch { /* טבלה שעוד לא הוקמה — ברירת מחדל */ }
  const c = constRows[0] ?? {};
  const mode = schoolRows[0]?.mode === 'simple' ? 'simple' : 'full';
  const students = classes.reduce((t: number, x: { student_count: number }) => t + x.student_count, 0);
  const additional = income.reduce((t: number, x: { amount: number }) => t + Number(x.amount || 0), 0);
  // כמו באפליקציה: שורות בקטגוריית פיתוח-מקצועי לא נספרות (מחושב פר כיתה)
  const profdevIds = new Set(cats.filter((x: { kind: string }) => x.kind === 'profdev').map((x: { id: string }) => x.id));
  const countable = expenses.filter((e: { category_id: string }) => !profdevIds.has(e.category_id));
  const manualTotal = countable.reduce((t: number, e: never) => t + annualAmount(e), 0);
  const catName = Object.fromEntries(cats.map((x: { id: string; name: string }) => [x.id, x.name]));
  const byCategory: Record<string, number> = {};
  for (const e of countable) {
    const n = catName[e.category_id] ?? 'אחר';
    byCategory[n] = (byCategory[n] ?? 0) + annualAmount(e);
  }
  const principal = expenses.find((e: { name: string }) => e.name === 'שכר מנהלת');

  if (mode === 'simple') {
    return {
      slug: s.slug, name: s.name, url: s.url, mode, yearLabel: year.label,
      students, classCount: classes.length, ofek: null,
      income: { additional, sources: income, total: additional },
      expenses: { manualTotal, byCategory, total: manualTotal },
      balance: additional - manualTotal,
      principalMonthly: principal ? Number(principal.amount) : 0,
    };
  }

  const fullTh = Number(c.full_class_student_threshold ?? 21);
  const halfTh = Number(c.half_class_student_threshold ?? 11);
  const fullH = Number(c.full_class_ministry_hours ?? 22);
  const halfH = Number(c.half_class_ministry_hours ?? 11);
  const rate = Number(c.ministry_hourly_rate ?? 400);
  const actH = Number(c.actual_weekly_hours ?? 29);
  const actRate = Number(c.actual_hourly_rate ?? 700);
  const perStudent = Number(c.income_per_student ?? 350);
  const talan = Number(c.income_per_student_talan ?? 885);
  const grant = Number(c.ministry_grant_per_student ?? 370);
  const expStudent = Number(c.expense_per_student ?? 1200);
  const profDev = Number(c.professional_dev_per_class ?? 0);

  const classRows = classes.map((cl: { name: string; student_count: number }) => {
    const type = cl.student_count >= fullTh ? 'full' : cl.student_count >= halfTh ? 'half' : 'none';
    const hours = type === 'full' ? fullH : type === 'half' ? halfH : 0;
    return { name: cl.name, students: cl.student_count, type, ministryAnnual: hours * rate * PAYMENT_MONTHS };
  });
  const ministry = classRows.reduce((t: number, x: { ministryAnnual: number }) => t + x.ministryAnnual, 0);
  const grantIncome = students * grant;
  // שכר לימוד ותל"ן — 80% גבייה ריאלית (TUITION_COLLECTION_RATE בקוד הראשי)
  const studentIncome = students * perStudent * 0.8;
  const talanIncome = students * talan * 0.8;
  const teaching = classes.length * actH * actRate * PAYMENT_MONTHS;
  // שעות בודדות הוסרו מהתחשיב (21/7) — קיימות רק כתוספת חיבור כיתות
  // מרכיב ייעוץ — שעות חודשיות לכל כיתה, נערך בהגדרות של בית הספר
  // (counseling_hours_per_class, מיגרציה v21). ברירת מחדל 2 כמו קודם.
  const counselingHours = Number(c.counseling_hours_per_class ?? 2);
  const counselingCost = classes.length * counselingHours * actRate * PAYMENT_MONTHS;
  // תוספת חוגים לכיתה לחודש × 10 חודשי פעילות. הערך נערך בהגדרות של בית הספר
  // (clubs_monthly_expense_per_class, מיגרציה v21); כל עוד לא נקבע — נשמרת
  // ההתנהגות הישנה לפי הדגל disableClubs, שמשקף את VITE_DISABLE_CLUBS.
  const clubsMonthly = c.clubs_monthly_expense_per_class != null
    ? Number(c.clubs_monthly_expense_per_class)
    : (s.disableClubs ? 0 : 2000);
  const clubsExpense = classes.length * clubsMonthly * 10;
  const studentExp = students * expStudent;
  const profDevExp = classes.length * profDev;
  const totalIncome = ministry + grantIncome + studentIncome + talanIncome + additional;
  const totalExpenses = teaching + counselingCost + clubsExpense + studentExp + profDevExp + manualTotal;
  const balance = totalIncome - totalExpenses;

  // מצב התקציב לאחר יישום הצעות הייעול שנבחרו — אותו חישוב בדיוק שרץ במערכת
  // של בית הספר (budget-engine.js הוא העתק נאמן של src/lib/efficiency.js)
  const engineConstants = {
    counselingHoursPerClass: counselingHours,
    clubsMonthlyExpensePerClass: clubsMonthly,
    fullClassStudentThreshold: fullTh,
    halfClassStudentThreshold: halfTh,
    fullClassMinistryHours: fullH,
    halfClassMinistryHours: halfH,
    ministryHourlyRate: rate,
    actualWeeklyHours: actH,
    actualHourlyRate: actRate,
    incomePerStudent: perStudent,
    incomePerStudentTalan: talan,
    expensePerStudent: expStudent,
    professionalDevPerClass: profDev,
    incomePerStudentCaharon: Number(c.income_per_student_caharon ?? 0),
    expensePerStudentCaharon: Number(c.expense_per_student_caharon ?? 0),
    ministryGrantPerStudent: grant,
    closeClassExtraGrades: c.close_class_extra_grades ? String(c.close_class_extra_grades).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
  };
  const engineClasses = classes.map((cl: { id: string; name: string; grade_level: string | null; student_count: number; extra_hours: number }) => ({
    id: cl.id, name: cl.name, gradeLevel: cl.grade_level,
    studentCount: cl.student_count, extraHours: Number(cl.extra_hours ?? 0),
  }));
  const engineExpenses = expenses.map((e: { id: string; name: string; amount: number; period: string; category_id: string }) => ({
    id: e.id, name: e.name, amount: Number(e.amount), period: e.period, categoryId: e.category_id,
  }));
  // תקציב נעול — מגישים את הסנפשוט כמות שהוא, בלי לחשב מחדש
  const frozenPlan = planFromSnapshot(frozenSummary);
  const frozenTotals = totalsFromSnapshot(frozenSummary);
  // כוונון ההצעות (hoursCut/trimPct/וכו') שהמנהלת קבעה במסך הייעול של בית
  // הספר — נשמר על אותה שורת budget_approvals. בלי זה buildSuggestionRows
  // נופל תמיד לברירות המחדל של הפונקציה ומתעלם מהכוונון בפועל.
  const draftParams = (frozenSummary as { draftParams?: Record<string, number> } | null)?.draftParams ?? {};

  let efficiency: unknown = null;
  if (frozenPlan) {
    // סנפשוט שנשמר לפני שנוספו שדות מבנה הכיתות (classDelta/kind/names) לא
    // יודע לדווח כמה כיתות נחסכות. משלימים אותם מהחישוב החי לפי המפתח —
    // הסכומים נשארים כפי שנשמרו, רק תיאור המבנה מושלם.
    const liveByKey = new Map<string, { classDelta?: number; kind?: string; names?: string[] }>();
    try {
      for (const r of buildSuggestionRows(engineClasses, engineExpenses, cats, engineConstants, draftParams)) {
        liveByKey.set(normalizeSuggestionKey(r.key), r);
      }
    } catch { /* אם החישוב החי נכשל — נשארים עם מה שיש בסנפשוט */ }
    const enrich = (r: { key: string; classDelta?: number; names?: string[] | null }) => {
      if (r.classDelta && r.names?.length) return r;
      const live = liveByKey.get(normalizeSuggestionKey(r.key));
      return live ? { ...r, classDelta: live.classDelta ?? 0, kind: live.kind, names: live.names } : r;
    };
    const selected = frozenPlan.selected.map(enrich);
    const chosenKeys = new Set(selected.map((r: { key: string }) => normalizeSuggestionKey(r.key)));
    const available = frozenPlan.suggestions.filter(
      (r: { key: string }) => !chosenKeys.has(normalizeSuggestionKey(r.key)),
    );

    efficiency = {
      total: frozenPlan.total,
      count: selected.length,
      offered: frozenPlan.suggestions.length,
      saved: true,
      locked: true,
      closedAt: frozenPlan.closedAt,
      projectedBalance: frozenPlan.projectedBalance,
      classCountAfter: frozenPlan.classCountAfter ?? (frozenTotals!.classCount + sumClassDelta(selected)),
      classChanges: classChangeSummary(selected),
      rows: selected.map((r: { label: string; saving: number; classDelta?: number }) =>
        ({ label: r.label, saving: r.saving, classDelta: r.classDelta ?? 0 })),
      // הצעות שהמערכת מציעה ולא נבחרו — הפוטנציאל שעוד לא מומש
      available: available.map((r: { label: string; saving: number }) => ({ label: r.label, saving: r.saving })),
      availableTotal: sumSavings(available),
    };
  } else {
    try {
      const allRows = buildSuggestionRows(engineClasses, engineExpenses, cats, engineConstants, draftParams);
      const chosen = selectedSuggestions(allRows, selectedKeys);
      const total = sumSavings(chosen);
      const chosenKeys = new Set(chosen.map((r: { key: string }) => r.key));
      const available = allRows.filter((r: { key: string }) => !chosenKeys.has(r.key));
      efficiency = {
        total,
        count: chosen.length,
        offered: allRows.length,
        saved: selectedKeys != null,
        locked: false,
        projectedBalance: balance + total,
        classCountAfter: classes.length + sumClassDelta(chosen),
        classChanges: classChangeSummary(chosen),
        rows: chosen.map((r: { label: string; saving: number; classDelta: number }) =>
          ({ label: r.label, saving: r.saving, classDelta: r.classDelta })),
        // הצעות שהמערכת מציעה ולא נבחרו — הפוטנציאל שעוד לא מומש
        available: available.map((r: { label: string; saving: number }) => ({ label: r.label, saving: r.saving })),
        availableTotal: sumSavings(available),
      };
    } catch (e) {
      console.error(`efficiency ${s.slug}: ${e}`);
    }
  }

  return {
    slug: s.slug, name: s.name, url: s.url, mode, yearLabel: year.label,
    students: frozenTotals ? frozenTotals.totalStudents : students,
    classCount: frozenTotals ? frozenTotals.classCount : classes.length,
    locked: frozenPlan != null,
    ofek: c.ofek_salary ?? null,
    efficiency,
    income: { ministry, grant: grantIncome, perStudent: studentIncome, talan: talanIncome, additional, sources: income, total: frozenTotals ? frozenTotals.totalIncome : totalIncome },
    expenses: { teaching, teachingMonthly: classes.length * actH * actRate, counselingCost, clubsExpense, studentExp, profDev: profDevExp, manualTotal, byCategory, total: frozenTotals ? frozenTotals.totalExpenses : totalExpenses },
    balance: frozenTotals ? frozenTotals.balance : balance,
    principalMonthly: principal ? Number(principal.amount) : 0,
    classes: classRows,
  };
}

// כניסה בלחיצה מהפורטל: מייצר קישור קסם חד-פעמי לחשבון הרשת בבית הספר המבוקש —
// שרה נכנסת למערכת המלאה בלי סיסמה (ה-redirect הולך ל-site_url של הפרויקט).
const HUB_LOGIN_EMAIL = 'data@reshetch.org.il';

async function launchLink(ref: string, key: string) {
  const r = await fetch(`https://${ref}.supabase.co/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: HUB_LOGIN_EMAIL }),
  });
  const j = await r.json();
  if (!r.ok || !j.action_link) throw new Error(`generate_link: ${r.status}`);
  return j.action_link as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const body = await req.json().catch(() => ({}));
  const { code } = body;
  const expected = Deno.env.get('HUB_ACCESS_CODE');
  if (!expected || code !== expected) return json({ error: 'unauthorized' }, 401);

  const keys = JSON.parse(Deno.env.get('SCHOOL_KEYS') ?? '{}');

  if (body.launch) {
    const s = SCHOOLS.find((x) => x.slug === body.launch);
    if (!s || !keys[s.ref]) return json({ error: 'unknown school' }, 400);
    try {
      return json({ url: await launchLink(s.ref, keys[s.ref]) });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }
  const schools = await Promise.all(
    SCHOOLS.map(async (s) => {
      try {
        if (!keys[s.ref]) return { slug: s.slug, name: s.name, url: s.url, error: 'no key' };
        return await fetchSchool(s, keys[s.ref]);
      } catch (e) {
        return { slug: s.slug, name: s.name, url: s.url, error: String(e) };
      }
    }),
  );
  return json({ generatedAt: new Date().toISOString(), schools });
});
