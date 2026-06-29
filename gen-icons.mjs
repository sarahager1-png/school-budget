import { chromium } from 'playwright';
import fs from 'fs';
const logo = fs.readFileSync('public/logo.png').toString('base64');
const tpl = (size, cardFrac) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#1E0A3C 0%,#0B3B47 60%,#0FA3B1 100%);">
  <div style="width:${size*cardFrac}px;background:#fff;border-radius:${size*0.12}px;
    padding:${size*0.05}px ${size*0.045}px;box-shadow:0 ${size*0.03}px ${size*0.08}px rgba(0,0,0,.25);
    display:flex;align-items:center;justify-content:center;">
    <img src="data:image/png;base64,${logo}" style="width:100%;height:auto;display:block"/>
  </div>
</div></body></html>`;
const b = await chromium.launch();
async function shot(size, cardFrac, out){
  const p = await b.newPage({ viewport:{ width:size, height:size }, deviceScaleFactor:1 });
  await p.setContent(tpl(size,cardFrac), { waitUntil:'networkidle' });
  await p.screenshot({ path:out, clip:{x:0,y:0,width:size,height:size} });
  await p.close();
  console.log('wrote', out);
}
await shot(192,0.82,'public/icon-192.png');
await shot(512,0.82,'public/icon-512.png');
await shot(180,0.84,'public/apple-touch-icon.png');
await shot(512,0.66,'public/icon-512-maskable.png');
await shot(64,0.88,'public/favicon.png');
await b.close();
