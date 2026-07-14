// Smoke test all schools in schools.config.json:
//   site 200, both guides 200, email+password login works, profile row exists.
// Admin password convention: <slug>2026 (override in .env.<slug>.local ADMIN_PASSWORD).
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));

function envOf(slug) {
  const out = {};
  for (const f of [`.env.${slug}`, `.env.${slug}.local`]) {
    const fp = path.join(root, f);
    if (!fs.existsSync(fp)) continue;
    for (const raw of fs.readFileSync(fp, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq !== -1) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return out;
}

let failures = 0;
for (const s of config.schools) {
  const env = envOf(s.slug);
  const anon = env.VITE_SUPABASE_ANON_KEY;
  const url = env.VITE_SUPABASE_URL;
  const email = env.ADMIN_EMAIL || 'data@reshetch.org.il';
  const password = env.ADMIN_PASSWORD || `${s.slug}2026`;
  const parts = [];

  const code = async (u) => { try { return (await fetch(u)).status; } catch { return 0; } };
  parts.push(`site:${await code(`https://${s.surge}/`)}`);
  parts.push(`guide:${await code(`https://${s.surge}/guide.html`)}`);
  parts.push(`שליח:${await code(`https://${s.surge}/courier-guide.html`)}`);

  try {
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.msg || r.status);
    const p = await fetch(`${url}/rest/v1/profiles?select=role&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${j.access_token}` },
    });
    const rows = await p.json();
    parts.push(rows.length ? `login:✓(${rows[0].role})` : 'login:✗(no profile)');
    if (!rows.length) failures++;
  } catch (e) {
    parts.push(`login:✗(${String(e.message).slice(0, 40)})`);
    failures++;
  }

  const bad = parts.some(x => x.includes(':0') || x.includes('404') || x.includes('✗'));
  if (bad) failures++;
  console.log(`${bad ? '❌' : '✅'} ${s.slug.padEnd(14)} ${parts.join('  ')}`);
}
process.exit(failures ? 1 : 0);
