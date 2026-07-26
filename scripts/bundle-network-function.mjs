// מאחד את הפונקציה network-budget לקובץ אחד להדבקה בעורך של דשבורד Supabase
// (כשאין SUPABASE_ACCESS_TOKEN ל-CLI). התוצר: supabase/functions/network-budget/_dashboard-paste.ts
//   node scripts/bundle-network-function.mjs
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'supabase/functions/network-budget');
const engine = fs.readFileSync(path.join(dir, 'budget-engine.js'), 'utf8');
const index = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8');

// מסירים את שורת ה-import של המנוע — הקוד שלו מוטמע ישירות מעליו
const withoutImport = index.replace(
  /import \{[\s\S]*?\} from '\.\/budget-engine\.js';\n/,
  '',
);
if (withoutImport === index) {
  console.error('✗ לא נמצאה שורת ה-import של budget-engine.js ב-index.ts');
  process.exit(1);
}

// המנוע נעטף ב-IIFE כדי ששמות פנימיים (PAYMENT_MONTHS, annualAmount) לא יתנגשו
// עם אלה של index.ts — כך הקובץ המאוחד מתנהג בדיוק כמו שני הקבצים הנפרדים.
const EXPORTS = ['buildSuggestionRows', 'selectedSuggestions', 'sumSavings', 'normalizeSuggestionKey'];
for (const name of EXPORTS) {
  if (!new RegExp(`^export function ${name}\\b`, 'm').test(engine)) {
    console.error(`✗ המנוע לא מייצא את ${name}`);
    process.exit(1);
  }
}
const scopedEngine = `const { ${EXPORTS.join(', ')} } = (() => {
${engine.replace(/^export /gm, '')}
  return { ${EXPORTS.join(', ')} };
})();`;

// @ts-nocheck: המנוע כתוב ב-JS ובקובץ .ts מאוחד הוא היה נופל על טיפוסים משתמעים.
// הבדיקה האמיתית רצה על קבצי המקור (npx deno check index.ts) ועל הרצת הפונקציה.
const out = `// @ts-nocheck
// ⚠️ קובץ מאוחד להדבקה בעורך של דשבורד Supabase — נוצר ע"י scripts/bundle-network-function.mjs
// אין לערוך אותו ידנית. מקורות: budget-engine.js + index.ts באותה תיקייה.
// דרך הפריסה המועדפת היא ה-CLI:
//   npx supabase functions deploy network-budget --project-ref ogkwvrerolofujhydhsl --no-verify-jwt
// בדשבורד: לוודא ש-"Verify JWT" נשאר כבוי, אחרת הפורטל יקבל 401.

${scopedEngine}

${withoutImport}`;

const target = path.join(dir, '_dashboard-paste.ts');
fs.writeFileSync(target, out, 'utf8');
console.log(`✓ נוצר ${path.relative(process.cwd(), target)} — ${out.length.toLocaleString('he-IL')} תווים`);
