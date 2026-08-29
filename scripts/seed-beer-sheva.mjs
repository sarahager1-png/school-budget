// ============================================================
// הזנת הנתונים של שלהבות באר שבע — כדי שתעבוד כמו שאר בתי הספר.
//
//   node scripts/seed-beer-sheva.mjs            — דוח בלבד: מה ייכתב
//   node scripts/seed-beer-sheva.mjs --apply    — כותב בפועל
//
// המקור: הסימולטור של באר שבע (beer-sheva-school-budget.sarahager1.chatgpt.site)
// שממנו נלקחו מספר התלמידים, שעות הכיתה, ההסעות, השיווק והשכר. מה שאין בו —
// חלוקת התלמידים לכיתות — יושב ב-ROSTER למטה וחייב להיות מאושר לפני הרצה.
//
// הכתיבה היא לשנת תשפ"ז, והיא גם הופכת אותה לשנה הפעילה (היום הפעילה היא
// תשפ"ו, בניגוד לכל שאר בתי הספר).
// ============================================================
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const apply = process.argv.includes('--apply');
// --partial: הכול חוץ מהכיתות ומהחלפת השנה הפעילה. מיועד לשלב שבו חלוקת
// התלמידים לכיתות עדיין לא ידועה — מה שנכתב יושב בשנה שאינה פעילה ולכן
// אינו משנה דבר במסך של המנהלת.
const partial = process.argv.includes('--partial');

// ── מה שמוזן ──────────────────────────────────────────────
// באר שבע אינה מתוקצבת לפי מספר תלמידים בכיתה: חלק משעות ההוראה ממומנות
// ע"י משרד החינוך והשאר ע"י העמותה. לכן היא עוברת ל"מעקב פשוט" — סכומים
// כלל-בית-ספריים בלבד, בלי כיתות ובלי חישוב לפי תלמיד (הכרעת שרה 29.8.2026).
const SIMPLE_MODE = true;
const ROSTER = [];

// קבועים לשנת תשפ"ז, לפי הסימולטור ולפי מה שכבר רשום בתשפ"ו
const CONSTANTS = {
  actual_weekly_hours: 38,        // שעות הוראה לכיתה בחודש (בסימולטור: 38)
  actual_hourly_rate: 700,        // שווי שעה
  ministry_hourly_rate: 400,
  full_class_ministry_hours: 22,
  half_class_ministry_hours: 11,
  full_class_student_threshold: 21,   // סף התקן — זהה בסימולטור ובמסד
  half_class_student_threshold: 11,
  income_per_student: 350,
  income_per_student_talan: 885,
  expense_per_student: 1200,
  ministry_grant_per_student: 370,
  professional_dev_per_class: 0,
  counseling_hours_per_class: 0,
  clubs_monthly_expense_per_class: 0,
  principal_monthly_salary: 27000,
};

// הוצאות והכנסות כלל-בית-ספריות מהסימולטור. שכר המנהלת (₪27,000 לחודש)
// כבר קיים במסד ואינו נכתב כאן שוב.
const EXPENSES = [
  { name: 'הסעות', amount: 240 * 65, period: 'monthly', kind: 'other' },
  { name: 'שיווק', amount: 20000, period: 'yearly', kind: 'other' },
  { name: 'שכר עדי', amount: 7000, period: 'monthly', kind: 'salary' },
  { name: 'שעות נוספות — עדי', amount: 8 * 700, period: 'monthly', kind: 'salary' },
  { name: 'הוראה שאינה מתוקצבת (38 ש׳ × ₪700 × 12)', amount: 38 * 700 * 12, period: 'yearly', kind: 'salary' },
  { name: 'הוצאות שוטפות לתלמידים', amount: 78000, period: 'yearly', kind: 'other' },
];

// במעקב פשוט אין חישוב לפי תלמיד — ההכנסות נרשמות כסכומים
const INCOME = [
  { name: 'תל"ן — תשלומי הורים', amount: 57525 },
];

