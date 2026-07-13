// Screenshots for the courier guide — live ashkelon, mobile viewport.
import { chromium, devices } from 'playwright';
import fs from 'fs';

const OUT = 'C:/tmp/courier-shots';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL', deviceScaleFactor: 2 });
const page = await ctx.newPage();

// 1. login page
await page.goto('https://chabad-ashkelon-budget.surge.sh', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/1-login.png` });

// login as demo courier
await page.click('text=כניסה עם אימייל וסיסמה');
await page.fill('input[type="email"]', 'shaliach.demo@reshetch.org.il');
await page.fill('input[type="password"]', 'demo2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/debug-postlogin.png` });
const bodyText = await page.innerText('body');
console.log('post-login snippet:', JSON.stringify(bodyText.slice(0, 200)));
// live bundle may land couriers on the dashboard — hop to their screen via bottom nav
const navBtn = page.locator('nav >> text="בקשות"').first();
if (await page.locator('h2:has-text("בקשות תשלום")').count() === 0) {
  await navBtn.click();
  await page.waitForTimeout(1000);
}
await page.waitForSelector('h2:has-text("בקשות תשלום")', { timeout: 15000 });
await page.waitForTimeout(800);

// 2. the courier home screen
await page.screenshot({ path: `${OUT}/2-home.png` });


// center a card in the viewport so the fixed bottom-nav never overlaps it
async function shootCard(card, path) {
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 170));
  await page.waitForTimeout(350);
  await card.screenshot({ path });
}
// 3. pending card
const pendingCard = page.locator('.card', { hasText: 'הדפסת חוברות לימוד' });
await shootCard(pendingCard, `${OUT}/3-pending-card.png`);

// 4. in-progress card (already advanced in a previous run, or advance now)
const firstCard = page.locator('.card', { hasText: 'תשלום להסעות' });
const startBtn = firstCard.locator('button:has-text("התחל ביצוע")');
if (await startBtn.count() > 0) {
  await startBtn.click();
  await page.waitForTimeout(1500);
}
await shootCard(firstCard, `${OUT}/4-inprogress-card.png`);

// 5. open the receipt upload modal (full-screen shot — the modal overlays)
await firstCard.locator('button:has-text("העלה קבלה")').click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/5-receipt-modal.png` });
await page.locator('button:has-text("ביטול")').click();
await page.waitForTimeout(400);

// 6. paid card (סמן הושלם)
const paidCard = page.locator('.card', { hasText: 'ציוד יצירה לכיתות' });
await shootCard(paidCard, `${OUT}/6-paid-card.png`);

// 7. completed card
const doneCard = page.locator('.card', { hasText: 'מקרן לאולם' });
await shootCard(doneCard, `${OUT}/7-completed-card.png`);

// 8. status filter row (top summary)
await page.locator('.grid.grid-cols-4').first().screenshot({ path: `${OUT}/8-status-summary.png` });

await b.close();
console.log('shots done:', fs.readdirSync(OUT).join(', '));
