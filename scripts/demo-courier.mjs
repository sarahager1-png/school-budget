// Demo data for courier-guide screenshots (ashkelon shell project).
//   node scripts/demo-courier.mjs seed     — create demo courier + 5 requests
//   node scripts/demo-courier.mjs clean    — remove everything it created
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

const DEMO_EMAIL = 'shaliach.demo@reshetch.org.il';

const { data: school } = await supabase.from('schools').select('id').limit(1).single();

if (mode === 'seed') {
  let userId;
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL, password: 'demo2026', email_confirm: true,
    user_metadata: { name: 'מענדי כהן' },
  });
  if (error) {
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list.users.find(u => u.email === DEMO_EMAIL)?.id;
  } else userId = created.user.id;
  await supabase.from('profiles').upsert({
    id: userId, school_id: school.id, name: 'מענדי כהן', role: 'courier', initials: 'מכ',
  });

  const REQS = [
    { name: 'קניות לחגיגת סיום שנה', amount: 1850, status: 'pending',
      notes: 'שתייה, כלים חד-פעמיים וקישוטים. עדיף במחסני השוק.' },
    { name: 'הדפסת חוברות לימוד', amount: 640, status: 'pending',
      notes: 'בדפוס אור החיים — ההזמנה כבר מוכנה על שם בית הספר.' },
    { name: 'תשלום להסעות — טיול שנתי', amount: 3200, status: 'in_progress',
      notes: 'חברת גל-נסיעות, לשלם בהעברה או צ׳ק.' },
    { name: 'ציוד יצירה לכיתות', amount: 760, status: 'paid', notes: '' },
    { name: 'מקרן לאולם', amount: 2400, status: 'completed', notes: '' },
  ];
  for (const r of REQS) {
    await supabase.from('expense_requests').insert({
      school_id: school.id, name: r.name, amount: r.amount,
      status: r.status, assigned_to: userId, notes: r.notes,
      paid_at: ['paid', 'completed'].includes(r.status) ? new Date().toISOString() : null,
      completed_at: r.status === 'completed' ? new Date().toISOString() : null,
    });
  }
  console.log('seeded: courier', userId, '+', REQS.length, 'requests');
}

if (mode === 'clean') {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const demo = list.users.find(u => u.email === DEMO_EMAIL);
  await supabase.from('expense_requests').delete().eq('school_id', school.id);
  if (demo) {
    await supabase.from('profiles').delete().eq('id', demo.id);
    await supabase.auth.admin.deleteUser(demo.id);
  }
  console.log('cleaned demo data');
}
