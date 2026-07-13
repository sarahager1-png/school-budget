// Build + deploy one school (or all) from schools.config.json.
//   node scripts/deploy.mjs <slug>     — deploy one school
//   node scripts/deploy.mjs --all      — deploy every school that has .env.<slug>
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'schools.config.json'), 'utf8'));

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/deploy.mjs <slug> | --all');
  console.error('Schools:', config.schools.map(s => s.slug).join(', '));
  process.exit(1);
}

const targets = arg === '--all'
  ? config.schools
  : config.schools.filter(s => s.slug === arg);

if (targets.length === 0) {
  console.error(`Unknown school "${arg}". Known: ${config.schools.map(s => s.slug).join(', ')}`);
  process.exit(1);
}

let failed = 0;
for (const school of targets) {
  const envFile = path.join(root, `.env.${school.slug}`);
  if (!fs.existsSync(envFile)) {
    console.error(`⏭  ${school.slug} — missing .env.${school.slug}, skipping`);
    failed++;
    continue;
  }
  console.log(`\n━━━ ${school.name} (${school.slug}) → ${school.surge} ━━━`);
  try {
    execSync(`npx vite build --mode ${school.slug}`, { stdio: 'inherit' });
    execSync(`npx surge dist ${school.surge}`, { stdio: 'inherit' });
    console.log(`✓ ${school.name} — https://${school.surge}`);
  } catch (e) {
    console.error(`✗ ${school.slug} deploy failed`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
