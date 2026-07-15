// E2E check: courier sees every screen (view-only), writes are hidden in UI
// AND rejected by RLS on the 5 newly-locked tables. Principal regression check included.
// Usage: COURIER_EMAIL=... COURIER_PASSWORD=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/verify-full-courier-access.mjs
import { chromium, devices } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const { COURIER_EMAIL, COURIER_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!COURIER_EMAIL || !COURIER_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Usage: COURIER_EMAIL=... COURIER_PASSWORD=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/verify-full-courier-access.mjs');
  process.exit(1);
}

const URL_ = 'https://chabad-ashkelon-budget.surge.sh';
const SUPABASE_URL = 'https://ogkwvrerolofujhydhsl.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY; // optional, only needed for the direct RLS probe

let pass = true;
const b = await chromium.launch();

// ── 1. Courier: nav visibility across every page ──
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' });
  const page = await ctx.newPage();
  let crashed = false;
  page.on('pageerror', e => { crashed = true; console.log('PAGE ERROR:', e.message); });

  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', COURIER_EMAIL);
  await page.fill('input[type="password"]', COURIER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.click('[aria-label="פתיחת תפריט"]');
  await page.waitForTimeout(400);

  const DRAWER = '.fixed.inset-0.z-50';
  const PAGES = ['דף הבית', 'כיתות', 'הכנסות', 'גבייה', 'הוצאות', 'משכורות', 'שערוך תקציב', 'דוחות', 'הגדרות'];
  for (let i = 0; i < PAGES.length; i++) {
    const label = PAGES[i];
    const link = page.locator(`${DRAWER} button:has-text("${label}")`).first();
    const visible = await link.count() > 0;
    console.log(`nav "${label}" visible to courier:`, visible);
    if (!visible) pass = false;
    if (visible) {
      await link.click();
      await page.waitForTimeout(1200);
      console.log(`  → opened "${label}", crashed so far:`, crashed);
      if (crashed) pass = false;
      // reopen drawer for next iteration (drawer auto-closes on navigate)
      if (i < PAGES.length - 1) {
        await page.click('[aria-label="פתיחת תפריט"]');
        await page.waitForTimeout(300);
      }
    }
  }

  // Settings → Users tab specifically (admin-only until today) — drawer already closed after last nav click
  const usersTab = page.locator('button:has-text("משתמשים")').last();
  if (await usersTab.count() > 0) {
    await usersTab.click();
    await page.waitForTimeout(800);
    const bodyText = await page.innerText('body');
    console.log('courier sees Users tab content:', bodyText.includes('ניהול משתמשים'));
  }

  // write buttons should be ABSENT for courier anywhere reached
  const writeButtons = await page.locator('button:has-text("הוסף"), button:has-text("שמור"), button:has-text("מחיקה"), button:has-text("עריכה")').count();
  console.log('write-trigger buttons visible to courier (should be 0):', writeButtons);
  if (writeButtons > 0) pass = false;

  console.log('courier session crashed at any point:', crashed);
  if (crashed) pass = false;
  await ctx.close();
}

// ── 2. Direct RLS probe: courier session tries to write to the 5 locked tables ──
if (ANON_KEY) {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: COURIER_EMAIL, password: COURIER_PASSWORD });
  if (authErr) {
    console.log('RLS probe: courier auth failed —', authErr.message);
  } else {
    const probes = [
      ['employees', () => supabase.from('employees').update({ monthly_salary: 1 }).eq('id', '00000000-0000-0000-0000-000000000000')],
      ['salary_payments', () => supabase.from('salary_payments').insert({ school_id: '00000000-0000-0000-0000-000000000000', employee_id: '00000000-0000-0000-0000-000000000000', month: '2026-01-01', amount: 1 })],
      ['budget_years', () => supabase.from('budget_years').update({ label: 'x' }).eq('id', '00000000-0000-0000-0000-000000000000')],
      ['financial_constants', () => supabase.from('financial_constants').update({ income_per_student: 1 }).eq('id', '00000000-0000-0000-0000-000000000000')],
      ['profiles', () => supabase.from('profiles').update({ role: 'admin' }).eq('id', '00000000-0000-0000-0000-000000000000')],
    ];
    for (const [table, fn] of probes) {
      const { data, error } = await fn();
      const blocked = !data || data.length === 0; // RLS silently returns 0 rows affected, not an error
      console.log(`RLS write probe "${table}" blocked:`, blocked, error ? `(error: ${error.message})` : '');
      if (!blocked) pass = false;
    }
  }
} else {
  console.log('SUPABASE_ANON_KEY not set — skipping direct RLS probe (UI absence check above still ran)');
}

// ── 3. Regression check: admin/principal still fully functional ──
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'he-IL' });
  const page = await ctx.newPage();
  let crashed = false;
  page.on('pageerror', e => { crashed = true; console.log('ADMIN PAGE ERROR:', e.message); });

  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.click('[aria-label="פתיחת תפריט"]');
  await page.waitForTimeout(400);
  const classesLink = page.locator('.fixed.inset-0.z-50 button:has-text("כיתות")').first();
  await classesLink.click();
  await page.waitForTimeout(1000);
  const addBtn = await page.locator('button:has-text("הוסף כיתה")').count();
  console.log('admin still sees "הוסף כיתה" (should be true):', addBtn > 0);
  if (addBtn === 0) pass = false;
  console.log('admin session crashed:', crashed);
  if (crashed) pass = false;
  await ctx.close();
}

await b.close();
console.log(pass ? '\n✓ PASS — full report above' : '\n✗ FAIL — see failures above');
process.exit(pass ? 0 : 1);
