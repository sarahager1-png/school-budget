// Screenshots for the simulation guide (שערוך תקציב) — live ashkelon, mobile viewport.
// Usage: SIM_EMAIL=... SIM_PASSWORD=... node scripts/shoot-simulation-guide.mjs
import { chromium, devices } from 'playwright';
import fs from 'fs';

const { SIM_EMAIL, SIM_PASSWORD } = process.env;
if (!SIM_EMAIL || !SIM_PASSWORD) {
  console.error('Usage: SIM_EMAIL=<admin email> SIM_PASSWORD=<password> node scripts/shoot-simulation-guide.mjs');
  process.exit(1);
}

const OUT = 'C:/tmp/simulation-shots';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });

// 1. login as admin (ashkelon has no Google provider — email form shows by default)
await page.goto('https://chabad-ashkelon-budget.surge.sh', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.fill('input[type="email"]', SIM_EMAIL);
await page.fill('input[type="password"]', SIM_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);

// navigate to שערוך תקציב via the mobile drawer (sidebar is desktop-only on this viewport)
await page.click('[aria-label="פתיחת תפריט"]');
await page.waitForTimeout(400);
const simLink = page.locator('text=שערוך תקציב').last();
await simLink.click();
await page.waitForSelector('text=סימולציית תקציב — שערוך', { timeout: 15000 });
await page.waitForTimeout(600);

// 1. header + top of page
await page.screenshot({ path: `${OUT}/1-header.png` });

// 2. drag the class/student sliders to visible non-zero values
// order: 0 studentDelta, 1 extraClasses, 2 incomePerStudent, 3 ministryGrant, 4 ministryRate, 5 extraIncome, 6 expensePerStudent, 7 extraExpense
const count = await page.locator('input[type="range"]').count();
console.log('sliders found:', count);
await page.evaluate((values) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputs = document.querySelectorAll('input[type="range"]');
  for (const [idx, v] of Object.entries(values)) {
    const node = inputs[Number(idx)];
    if (!node) continue;
    setter.call(node, String(v));
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, { 0: 5, 1: 1 }); // +5 students per class, +1 extra class
await page.waitForTimeout(500);

// screenshot the כיתות ותלמידים card
const classesCard = page.locator('h3:has-text("כיתות ותלמידים")').locator('xpath=ancestor::div[contains(@class,"card")]').first();
await classesCard.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(300);
await classesCard.screenshot({ path: `${OUT}/2-classes-sliders.png` });

// 3. הכנסות card
const incomeCard = page.locator('h3:has-text("הכנסות")').locator('xpath=ancestor::div[contains(@class,"card")]').first();
await incomeCard.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(300);
await incomeCard.screenshot({ path: `${OUT}/3-income-sliders.png` });

// 4. current state card
const currentCard = page.locator('h3:has-text("מצב נוכחי")').locator('xpath=ancestor::div[contains(@class,"card")]').first();
await currentCard.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(300);
await currentCard.screenshot({ path: `${OUT}/4-current-state.png` });

// 5. simulated state card
const simCard = page.locator('h3:has-text("סימולציה")').locator('xpath=ancestor::div[contains(@class,"card")]').first();
await simCard.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(300);
await simCard.screenshot({ path: `${OUT}/5-simulated-state.png` });

// 6. delta summary card
const deltaCard = page.locator('h3:has-text("שינוי משוער")').locator('xpath=ancestor::div[contains(@class,"card")]').first();
await deltaCard.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(300);
await deltaCard.screenshot({ path: `${OUT}/6-delta-summary.png` });

// 7. open save-scenario modal
await page.locator('button:has-text("שמירת תרחיש")').click();
await page.waitForTimeout(600);
await page.fill('input[placeholder*="תקציב עם"]', 'תקציב עם כיתה נוספת');
await page.screenshot({ path: `${OUT}/7-save-modal.png` });
await page.locator('button:has-text("שמור")').click();
await page.waitForTimeout(1200);

// 8. saved scenarios list
const savedCard = page.locator('h3:has-text("תרחישים שמורים")').locator('xpath=ancestor::div[contains(@class,"card")]').first();
await savedCard.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(400);
await savedCard.screenshot({ path: `${OUT}/8-saved-scenarios.png` });

await b.close();
console.log('shots done:', fs.readdirSync(OUT).join(', '));
