// ============================================================
// הקמת בית ספר חדש מא' ועד ת' — פקודה אחת:
//
//   node scripts/add-school.mjs "<שם בית הספר>" <slug> [--mode simple] [--password <סיסמה>]
//
// דוגמה:
//   set SUPABASE_ACCESS_TOKEN=sbp_...
//   node scripts/add-school.mjs "שלהבות נתניה" netanya
//
// מה הסקריפט עושה:
//   1. יוצר פרויקט Supabase חדש בארגון (schools.config.json)
//   2. ממתין שהפרויקט יעלה, שולף מפתחות
//   3. מריץ את הסכימה + כל המיגרציות + seed (בית ספר, שנים, קטגוריות)
//   4. כותב .env.<slug> (ל-git) ו-.env.<slug>.local (סודות, לא ל-git)
//   5. יוצר משתמשת אדמין ראשונה (data@reshetch.org.il / <slug>2026)
//   6. רושם את בית הספר ב-schools.config.json
//
// ואז נשאר רק:  node scripts/deploy.mjs <slug>
// ============================================================
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const API = 'https://api.supabase.com/v1';
const root = process.cwd();
const configPath = path.join(root, 'schools.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// ── args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const name = args[0];
const slug = args[1];
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'full';
const adminPassword = args.includes('--password') ? args[args.indexOf('--password') + 1] : `${slug}2026`;

if (!name || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: node scripts/add-school.mjs "<שם בית הספר>" <slug-באנגלית> [--mode simple]');
  process.exit(1);
}
if (!['full', 'simple'].includes(mode)) {
  console.error('--mode חייב להיות full או simple');
  process.exit(1);
}
if (config.schools.some(s => s.slug === slug)) {
  console.error(`✗ בית ספר עם slug "${slug}" כבר קיים ב-schools.config.json`);
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN
  || (process.env.SUPABASE_TOKEN_FILE && fs.readFileSync(process.env.SUPABASE_TOKEN_FILE, 'utf8').trim());
if (!token) {
  console.error('✗ חסר SUPABASE_ACCESS_TOKEN (או SUPABASE_TOKEN_FILE) בסביבה');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function api(method, url, body) {
  const res = await fetch(`${API}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function runSql(ref, query, label) {
  const res = await fetch(`${API}/projects/${ref}/database/query`, {
    method: 'POST', headers, body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${label} נכשל — HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  console.log(`   ✓ ${label}`);
}

// שנת לימודים נוכחית: ספטמבר→אוגוסט
function currentSchoolYear() {
  const now = new Date();
  return now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

function hebrewYearLabel(gregYear) {
  const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];
  let n = gregYear + 3761 - 5000;
  let s = '';
  while (n >= 400) { s += 'ת'; n -= 400; }
  s += HUNDREDS[Math.floor(n / 100)];
  n %= 100;
  if (n === 15) { s += 'טו'; n = 0; }
  else if (n === 16) { s += 'טז'; n = 0; }
  else { s += TENS[Math.floor(n / 10)]; n %= 10; s += ONES[n]; }
  if (s.length >= 2) s = s.slice(0, -1) + '"' + s.slice(-1);
  return s;
}

function seedSql(schoolName, schoolMode) {
  const y1 = currentSchoolYear();
  const y2 = y1 + 1;
  const esc = (t) => t.replace(/'/g, "''");
  return `
DO $$
DECLARE
  v_school UUID;
  v_y1 UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM schools WHERE name = '${esc(schoolName)}') THEN
    RAISE NOTICE 'school already exists — skipping seed.';
    RETURN;
  END IF;

  INSERT INTO schools (name, mode) VALUES ('${esc(schoolName)}', '${schoolMode}') RETURNING id INTO v_school;

  INSERT INTO budget_years (school_id, year, label, start_date, end_date, is_active, status)
  VALUES (v_school, ${y1}, 'שנת ${hebrewYearLabel(y1)} (${y1}-${y1 + 1})', '${y1}-09-01', '${y1 + 1}-08-31', true, 'active')
  RETURNING id INTO v_y1;

  INSERT INTO budget_years (school_id, year, label, start_date, end_date, is_active, status)
  VALUES (v_school, ${y2}, 'שנת ${hebrewYearLabel(y2)} (${y2}-${y2 + 1})', '${y2}-09-01', '${y2 + 1}-08-31', false, 'active');

  INSERT INTO financial_constants (school_id, budget_year_id) VALUES (v_school, v_y1);

  INSERT INTO expense_categories (school_id, name, color, kind, sort_order) VALUES
    (v_school, 'שכר',                '#7c3aed', 'salary',    1),
    (v_school, 'בניין ותחזוקה',      '#0ea5e9', 'building',  2),
    (v_school, 'פעילויות ואירועים',  '#ec4899', 'events',    3),
    (v_school, 'ציוד ותשתיות',       '#f59e0b', 'equipment', 4),
    (v_school, 'פיתוח מקצועי',       '#6366f1', 'profdev',   5),
    (v_school, 'אחר',                '#64748b', 'other',     6);
END $$;`;
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  console.log(`\n🏫 מקים את "${name}" (${slug}) במצב ${mode === 'simple' ? 'מעקב פשוט' : 'תקציב מלא'}...\n`);

  // 1. Create project
  console.log('1) יצירת פרויקט Supabase...');
  const dbPass = crypto.randomBytes(18).toString('base64url');
  const project = await api('POST', '/projects', {
    organization_id: config.supabaseOrg,
    name: `budget-${slug}`,
    region: config.region,
    db_pass: dbPass,
  });
  const ref = project.id;
  console.log(`   ✓ פרויקט נוצר: ${ref}`);

  // 2. Wait for it to come up
  console.log('2) ממתין שהפרויקט יעלה (בד"כ 1-2 דקות)...');
  for (let i = 0; i < 60; i++) {
    await sleep(10000);
    const p = await api('GET', `/projects/${ref}`);
    if (p.status === 'ACTIVE_HEALTHY') break;
    if (i === 59) throw new Error('הפרויקט לא עלה אחרי 10 דקות — בדקי ב-dashboard של Supabase');
    process.stdout.write('.');
  }
  console.log('\n   ✓ הפרויקט פעיל');

  // 3. API keys
  console.log('3) שולף מפתחות...');
  const keys = await api('GET', `/projects/${ref}/api-keys`);
  const anonKey = keys.find(k => k.name === 'anon')?.api_key;
  const serviceKey = keys.find(k => k.name === 'service_role')?.api_key;
  if (!anonKey || !serviceKey) throw new Error('לא נמצאו מפתחות anon/service_role');
  console.log('   ✓ מפתחות התקבלו');

  // 4. Schema + migrations + seed
  console.log('4) מריץ סכימה ומיגרציות...');
  const sqlFiles = [
    'supabase/schema.sql',
    'supabase/migration_add_constants_cols.sql',
    'supabase/migration_salaries.sql',
    'supabase/migration_v2_kind_mode.sql',
  ];
  for (const f of sqlFiles) {
    let sql = fs.readFileSync(path.join(root, f), 'utf8');
    sql = sql.replace(/CREATE POLICY IF NOT EXISTS/g, 'CREATE POLICY');
    await runSql(ref, sql, f.split('/').pop());
  }
  await runSql(ref, seedSql(name, mode), 'seed (בית ספר + שנים + קטגוריות)');

  // 5. env files
  console.log('5) כותב קבצי env...');
  const surge = `chabad-${slug}-budget.surge.sh`;
  fs.writeFileSync(path.join(root, `.env.${slug}`),
`# ${name} — build config (loaded by \`vite build --mode ${slug}\`)
VITE_SUPABASE_URL=https://${ref}.supabase.co
VITE_SUPABASE_ANON_KEY=${anonKey}
VITE_SCHOOL_NAME=${name}
`);
  fs.writeFileSync(path.join(root, `.env.${slug}.local`),
`# סודות ${name} — לא נכנס ל-git
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}
ADMIN_EMAIL=data@reshetch.org.il
ADMIN_PASSWORD=${adminPassword}
SCHOOL_NAME=${name}
`);
  console.log(`   ✓ .env.${slug} + .env.${slug}.local`);

  // 6. Admin user
  console.log('6) יוצר משתמשת אדמין ראשונה...');
  execSync(`node scripts/seed-admin.mjs ${slug}`, { stdio: 'inherit' });

  // 7. Register in config
  config.schools.push({ slug, name, ref, surge, mode });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('7) ✓ נרשם ב-schools.config.json');

  console.log(`\n🎉 ${name} מוכן!`);
  console.log(`   פריסה:   node scripts/deploy.mjs ${slug}`);
  console.log(`   כתובת:   https://${surge}`);
  console.log(`   כניסה:   data@reshetch.org.il / ${adminPassword}`);
}

main().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
