// מריץ קובצי SQL על מסדי בתי הספר דרך ה-CLI המחובר של Supabase
// (supabase link + supabase db query --linked), בלי טוקן ידני.
//
//   node scripts/apply-via-cli.mjs supabase/migration_v25_ofek_mix.sql supabase/migration_v26_never_lock.sql
//   node scripts/apply-via-cli.mjs --only ashkelon supabase/migration_v27_hub_scenarios.sql
//   node scripts/apply-via-cli.mjs --check      — בדיקת חיבור בלבד (select 1), בלי לשנות דבר
//
// הקישור נעשה בתיקיית עבודה זמנית ולא נוגע בריפו. הרצה חוזרת בטוחה כל עוד
// הקבצים עצמם idempotent (IF NOT EXISTS / CREATE OR REPLACE).
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const root = process.cwd();
const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx === -1 ? null : args[onlyIdx + 1];
const check = args.includes('--check');
// כשאין --only הערך onlyIdx הוא 1-, ולכן חובה לבדוק אותו לפני ההשוואה —
// אחרת התנאי מפיל בשקט את הקובץ הראשון ברשימה.
const files = args.filter((a, i) => !a.startsWith('--') && (onlyIdx === -1 || i !== onlyIdx + 1));
if (!files.length && !check) {
  console.error('שימוש: node scripts/apply-via-cli.mjs [--only <slug>] <file.sql> [...]');
  process.exit(1);
}
for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`✗ לא נמצא ${f}`); process.exit(1); }
}

const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));
const targets = only ? config.schools.filter(s => s.slug === only) : config.schools;
if (!targets.length) { console.error(`✗ אין בית ספר בשם ${only}`); process.exit(1); }

// תיקיית עבודה ל-CLI — link כותב אליה, ולכן היא מחוץ לריפו
const work = path.join(os.tmpdir(), 'sb-apply');
fs.mkdirSync(work, { recursive: true });
const cli = (cliArgs) => execFileSync('npx', ['supabase', ...cliArgs], {
  cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true,
});

if (!fs.existsSync(path.join(work, 'supabase', 'config.toml'))) cli(['init', '--yes']);

let failures = 0;
for (const school of targets) {
  const line = [school.name.padEnd(22)];
  try {
    cli(['link', '--project-ref', school.ref]);
  } catch (e) {
    console.log(`✗ ${school.name} — link נכשל: ${String(e.stderr || e.message).trim().slice(0, 120)}`);
    failures++;
    continue;
  }
  if (check) {
    try { cli(['db', 'query', '--linked', 'select 1']); line.push('חיבור ✓'); }
    catch (e) { failures++; line.push('חיבור ✗ ' + String(e.stderr || e.message).trim().slice(0, 120)); }
    console.log(line.join('  '));
    continue;
  }
  for (const f of files) {
    try {
      cli(['db', 'query', '--linked', '-f', path.resolve(root, f)]);
      line.push(`${path.basename(f).replace(/^migration_|\.sql$/g, '')} ✓`);
    } catch (e) {
      failures++;
      line.push(`${path.basename(f)} ✗ ${String(e.stderr || e.stdout || e.message).trim().slice(0, 160)}`);
    }
  }
  console.log(line.join('  '));
}

console.log(failures ? `\nהסתיים עם ${failures} כשלים.` : `\n✓ הכול הוחל על ${targets.length} מסדים.`);
process.exit(failures ? 1 : 0);
