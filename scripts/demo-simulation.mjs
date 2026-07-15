// Demo data for the simulation-guide screenshots (ashkelon shell project).
//   node scripts/demo-simulation.mjs seed     — create demo classes + income + expenses
//   node scripts/demo-simulation.mjs clean    — remove everything it created
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

const CLASSES = [
  { name: 'א׳1', grade_level: 'א', student_count: 24 },
  { name: 'ב׳1', grade_level: 'ב', student_count: 22 },
  { name: 'ג׳1', grade_level: 'ג', student_count: 19 },
  { name: 'ד׳1', grade_level: 'ד', student_count: 26 },
];

if (mode === 'seed') {
  const { data: classRows, error: cErr } = await supabase.from('classes').insert(
    CLASSES.map(c => ({ ...c, school_id: school.id, budget_year_id: year.id }))
  ).select();
  if (cErr) { console.error('✗ classes:', cErr.message); process.exit(1); }

  const { error: iErr } = await supabase.from('income_sources').insert({
    school_id: school.id, budget_year_id: year.id, name: 'תרומת קרן חינוך', amount: 45000, type: 'donation',
  });
  if (iErr) { console.error('✗ income:', iErr.message); process.exit(1); }

  const { error: eErr } = await supabase.from('expenses').insert({
    school_id: school.id, budget_year_id: year.id, name: 'ביטוח מבנה', amount: 12000, period: 'yearly',
  });
  if (eErr) { console.error('✗ expenses:', eErr.message); process.exit(1); }

  console.log('seeded:', classRows.length, 'classes + 1 income source + 1 expense');
}

if (mode === 'clean') {
  await supabase.from('classes').delete().eq('school_id', school.id).in('name', CLASSES.map(c => c.name));
  await supabase.from('income_sources').delete().eq('school_id', school.id).eq('name', 'תרומת קרן חינוך');
  await supabase.from('expenses').delete().eq('school_id', school.id).eq('name', 'ביטוח מבנה');
  await supabase.from('budget_scenarios').delete().eq('school_id', school.id);
  console.log('cleaned demo data');
}
