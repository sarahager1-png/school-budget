// מחיל קובצי SQL על כל בתי הספר שב-schools.config.json בבת אחת.
//
//   set SUPABASE_ACCESS_TOKEN=sbp_...
//   node scripts/apply-migrations-all.mjs supabase/migration_v21_counseling_hours.sql supabase/migration_v20_freeze_closed_year.sql
//
// בלי ארגומנטים — מחיל את שתי המיגרציות האחרונות לפי הסדר הנכון.
// הרצה חוזרת בטוחה: כל ההצהרות הן IF NOT EXISTS / CREATE OR REPLACE.
import fs from 'fs';
import path from 'path';

const DEFAULT_FILES = [
  'supabase/migration_v21_counseling_hours.sql',
  'supabase/migration_v20_freeze_closed_year.sql',
];

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('✗ חסר SUPABASE_ACCESS_TOKEN. הריצי קודם:  set SUPABASE_ACCESS_TOKEN=sbp_...');
  process.exit(1);
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;
for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`✗ לא נמצא הקובץ ${f}`); process.exit(1); }
}

const cfg = JSON.parse(fs.readFileSync('schools.config.json', 'utf8'));
const sqls = files.map(f => ({ name: path.basename(f), sql: fs.readFileSync(f, 'utf8') }));

let failures = 0;
for (const school of cfg.schools) {
  process.stdout.write(`\n${school.name} (${school.slug})\n`);
  for (const { name, sql } of sqls) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${school.ref}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      });
      if (res.ok) {
        console.log(`   ✓ ${name}`);
      } else {
        failures++;
        console.log(`   ✗ ${name} — HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
    } catch (e) {
      failures++;
      console.log(`   ✗ ${name} — ${e.message}`);
    }
  }
}

console.log(failures === 0
  ? `\n✓ הכול הוחל בהצלחה על ${cfg.schools.length} בתי ספר.`
  : `\n✗ ${failures} כשלונות — ר' הפירוט למעלה.`);
process.exit(failures === 0 ? 0 : 1);
