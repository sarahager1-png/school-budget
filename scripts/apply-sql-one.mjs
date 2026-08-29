// מחיל קובצי SQL על בית ספר אחד לפי slug (משלים את apply-migrations-all.mjs,
// שמחיל על כולם). נחוץ למיגרציות פר-בית-ספר כמו v24 (מזכרת בתיה בלבד).
//
//   set SUPABASE_ACCESS_TOKEN=sbp_...
//   node scripts/apply-sql-one.mjs mazkeret supabase/migration_v24_mazkeret_courier_full_edit.sql
import fs from 'fs';
import path from 'path';

const [slug, ...files] = process.argv.slice(2);
if (!slug || files.length === 0) {
  console.error('Usage: node scripts/apply-sql-one.mjs <slug> <file.sql> [...]');
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('✗ חסר SUPABASE_ACCESS_TOKEN. הריצי קודם:  set SUPABASE_ACCESS_TOKEN=sbp_...');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync('schools.config.json', 'utf8'));
const school = cfg.schools.find(s => s.slug === slug);
if (!school) {
  console.error(`✗ בית ספר "${slug}" לא נמצא. קיימים: ${cfg.schools.map(s => s.slug).join(', ')}`);
  process.exit(1);
}

console.log(`${school.name} (${school.slug}) — ${school.ref}`);
let failures = 0;
for (const f of files) {
  const sql = fs.readFileSync(f, 'utf8');
  const res = await fetch(`https://api.supabase.com/v1/projects/${school.ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (res.ok) {
    console.log(`   ✓ ${path.basename(f)}`);
  } else {
    failures++;
    console.log(`   ✗ ${path.basename(f)} — HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
process.exit(failures === 0 ? 0 : 1);
