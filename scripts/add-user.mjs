// Add a user (principal / courier / admin) to an existing school.
//   node scripts/add-user.mjs <slug> <email> "<שם מלא>" [principal|courier|admin] [password]
// Default role: principal. Default password: random (printed).
// Requires .env.<slug>.local with SUPABASE_SERVICE_ROLE_KEY (written by add-school).
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const [slug, email, fullName, role = 'principal', passwordArg] = process.argv.slice(2);
if (!slug || !email || !fullName) {
  console.error('Usage: node scripts/add-user.mjs <slug> <email> "<שם מלא>" [principal|courier|admin] [password]');
  process.exit(1);
}
if (!['principal', 'courier', 'admin'].includes(role)) {
  console.error('role חייב להיות principal / courier / admin');
  process.exit(1);
}

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

const root = process.cwd();
const env = {
  ...loadEnvFile(path.join(root, `.env.${slug}`)),
  ...loadEnvFile(path.join(root, `.env.${slug}.local`)),
};
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`✗ חסר .env.${slug} / .env.${slug}.local עם URL ו-service_role`);
  process.exit(1);
}

const password = passwordArg || crypto.randomBytes(6).toString('base64url');
const initials = fullName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('');
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: school, error: sErr } = await supabase.from('schools').select('id, name').limit(1).single();
if (sErr || !school) { console.error('✗ לא נמצא בית ספר ב-DB:', sErr?.message); process.exit(1); }

let userId;
const { data: created, error: cErr } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { name: fullName },
});
if (cErr) {
  if (/registered|already/i.test(cErr.message)) {
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) { console.error('✗ המשתמש קיים אך לא אותר'); process.exit(1); }
    console.log('• משתמש קיים — מעדכן פרופיל בלבד (הסיסמה לא שונתה)');
  } else {
    console.error('✗ יצירת משתמש נכשלה:', cErr.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
}

const { error: pErr } = await supabase.from('profiles').upsert({
  id: userId, school_id: school.id, name: fullName, role, initials,
});
if (pErr) { console.error('✗ פרופיל נכשל:', pErr.message); process.exit(1); }

console.log(`\n✓ ${fullName} נוספ/ה ל"${school.name}" בתפקיד ${role}`);
console.log(`   email:    ${email}`);
if (!cErr) console.log(`   password: ${password}`);
console.log('   (בכניסה עם Google באותו אימייל — אין צורך בסיסמה)');
