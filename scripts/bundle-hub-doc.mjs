// מטמיע את המסמך המרכז לתוך מבט רשת (budget-hub/index.html).
//
//   node scripts/bundle-hub-doc.mjs
//
// הפורטל נפרס כקובץ אחד ל-surge, ולכן המנוע וקוד המסמך נכתבים לתוכו בין
// הסימונים doc-css / doc-engine. מריצים אחרי כל שינוי ב-calculations.js,
// ב-efficiency.js או בקבצי report-*, אחרת הפורטל נשאר עם גרסה ישנה.
//
// המקור היחיד הוא src/ — אין כאן עותק שני של החישוב.
import fs from 'fs';
import path from 'path';
import { inlineModule, REPORT_CSS } from './build-school-report.mjs';

const hub = path.join(process.cwd(), '..', 'budget-hub', 'index.html');
if (!fs.existsSync(hub)) {
  console.error(`✗ לא נמצא ${hub}`);
  process.exit(1);
}

const ENGINE = [
  'src/data/constants.js',
  'src/lib/categoryKinds.js',
  'src/lib/calculations.js',
  'src/lib/efficiency.js',
  'scripts/report-data.mjs',
  'scripts/report-rows.mjs',
  'scripts/report-client.js',
].map(inlineModule).join('\n\n')
  // הקוד יושב במודול, ולכן אינו גלובלי — מה שהפורטל צריך נחשף במפורש.
  + '\n\nwindow.__doc = { mountReport, docStateFromRows, docCategories };\n';

function replaceBetween(text, startMark, endMark, content, label) {
  const a = text.indexOf(startMark);
  const b = text.indexOf(endMark);
  if (a === -1 || b === -1) {
    console.error(`✗ לא נמצאו הסימונים של ${label} ב-index.html`);
    process.exit(1);
  }
  return text.slice(0, a + startMark.length) + '\n' + content + '\n    ' + text.slice(b);
}

let html = fs.readFileSync(hub, 'utf8');
html = replaceBetween(html, '/* doc-css:start */', '/* doc-css:end */', REPORT_CSS, 'העיצוב');
html = replaceBetween(html, '/* doc-engine:start */', '/* doc-engine:end */', ENGINE, 'המנוע');
fs.writeFileSync(hub, html, 'utf8');

console.log(`✓ הוטמע ל-${hub}`);
console.log(`  מנוע: ${(ENGINE.length / 1024).toFixed(0)}KB · עיצוב: ${(REPORT_CSS.length / 1024).toFixed(1)}KB`);
console.log('\nפריסה:  cd ../budget-hub  &&  npx surge . chabad-budget-hub.surge.sh');