// ── ריצה ──────────────────────────────────────────────────
const envf = (f) => Object.fromEntries(fs.readFileSync(path.join(root, f), 'utf8')
  .split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const env = envf('.env.beer-sheva');
const local = envf('.env.beer-sheva.local');
const db = createClient(env.VITE_SUPABASE_URL, local.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: school } = await db.from('schools').select('id,name').limit(1).single();
const { data: years } = await db.from('budget_years').select('id,label,year,is_active');
const target = years.find(y => y.year === 2026);
if (!target) { console.error('✗ שנת תשפ"ז לא קיימת'); process.exit(1); }

const { data: cats } = await db.from('expense_categories').select('id,name,kind');
const catId = (kind) => cats.find(c => c.kind === kind)?.id ?? cats.find(c => c.kind === 'other')?.id;

const students = ROSTER.reduce((n, c) => n + c.studentCount, 0);
console.log(`\n${school.name} → ${target.label}`);
console.log(`  כיתות: ${ROSTER.length}  ·  תלמידים: ${students}`);
for (const c of ROSTER) console.log(`    ${c.name} (שכבה ${c.gradeLevel}) — ${c.studentCount}`);
console.log(`  הוצאות שייווספו: ${EXPENSES.map(e => `${e.name} ${e.amount}${e.period === 'monthly' ? '/ח׳' : ''}`).join(' · ')}`);
console.log(`  קבועים: ${CONSTANTS.actual_weekly_hours} ש׳ · ₪${CONSTANTS.actual_hourly_rate} לשעה · סף תקן ${CONSTANTS.full_class_student_threshold}`);
console.log(`  הכנסות: ${INCOME.map(i => `${i.name} ${i.amount}`).join(' · ') || '—'}`);
console.log(`  מצב המוסד: ${SIMPLE_MODE ? 'מעקב פשוט (בלי כיתות)' : 'מלא'}`);
console.log(`  השנה הפעילה תשתנה ל-${target.label}`);

if (!ROSTER.length && !partial && !SIMPLE_MODE) {
  console.log('\n✗ ROSTER ריק — חלוקת התלמידים לכיתות חייבת להיקבע לפני ההרצה.');
  process.exit(1);
}
if (!apply) { console.log('\n(דוח בלבד — להרצה: node scripts/seed-beer-sheva.mjs --apply)'); process.exit(0); }

// קבועים
const { data: existing } = await db.from('financial_constants').select('id').eq('budget_year_id', target.id).maybeSingle();
const constPayload = { ...CONSTANTS, school_id: school.id, budget_year_id: target.id, updated_at: new Date().toISOString() };
const r1 = existing
  ? await db.from('financial_constants').update(constPayload).eq('id', existing.id)
  : await db.from('financial_constants').insert(constPayload);
console.log(r1.error ? `✗ קבועים: ${r1.error.message}` : '✓ קבועים');

// כיתות
for (const c of (partial ? [] : ROSTER)) {
  const { error } = await db.from('classes').insert({
    school_id: school.id, budget_year_id: target.id,
    name: c.name, grade_level: c.gradeLevel, student_count: c.studentCount, extra_hours: 0,
  });
  console.log(error ? `✗ ${c.name}: ${error.message}` : `✓ ${c.name}`);
}

// הוצאות
const { data: already } = await db.from('expenses').select('name').eq('budget_year_id', target.id);
const has = new Set((already || []).map(x => x.name));
for (const e of EXPENSES) {
  if (has.has(e.name)) { console.log(`· ${e.name} — כבר קיים`); continue; }
  const { error } = await db.from('expenses').insert({
    school_id: school.id, budget_year_id: target.id,
    name: e.name, amount: e.amount, period: e.period, category_id: catId(e.kind),
  });
  console.log(error ? `✗ ${e.name}: ${error.message}` : `✓ ${e.name}`);
}

// שכר המנהלת קיים בתשפ"ו בלבד — מועתק לשנה החדשה
const { data: principal } = await db.from('expenses').select('*').eq('name', 'שכר מנהלת').limit(1).maybeSingle();
if (principal && principal.budget_year_id !== target.id && !has.has('שכר מנהלת')) {
  const { error } = await db.from('expenses').insert({
    school_id: school.id, budget_year_id: target.id,
    name: 'שכר מנהלת', amount: principal.amount, period: principal.period, category_id: principal.category_id,
  });
  console.log(error ? `✗ שכר מנהלת: ${error.message}` : '✓ שכר מנהלת הועתק לתשפ"ז');
}

// הכנסות
for (const i of INCOME) {
  const { error } = await db.from('income_sources').insert({
    school_id: school.id, budget_year_id: target.id, name: i.name, amount: i.amount,
  });
  console.log(error ? `✗ ${i.name}: ${error.message}` : `✓ ${i.name}`);
}

// מעקב פשוט — בלי כיתות ובלי חישוב לפי תלמיד
if (SIMPLE_MODE && !partial) {
  const { error } = await db.from('schools').update({ mode: 'simple' }).eq('id', school.id);
  console.log(error ? `✗ מעקב פשוט: ${error.message}` : '✓ המוסד הועבר ל"מעקב פשוט"');
}

// השנה הפעילה — מוחלפת רק כשהכיתות כבר בפנים
if (partial) {
  console.log('\n(--partial: הכיתות והשנה הפעילה לא נגעו — תשפ"ז נשארת לא פעילה עד שיוזנו הכיתות.)');
  process.exit(0);
}
await db.from('budget_years').update({ is_active: false }).eq('school_id', school.id);
const { error: yerr } = await db.from('budget_years').update({ is_active: true }).eq('id', target.id);
console.log(yerr ? `✗ שנה פעילה: ${yerr.message}` : `✓ ${target.label} היא השנה הפעילה`);

console.log('\nלבניית המסמך:  node scripts/build-school-report.mjs beer-sheva');
