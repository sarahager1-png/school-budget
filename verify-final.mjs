import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale:'he-IL' });
const p = await ctx.newPage();
let ok=false;
for(let i=0;i<6;i++){ try{ const r=await p.goto('https://chabad-mazkeret-budget.surge.sh/',{waitUntil:'networkidle',timeout:20000}); const t=await p.innerText('body'); if(r.status()===200&&!t.includes('Gateway')){ok=true;break;} }catch(e){} await new Promise(s=>setTimeout(s,4000)); }
console.log('reachable',ok);
await p.waitForTimeout(1500);
await p.screenshot({ path:'C:/tmp/mb-shalhavot-login.png' });
// login via email to confirm school name
await p.click('text=כניסה עם אימייל וסיסמה').catch(()=>{});
await p.waitForSelector('input[type=email]',{timeout:10000});
await p.fill('input[type=email]','bina@reshetch.org.il');
await p.fill('input[type=password]','mazkeret2026');
await p.click('button[type=submit]');
await p.waitForTimeout(6000);
const t = await p.innerText('body');
console.log('after login shows שלהבות מזכרת בתיה somewhere:', t.includes('שלהבות מזכרת בתיה'));
await p.screenshot({ path:'C:/tmp/mb-shalhavot-dash.png', fullPage:true });
await b.close();
