// ============================================================
// הפיכת המסמכים שב-reports/ לקובצי PDF מוכנים לשליחה.
//
//   node scripts/build-pdfs.mjs                 — כל המסמכים
//   node scripts/build-pdfs.mjs beer-sheva      — מסמך אחד (או network)
//
// התוצר: reports/pdf/<slug>.pdf — A4 לאורך, בדיוק כמו הדפסה מהדפדפן,
// בלי הכותרות והכתובת ש-Chrome מוסיף בהדפסה ידנית.
//
// דורש playwright. הוא אינו מותקן בפרויקט הזה, ולכן נטען מפרויקט אחר
// במחשב — אם יום אחד הוא לא יימצא שם, מתקינים כאן: npm i -D playwright
// ============================================================
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const root = process.cwd();
const reports = path.join(root, 'reports');
const outDir = path.join(reports, 'pdf');

const FALLBACK_PLAYWRIGHT = [
  'C:/tmp/work/betzavta/node_modules/playwright/index.mjs',
  'C:/tmp/work/chabad-masad-ntunim/node_modules/playwright/index.mjs',
];

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* לא מותקן כאן */ }
  for (const p of FALLBACK_PLAYWRIGHT) {
    if (fs.existsSync(p)) return await import(pathToFileURL(p).href);
  }
  console.error('✗ playwright לא נמצא. התקנה:  npm i -D playwright');
  process.exit(1);
}

const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const files = fs.readdirSync(reports)
  .filter(f => f.endsWith('.html') && f !== 'index.html')
  .filter(f => !only.length || only.includes(path.basename(f, '.html')));

if (!files.length) { console.error('✗ אין מסמכים תואמים ב-reports/'); process.exit(1); }

const { chromium } = await loadPlaywright();
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

for (const file of files) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(reports, file)).href);
  // הגופנים והציור מסתיימים לפני הצילום, אחרת יוצא PDF חלקי
  await page.waitForTimeout(700);
  const out = path.join(outDir, file.replace(/\.html$/, '.pdf'));
  await page.pdf({ path: out, format: 'A4', printBackground: true });
  const pages = (fs.readFileSync(out).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`✓ ${path.basename(out).padEnd(20)} ${pages} עמודים · ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
  await page.close();
}

await browser.close();
console.log(`\nהקבצים ב-${outDir}`);
