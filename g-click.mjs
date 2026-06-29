import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale:'he-IL' });
const p = await ctx.newPage();
await p.goto('https://chabad-mazkeret-budget.surge.sh/', { waitUntil:'networkidle' });
await p.waitForSelector('text=המשך עם Google', { timeout:15000 });
await Promise.all([
  p.waitForURL(/accounts\.google\.com|google\.com\/o\/oauth/, { timeout:20000 }).catch(()=>{}),
  p.click('text=המשך עם Google'),
]);
await p.waitForTimeout(2500);
const url = p.url();
console.log('after click URL host:', (()=>{try{return new URL(url).host}catch{return url}})());
console.log('reached Google OAuth:', /google\.com/.test(url));
await b.close();
