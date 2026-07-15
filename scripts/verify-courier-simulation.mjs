// E2E check: courier can open שערוך תקציב, sees non-crashing totals, and can save/delete a scenario.
// Usage: COURIER_EMAIL=... COURIER_PASSWORD=... node scripts/verify-courier-simulation.mjs
import { chromium, devices } from 'playwright';

const { COURIER_EMAIL, COURIER_PASSWORD } = process.env;
if (!COURIER_EMAIL || !COURIER_PASSWORD) {
  console.error('Usage: COURIER_EMAIL=<courier email> COURIER_PASSWORD=<password> node scripts/verify-courier-simulation.mjs');
  process.exit(1);
}

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' });
const page = await ctx.newPage();
let crashed = false;
page.on('pageerror', e => { crashed = true; console.log('PAGE ERROR:', e.message); });

await page.goto('https://chabad-ashkelon-budget.surge.sh', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.fill('input[type="email"]', COURIER_EMAIL);
await page.fill('input[type="password"]', COURIER_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// bottom nav should now show a שערוך icon for the courier (exact match — sidebar uses the longer "שערוך תקציב" label and stays hidden on mobile)
const bottomSim = page.getByText('שערוך', { exact: true });
const hasBottomNav = await bottomSim.count() > 0;
console.log('bottom-nav שערוך visible:', hasBottomNav);
await bottomSim.click();
await page.waitForSelector('text=סימולציית תקציב — שערוך', { timeout: 15000 });
await page.waitForTimeout(500);

// move a slider — this used to crash the whole page (TrendingUp bug)
await page.evaluate(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const node = document.querySelectorAll('input[type="range"]')[0];
  setter.call(node, '3');
  node.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(500);
console.log('page crashed after slider move:', crashed);

// try saving a scenario (tests budget_scenarios RLS write for courier)
await page.locator('button:has-text("שמירת תרחיש")').click();
await page.waitForTimeout(400);
await page.fill('input[placeholder*="תקציב עם"]', 'בדיקת שליח — למחיקה');
await page.locator('button:has-text("שמור")').click();
await page.waitForTimeout(1200);
const bodyText = await page.innerText('body');
const saved = bodyText.includes('בדיקת שליח — למחיקה');
console.log('scenario saved & visible:', saved);

// clean up: delete the test scenario
if (saved) {
  await page.locator('button[aria-label*="מחיקת"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("מחק"), button:has-text("כן")').first().click().catch(() => {});
  await page.waitForTimeout(800);
}

await b.close();
console.log(crashed ? '✗ FAIL — page crashed' : (hasBottomNav && saved ? '✓ PASS' : '✗ FAIL — missing nav or save'));
