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
  { slug: 'beer-sheva', name: 'שלהבות באר שבע', ref: 'xkhlvlrjcpvthmcmpokj', url: 'https://chabad-beer-sheva-budget.surge.sh' },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let approvalRow: any = null;
  try {
    const rows = await get(`budget_approvals?budget_year_id=eq.${year.id}&select=selected_suggestion_keys,summary,notes,principal_name,courier_name&limit=1`);
    approvalRow = rows?.[0] ?? null;
    const keys = approvalRow?.selected_suggestion_keys;
    if (Array.isArray(keys)) selectedKeys = new Set(keys.map(normalizeSuggestionKey));
    frozenSummary = approvalRow?.summary ?? null;
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
    // הנתונים הגולמיים למסמך המרכז שבפורטל. ההמרה למבנה שהמסמך עובד איתו
    // נעשית בדפדפן (report-data.mjs), כדי שלא יהיו כאן שתי המרות נפרדות.
    raw: {
      yearId: year.id,
      disableClubs: s.disableClubs === true,
      classes, income, expenses, categories: cats, constants: c,
      notes: approvalRow?.notes ?? '',
      selectedKeys: approvalRow?.selected_suggestion_keys ?? null,
      draftParams: draftParams,
      principalName: approvalRow?.principal_name ?? '',
      courierName: approvalRow?.courier_name ?? '',
    },
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

// ── המסמך המרכז שבפורטל ─────────────────────────────────────
// תרחיש = עותק עבודה של ההנהלה. הוא נשמר בפרויקט שבו יושבת הפונקציה
// (טבלת hub_scenarios) ואינו נוגע בנתוני בית הספר. רק "החלה על המערכת"
// כותבת בפועל, ורק את מה שנשלח במפורש.
const HUB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const HUB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function hubRest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${HUB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}`,
      'content-type': 'application/json', ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`hub ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : await r.json();
}

async function scenarioGet(slug: string) {
  try {
    const rows = await hubRest(`hub_scenarios?slug=eq.${slug}&select=state,updated_at&limit=1`);
    return rows?.[0] ?? null;
  } catch { return null; }   // הטבלה עוד לא הוקמה — הפורטל ימשיך בלי תרחיש שמור
}

async function scenarioSave(slug: string, state: unknown) {
  await hubRest('hub_scenarios', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ slug, state, updated_at: new Date().toISOString() }),
  });
  return true;
}

// שדות בסיס החישוב שההחלה רשאית לכתוב. כל שדה אחר בקבועים לא נגע.
const BASIS_COLUMNS: Record<string, string> = {
  actualHourlyRate: 'actual_hourly_rate',
  actualWeeklyHours: 'actual_weekly_hours',
  ministryHourlyRate: 'ministry_hourly_rate',
  fullClassStudentThreshold: 'full_class_student_threshold',
  halfClassStudentThreshold: 'half_class_student_threshold',
  ministryGrantPerStudent: 'ministry_grant_per_student',
  incomePerStudent: 'income_per_student',
  incomePerStudentTalan: 'income_per_student_talan',
  expensePerStudent: 'expense_per_student',
  counselingHoursPerClass: 'counseling_hours_per_class',
  clubsMonthlyExpensePerClass: 'clubs_monthly_expense_per_class',
  professionalDevPerClass: 'professional_dev_per_class',
};

// deno-lint-ignore no-explicit-any
async function applyToSchool(ref: string, key: string, state: any) {
  const base = `https://${ref}.supabase.co/rest/v1`;
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const call = async (path: string, init: RequestInit) => {
    const r = await fetch(`${base}/${path}`, { ...init, headers: { ...h, ...(init.headers ?? {}) } });
    if (!r.ok) throw new Error(`${path}: ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r;
  };
  const yearId = state.yearId;
  if (!yearId) throw new Error('חסרה שנת תקציב');
  const schools = await (await fetch(`${base}/schools?select=id&limit=1`, { headers: h })).json();
  const schoolId = schools?.[0]?.id;
  if (!schoolId) throw new Error('לא נמצא בית הספר');

  const counts = { updated: 0, inserted: 0, deleted: 0 };
  const patch = async (table: string, id: string, body: unknown) => {
    await call(`${table}?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    counts.updated++;
  };
  const insert = async (table: string, body: Record<string, unknown>) => {
    await call(table, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...body, school_id: schoolId, budget_year_id: yearId }) });
    counts.inserted++;
  };
  const remove = async (table: string, ids: string[]) => {
    for (const id of ids ?? []) {
      await call(`${table}?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      counts.deleted++;
    }
  };

  // deno-lint-ignore no-explicit-any
  for (const c of state.classes ?? []) {
    const body = { name: c.name, grade_level: c.gradeLevel || null, student_count: Number(c.studentCount) || 0 };
    if (c.id) await patch('classes', c.id, body); else await insert('classes', body);
  }
  // deno-lint-ignore no-explicit-any
  for (const s of state.incomeSources ?? []) {
    const body = { name: s.name, amount: Number(s.amount) || 0 };
    if (s.id) await patch('income_sources', s.id, body); else await insert('income_sources', body);
  }
  // deno-lint-ignore no-explicit-any
  for (const e of state.expenses ?? []) {
    const body = { name: e.name, amount: Number(e.amount) || 0, period: e.period || 'yearly', category_id: e.categoryId ?? null };
    if (e.id) await patch('expenses', e.id, body); else await insert('expenses', body);
  }
  await remove('classes', state.removed?.classes);
  await remove('income_sources', state.removed?.income);
  await remove('expenses', state.removed?.expenses);

  if (state.constants) {
    const body: Record<string, unknown> = {};
    for (const [camel, col] of Object.entries(BASIS_COLUMNS)) {
      if (state.constants[camel] != null) body[col] = state.constants[camel];
    }
    if (Object.keys(body).length) {
      await call(`financial_constants?budget_year_id=eq.${yearId}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
      });
      counts.updated++;
    }
  }
  return { ok: true, ...counts };
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
  // המסמך המרכז: קריאת תרחיש, שמירתו, והחלה מבוקרת על מערכת בית הספר
  if (body.action) {
    const s = SCHOOLS.find((x) => x.slug === body.slug);
    if (!s) return json({ error: 'unknown school' }, 400);
    try {
      if (body.action === 'scenario:get') return json({ scenario: await scenarioGet(s.slug) });
      if (body.action === 'scenario:save') return json({ ok: await scenarioSave(s.slug, body.state) });
      if (body.action === 'scenario:apply') {
        if (!keys[s.ref]) return json({ error: 'no key' }, 400);
        return json(await applyToSchool(s.ref, keys[s.ref], body.state));
      }
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
    return json({ error: 'unknown action' }, 400);
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
