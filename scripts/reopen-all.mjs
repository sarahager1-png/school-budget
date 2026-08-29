// ============================================================
// פתיחה מחדש לעריכה של תקציבי כל בתי הספר.
//
//   node scripts/reopen-all.mjs                 — דוח בלבד (מי סגור, מה יימחק)
//   node scripts/reopen-all.mjs --apply         — פותח בפועל, אחרי גיבוי
//   node scripts/reopen-all.mjs --apply raanana ashkelon   — רק בתי ספר מסוימים
//
// "סגור" = budget_approvals.summary מכיל suggestions כמערך (ר' migration_v20).
// הפתיחה מנקה את הסנפשוט הקפוא ומשאירה רק draftParams — בדיוק כמו כפתור
// "פתיחה מחדש לעריכה" באפליקציה (useBudgetClosed.reopen). החתימות עצמן
// (principal_signature / courier_signature) נשארות בשורה ולא נמחקות.
//
// לפני כל שינוי נכתב גיבוי מלא של כל שורות budget_approvals לקובץ
// backup-reopen-<תאריך>.json בשורש הפרויקט. שחזור: node scripts/reopen-all.mjs --restore <file>
// ============================================================
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const restoreIdx = args.indexOf('--restore');
const restoreFile = restoreIdx !== -1 ? args[restoreIdx + 1] : null;
const slugs = args.filter((a, i) => !a.startsWith('--') && (restoreIdx === -1 || i !== restoreIdx + 1));
const targets = slugs.length ? config.schools.filter(s => slugs.includes(s.slug)) : config.schools;

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function clientFor(school) {
  const env = loadEnvFile(path.join(root, `.env.${school.slug}`));
  const local = loadEnvFile(path.join(root, `.env.${school.slug}.local`));
  const url = env.VITE_SUPABASE_URL || `https://${school.ref}.supabase.co`;
  const key = local.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const isClosed = (summary) => Array.isArray(summary?.suggestions);
const reopened = (summary) => (summary?.draftParams ? { draftParams: summary.draftParams } : null);

// ---------- שחזור מגיבוי ----------
if (restoreFile) {
  const backup = JSON.parse(fs.readFileSync(restoreFile, 'utf8'));
  for (const [slug, rows] of Object.entries(backup.schools)) {
    const school = config.schools.find(s => s.slug === slug);
    const db = clientFor(school);
    if (!db) { console.log(`✗ ${slug} — אין service key`); continue; }
    let ok = 0;
    for (const row of rows) {
      const { error } = await db.from('budget_approvals').update({ summary: row.summary }).eq('id', row.id);
      if (error) console.log(`   ✗ ${slug} ${row.id} — ${error.message}`); else ok++;
    }
    console.log(`✓ ${school.name} — שוחזרו ${ok}/${rows.length} שורות`);
  }
  process.exit(0);
}

// ---------- דוח / פתיחה ----------
const backup = { takenAt: new Date().toISOString(), schools: {} };
const report = [];
let closedTotal = 0;

for (const school of targets) {
  const db = clientFor(school);
  if (!db) { report.push({ school: school.name, status: 'אין service key (.env.<slug>.local חסר)' }); continue; }

  const { data: rows, error } = await db
    .from('budget_approvals')
    .select('id, school_id, budget_year_id, summary, principal_signed_at, courier_signed_at');
  if (error) { report.push({ school: school.name, status: `שגיאה: ${error.message}` }); continue; }

  const { data: years } = await db.from('budget_years').select('id, year');
  const yearName = (id) => years?.find(y => y.id === id)?.year ?? id;

  backup.schools[school.slug] = rows;
  const closed = rows.filter(r => isClosed(r.summary));
  closedTotal += closed.length;
  report.push({
    school: school.name,
    status: closed.length
      ? `סגור: ${closed.map(r => yearName(r.budget_year_id)).join(', ')}`
      : `פתוח (${rows.length} רשומות אישור)`,
    closed,
    db,
  });
}

console.log('\n=== מצב התקציבים ===');
for (const r of report) console.log(`  ${r.school.padEnd(24)} ${r.status}`);
console.log(`\nסה"כ שנים סגורות: ${closedTotal}`);

if (!apply) {
  console.log('\n(דוח בלבד — להרצה בפועל: node scripts/reopen-all.mjs --apply)');
  process.exit(0);
}

if (closedTotal === 0) { console.log('\nאין מה לפתוח.'); process.exit(0); }

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const backupPath = path.join(root, `backup-reopen-${stamp}.json`);
fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
console.log(`\n💾 גיבוי נשמר: ${backupPath}`);

console.log('\n=== פתיחה ===');
let failures = 0;
for (const r of report) {
  if (!r.closed?.length) continue;
  for (const row of r.closed) {
    const { error } = await r.db.from('budget_approvals')
      .update({ summary: reopened(row.summary), updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) { failures++; console.log(`  ✗ ${r.school} — ${error.message}`); }
    else console.log(`  ✓ ${r.school} — נפתח לעריכה`);
  }
}
console.log(failures ? `\nהסתיים עם ${failures} כשלים.` : '\nכל התקציבים פתוחים לעריכה.');
