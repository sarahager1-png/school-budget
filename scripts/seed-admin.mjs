// Create the first admin login for a freshly-seeded school.
//
// There is no DB trigger that auto-creates a `profiles` row, so a user can't
// get past the login screen until an admin row exists. This script uses the
// service_role key to (1) create an auth user and (2) insert their profile.
//
// Usage:  node scripts/seed-admin.mjs ashkelon
//
// Reads, in order of precedence:
//   .env.<school>.local   (gitignored — put SUPABASE_SERVICE_ROLE_KEY here)
//   .env.<school>         (committed — VITE_SUPABASE_URL etc.)
//
// Optional overrides (env or .env.<school>.local):
//   ADMIN_EMAIL  ADMIN_PASSWORD  ADMIN_NAME  ADMIN_ROLE  SCHOOL_NAME
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const school = process.argv[2];
if (!school) {
  console.error('Usage: node scripts/seed-admin.mjs <school>   (e.g. ashkelon)');
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
  ...loadEnvFile(path.join(root, `.env.${school}`)),
  ...loadEnvFile(path.join(root, `.env.${school}.local`)),
  ...process.env,
};

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
const SCHOOL_NAME = env.SCHOOL_NAME || env.VITE_SCHOOL_NAME;
const ADMIN_EMAIL = env.ADMIN_EMAIL || 'data@reshetch.org.il';
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'ashkelon2026';
const ADMIN_NAME = env.ADMIN_NAME || 'מנהלת הרשת';
const ADMIN_ROLE = env.ADMIN_ROLE || 'admin';

if (!SUPABASE_URL || SUPABASE_URL.includes('__')) {
  console.error(`✗ VITE_SUPABASE_URL missing/placeholder in .env.${school}`);
  process.exit(1);
}
if (!SERVICE_ROLE) {
  console.error(`✗ SUPABASE_SERVICE_ROLE_KEY missing — add it to .env.${school}.local`);
  process.exit(1);
}

const initials = ADMIN_NAME.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Resolve school id
  const { data: schoolRow, error: schoolErr } = await supabase
    .from('schools').select('id, name').eq('name', SCHOOL_NAME).single();
  if (schoolErr || !schoolRow) {
    console.error(`✗ School "${SCHOOL_NAME}" not found. Run supabase/seed_ashkelon.sql first.`, schoolErr?.message || '');
    process.exit(1);
  }
  console.log(`• School: ${schoolRow.name} (${schoolRow.id})`);

  // 2. Create (or reuse) the auth user
  let userId;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: ADMIN_NAME },
  });
  if (createErr) {
    if (/registered|already/i.test(createErr.message)) {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      if (!existing) { console.error('✗ User exists but could not be located.'); process.exit(1); }
      userId = existing.id;
      console.log(`• Auth user already existed: ${ADMIN_EMAIL} (${userId})`);
    } else {
      console.error('✗ createUser failed:', createErr.message);
      process.exit(1);
    }
  } else {
    userId = created.user.id;
    console.log(`• Created auth user: ${ADMIN_EMAIL} (${userId})`);
  }

  // 3. Upsert the profile
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    school_id: schoolRow.id,
    name: ADMIN_NAME,
    role: ADMIN_ROLE,
    initials,
  });
  if (profileErr) { console.error('✗ profile upsert failed:', profileErr.message); process.exit(1); }

  console.log('\n✓ Done. Login:');
  console.log(`   email:    ${ADMIN_EMAIL}`);
  console.log(`   password: ${ADMIN_PASSWORD}`);
  console.log(`   role:     ${ADMIN_ROLE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
