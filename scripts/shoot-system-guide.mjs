// Screenshots for the full-system guide — live ashkelon, mobile viewport, logged in as
// the COURIER so the shots show exactly the clean view-only experience couriers get.
// Login is via a passwordless magic link minted with the project's own service-role key
// (read from .env.ashkelon.local) — no password is ever passed or printed.
// Usage: SYS_EMAIL=<courier email> node scripts/shoot-system-guide.mjs
import { chromium, devices } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SYS_EMAIL = process.env.SYS_EMAIL;
if (!SYS_EMAIL) {
  console.error('Usage: SYS_EMAIL=<courier email> node scripts/shoot-system-guide.mjs');
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync('.env.ashkelon.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = 'https://ogkwvrerolofujhydhsl.supabase.co';
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink', email: SYS_EMAIL,
  options: { redirectTo: 'https://chabad-ashkelon-budget.surge.sh' },
});
if (linkErr || !linkData?.properties?.action_link) {
  console.error('magic link failed:', linkErr?.message);
  process.exit(1);
}

const OUT = 'C:/tmp/system-shots';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

// grab the clean login screen first (fresh tab), then log in via the magic link
await page.goto('https://chabad-ashkelon-budget.surge.sh', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/0-login.png` });
await page.goto(linkData.properties.action_link, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const DRAWER = '.fixed.inset-0.z-50';
async function openScreen(label) {
  // open drawer
  await page.click('[aria-label="פתיחת תפריט"]');
  await page.waitForTimeout(400);
  await page.locator(`${DRAWER} button:has-text("${label}")`).first().click();
  await page.waitForTimeout(1400);
}
async function shootFull(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// 1. Dashboard (landing screen has בקשות for courier; navigate to דף הבית)
await openScreen('דף הבית');
await shootFull('1-dashboard');

// 2. Classes
await openScreen('כיתות');
await shootFull('2-classes');

// 3. Income
await openScreen('הכנסות');
await shootFull('3-income');

// 4. Tuition (collection)
await openScreen('גבייה');
await shootFull('4-tuition');

// 5. Expenses
await openScreen('הוצאות');
await shootFull('5-expenses');

// 6. Payment requests (courier's own screen)
await openScreen('בקשות תשלום');
await shootFull('6-requests');

// 7. Salaries
await openScreen('משכורות');
await shootFull('7-salaries');

// 8. Simulation
await openScreen('שערוך תקציב');
await shootFull('8-simulation');

// 9. Reports
await openScreen('דוחות');
await shootFull('9-reports');

await b.close();
console.log('shots done:', fs.readdirSync(OUT).join(', '));
