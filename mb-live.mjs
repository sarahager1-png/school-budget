import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale:'he-IL' });
const p = await ctx.newPage();
let ok=false;
for (let i=0;i<8;i++){
  try{
    const r=await p.goto('https://chabad-mazkeret-budget.surge.sh/', { waitUntil:'networkidle', timeout:20000 });
    const body=await p.innerText('body');
    if(r.status()===200 && !body.includes('Gateway')){ ok=true; break; }
    console.log('try',i+1,'status',r.status());
  }catch(e){ console.log('try',i+1,'err',e.message.split('\n')[0]); }
  await new Promise(s=>setTimeout(s,5000));
}
console.log('reachable:',ok);
if(ok){
  await p.screenshot({ path:'C:/tmp/mb-live-login.png' });
  await p.waitForSelector('input[type=email]', { timeout:15000 });
  await p.fill('input[type=email]','bina@reshetch.org.il');
  await p.fill('input[type=password]','mazkeret2026');
  await p.click('button[type=submit]');
  await p.waitForTimeout(7000);
  await p.screenshot({ path:'C:/tmp/mb-live-dash.png', fullPage:true });
  const t=await p.innerText('body');
  console.log('shows מזכרת בתיה:', t.includes('מזכרת בתיה'));
  console.log('shows רעננה:', t.includes('רעננה'));
}
await b.close();
