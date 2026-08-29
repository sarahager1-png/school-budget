// עדכון הסוד SCHOOL_KEYS בפונקציית network-budget (בפרויקט של אשקלון).
//
// ה-Management API מחזיר ב-GET /secrets רק טביעת-אצבע (hash) של הערך, לא את
// הערך עצמו — אי אפשר "למזג" עם הקיים. לכן בונים את הסוד מחדש מהמקור האמין:
// מפתח ה-service_role של כל בית ספר נשלף ישירות מה-API, לפי רשימת ה-SCHOOLS
// שבקוד הפונקציה עצמה (index.ts) — כולל בתי ספר שאין להם env מקומי.
//
//   set SUPABASE_ACCESS_TOKEN=sbp_...
//   node scripts/update-school-keys.mjs
//
// שינויים בסוד נקלטים בפונקציה רצה תוך רגעים; אם אחרי כמה דקות הפורטל עדיין
// לא מציג נתונים — לפרוס מחדש:
//   npx supabase functions deploy network-budget --project-ref ogkwvrerolofujhydhsl --no-verify-jwt
import fs from 'fs';
import path from 'path';

const API = 'https://api.supabase.com/v1';
const HUB_REF = 'ogkwvrerolofujhydhsl'; // אשקלון — הבית של network-budget

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('✗ חסר SUPABASE_ACCESS_TOKEN בסביבה'); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(method, url, body) {
  const res = await fetch(`${API}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('1) קורא את רשימת בתי הספר מ-index.ts של הפונקציה...');
  const indexTs = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/network-budget/index.ts'), 'utf8');
  const schools = [...indexTs.matchAll(/slug: '([a-z0-9-]+)',[^}]*?ref: '([a-z]{20})'/g)]
    .map((m) => ({ slug: m[1], ref: m[2] }));
  if (schools.length < 12) throw new Error(`נמצאו רק ${schools.length} בתי ספר ב-index.ts — משהו לא תקין`);
  console.log(`   ✓ ${schools.length} בתי ספר`);

  console.log('2) שולף מפתח שירות לכל בית ספר...');
  const keys = {};
  for (const { slug, ref } of schools) {
    const apiKeys = await api('GET', `/projects/${ref}/api-keys`);
    const service = apiKeys.find((k) => k.name === 'service_role')?.api_key;
    if (!service) throw new Error(`${slug}: לא נמצא מפתח service_role`);
    keys[ref] = service;
    console.log(`   ✓ ${slug}`);
  }

  console.log('3) שומר את הסוד...');
  await api('POST', `/projects/${HUB_REF}/secrets`, [
    { name: 'SCHOOL_KEYS', value: JSON.stringify(keys) },
  ]);
  console.log(`   ✓ SCHOOL_KEYS עודכן — ${Object.keys(keys).length} בתי ספר`);
}

main().catch((e) => { console.error('\n✗ ' + e.message); process.exit(1); });
