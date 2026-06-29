import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale:'he-IL' });
const p = await ctx.newPage();
let ok=false;
for(let i=0;i<6;i++){
  try{ const r=await p.goto('https://chabad-mazkeret-budget.surge.sh/',{waitUntil:'networkidle',timeout:20000});
    const t=await p.innerText('body'); if(r.status()===200 && !t.includes('Gateway')){ok=true;break;} }
  catch(e){}
  await new Promise(s=>setTimeout(s,4000));
}
console.log('reachable',ok);
await p.waitForTimeout(1500);
await p.screenshot({ path:'C:/tmp/mb-login-google.png' });
const t=await p.innerText('body');
console.log('has Google button:', t.includes('המשך עם Google'));
console.log('has email fallback link:', t.includes('כניסה עם אימייל'));
await b.close();
