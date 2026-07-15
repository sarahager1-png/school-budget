// Demo data across ALL screens for the full-system guide screenshots (ashkelon shell).
//   node scripts/demo-full-system.mjs seed   — populate every table with obviously-fake demo data
//   node scripts/demo-full-system.mjs clean   — remove everything it created
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const mode = process.argv[2];
const env = Object.fromEntries(
  fs.readFileSync('.env.ashkelon.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = 'https://ogkwvrerolofujhydhsl.supabase.co';
const supabase = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: school } = await supabase.from('schools').select('id').limit(1).single();
const { data: year } = await supabase.from('budget_years').select('id').eq('school_id', school.id).eq('is_active', true).limit(1).single();

// Clean demo markers
const DEMO_CLASSES = ['א׳1', 'ב׳1', 'ג׳1', 'ד׳1'];
const DEMO_INCOME = ['תרומת קרן חינוך (דמו)', 'מענק עירייה (דמו)'];
const DEMO_EXPENSE = ['ביטוח מבנה (דמו)', 'ציוד מחשוב (דמו)', 'מסיבת חנוכה (דמו)'];
const DEMO_PAYERS = ['משפחת דמו — אבי', 'משפחת דמו — שירה', 'משפחת דמו — יוסי', 'משפחת דמו — נועה'];
const DEMO_EMPLOYEES = ['רכזת דוגמה', 'מזכירה דוגמה', 'אב בית דוגמה'];

if (mode === 'seed') {
  // 1. classes
  const { data: classRows } = await supabase.from('classes').insert(
    [
      { name: 'א׳1', grade_level: 'א', student_count: 24 },
      { name: 'ב׳1', grade_level: 'ב', student_count: 22 },
      { name: 'ג׳1', grade_level: 'ג', student_count: 19 },
      { name: 'ד׳1', grade_level: 'ד', student_count: 26 },
    ].map(c => ({ ...c, school_id: school.id, budget_year_id: year.id }))
  ).select();

  // 2. income sources
  await supabase.from('income_sources').insert([
    { name: 'תרומת קרן חינוך (דמו)', amount: 45000, type: 'donation' },
    { name: 'מענק עירייה (דמו)', amount: 28000, type: 'municipal' },
  ].map(i => ({ ...i, school_id: school.id, budget_year_id: year.id })));

  // 3. expenses (need category ids)
  const { data: cats } = await supabase.from('expense_categories').select('id, kind').eq('school_id', school.id);
  const catByKind = Object.fromEntries((cats || []).map(c => [c.kind, c.id]));
  await supabase.from('expenses').insert([
    { name: 'ביטוח מבנה (דמו)', amount: 12000, period: 'yearly', category_id: catByKind.building, status: 'approved' },
    { name: 'ציוד מחשוב (דמו)', amount: 8500, period: 'yearly', category_id: catByKind.equipment, status: 'approved' },
    { name: 'מסיבת חנוכה (דמו)', amount: 1500, period: 'monthly', category_id: catByKind.events, status: 'approved' },
  ].map(e => ({ ...e, school_id: school.id, budget_year_id: year.id })));

  // 4. tuition payers + a few payments
  const { data: payerRows } = await supabase.from('tuition_payers').insert(
    [
      { name: 'משפחת דמו — אבי', class_name: 'א׳1', amount_due: 4200 },
      { name: 'משפחת דמו — שירה', class_name: 'ב׳1', amount_due: 4200 },
      { name: 'משפחת דמו — יוסי', class_name: 'ג׳1', amount_due: 4200 },
      { name: 'משפחת דמו — נועה', class_name: 'ד׳1', amount_due: 4200 },
    ].map(p => ({ ...p, school_id: school.id, budget_year_id: year.id }))
  ).select();
  if (payerRows?.length) {
    await supabase.from('tuition_payments').insert([
      { payer_id: payerRows[0].id, amount: 4200, method: 'transfer', paid_at: '2026-09-10' },
      { payer_id: payerRows[1].id, amount: 2000, method: 'cash', paid_at: '2026-10-05' },
      { payer_id: payerRows[2].id, amount: 4200, method: 'check', paid_at: '2026-09-20' },
    ].map(p => ({ ...p, school_id: school.id })));
  }

  // 5. employees + salary payments
  const { data: empRows } = await supabase.from('employees').insert(
    [
      { name: 'רכזת דוגמה', role: 'רכזת פדגוגית', monthly_salary: 9500 },
      { name: 'מזכירה דוגמה', role: 'מזכירות', monthly_salary: 7200 },
      { name: 'אב בית דוגמה', role: 'אחזקה', monthly_salary: 6000 },
    ].map(e => ({ ...e, school_id: school.id, is_active: true }))
  ).select();
  if (empRows?.length) {
    // mark September paid for two of them
    await supabase.from('salary_payments').insert([
      { employee_id: empRows[0].id, month: '2026-09-01', amount: 9500, status: 'paid', paid_at: new Date('2026-09-30').toISOString() },
      { employee_id: empRows[1].id, month: '2026-09-01', amount: 7200, status: 'paid', paid_at: new Date('2026-09-30').toISOString() },
    ].map(p => ({ ...p, school_id: school.id })));
  }

  // 6. one saved scenario
  await supabase.from('budget_scenarios').insert({
    school_id: school.id, budget_year_id: year.id, name: 'תרחיש דמו — כיתה נוספת',
    params: { studentDelta: 3, extraClasses: 1, extraIncome: 20000, extraExpense: 0 },
  });

  console.log('seeded full-system demo:', classRows?.length, 'classes,', empRows?.length, 'employees,', payerRows?.length, 'payers');
}

if (mode === 'clean') {
  await supabase.from('tuition_payments').delete().eq('school_id', school.id);
  await supabase.from('tuition_payers').delete().eq('school_id', school.id).in('name', DEMO_PAYERS);
  await supabase.from('salary_payments').delete().eq('school_id', school.id);
  const { data: emps } = await supabase.from('employees').select('id').eq('school_id', school.id).in('name', DEMO_EMPLOYEES);
  await supabase.from('employees').delete().eq('school_id', school.id).in('name', DEMO_EMPLOYEES);
  await supabase.from('expenses').delete().eq('school_id', school.id).in('name', DEMO_EXPENSE);
  await supabase.from('income_sources').delete().eq('school_id', school.id).in('name', DEMO_INCOME);
  await supabase.from('classes').delete().eq('school_id', school.id).in('name', DEMO_CLASSES);
  await supabase.from('budget_scenarios').delete().eq('school_id', school.id);
  console.log('cleaned full-system demo data');
}
