// Apply SQL files to a Supabase project via the Management API query endpoint.
// Usage: node scripts/apply-sql.mjs <ref> <tokenFile> <file1.sql> [file2.sql ...]
import fs from 'fs';

const [ref, tokenFile, ...files] = process.argv.slice(2);
if (!ref || !tokenFile || files.length === 0) {
  console.error('Usage: node scripts/apply-sql.mjs <ref> <tokenFile> <file.sql> [...]');
  process.exit(1);
}
const token = fs.readFileSync(tokenFile, 'utf8').trim();

async function runSql(query, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`✗ ${label} — HTTP ${res.status}: ${text.slice(0, 600)}`);
    return false;
  }
  console.log(`✓ ${label} — ok`);
  return true;
}

for (const file of files) {
  let sql = fs.readFileSync(file, 'utf8');
  // Postgres does not support CREATE POLICY IF NOT EXISTS — safe on a fresh DB.
  sql = sql.replace(/CREATE POLICY IF NOT EXISTS/g, 'CREATE POLICY');
  const ok = await runSql(sql, file.split(/[\\/]/).pop());
  if (!ok) process.exit(1);
}
console.log('\nAll SQL applied.');
