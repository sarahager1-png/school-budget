// מוודא שמנוע הייעול של מבט רשת (supabase/functions/network-budget/budget-engine.js)
// מחזיר בדיוק את אותן הצעות ואותם סכומים כמו המנוע של המערכת (src/lib/efficiency.js).
// מריצים אחרי כל שינוי בהיגיון הייעול:  node scripts/verify-engine-parity.mjs
import { buildSuggestionRows as appEngine } from '../src/lib/efficiency.js';
import { buildSuggestionRows as hubEngine } from '../supabase/functions/network-budget/budget-engine.js';

// LCG — נתונים אקראיים אך זהים בכל ריצה, כדי שכישלון יהיה ניתן לשחזור
let seed = 20260726;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const GRADES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];
const CAT_NAMES = ['שכר עובדים', 'בניין ותחזוקה', 'אירועים וחגים', 'ציוד', 'פיתוח מקצועי', 'הוצאות שונות'];
const EXPENSE_NAMES = ['הסעות תלמידים', 'שכר מנהלת', 'חשמל ומים', 'מסיבת חנוכה', 'ריהוט כיתות', 'ניקיון', 'טיולים'];

function makeSchool() {
  const classCount = int(1, 8);
  const classes = [];
  for (let i = 0; i < classCount; i++) {
    const grade = pick(GRADES);
    const named = rnd() < 0.5;
    classes.push({
      id: `c${i}-${int(1000, 9999)}`,
      name: named ? `כיתה ${grade}${rnd() < 0.3 ? '1' : ''}` : `${grade}${int(1, 2)}`,
      gradeLevel: rnd() < 0.7 ? grade : null,
      studentCount: int(3, 35),
      extraHours: rnd() < 0.3 ? int(1, 10) : 0,
    });
  }

  const categories = CAT_NAMES.map((name, i) => ({ id: `cat${i}`, name, kind: rnd() < 0.8 ? undefined : 'other' }));
  const expenses = [];
  for (let i = 0; i < int(0, 10); i++) {
    expenses.push({
      id: `e${i}`,
      name: pick(EXPENSE_NAMES),
      amount: int(500, 60000),
      period: rnd() < 0.5 ? 'monthly' : 'annual',
      categoryId: pick(categories).id,
    });
  }

  const constants = {
    counselingHoursPerClass: 2,
    clubsMonthlyExpensePerClass: rnd() < 0.25 ? 0 : 2000,
    fullClassStudentThreshold: pick([21, 20, 22]),
    halfClassStudentThreshold: pick([11, 10, 12]),
    fullClassMinistryHours: 22,
    halfClassMinistryHours: 11,
    ministryHourlyRate: 400,
    actualWeeklyHours: pick([29, 34, 22]),
    actualHourlyRate: pick([450, 700]),
    incomePerStudent: pick([0, 350, 1500]),
    incomePerStudentTalan: pick([0, 885]),
    expensePerStudent: pick([0, 1200]),
    professionalDevPerClass: pick([0, 3000]),
    incomePerStudentCaharon: pick([0, 0, 2000]),
    expensePerStudentCaharon: pick([0, 0, 3500]),
    ministryGrantPerStudent: pick([0, 370]),
  };

  return { classes, expenses, categories, constants };
}

let checked = 0;
let failures = 0;
for (let n = 0; n < 400; n++) {
  const { classes, expenses, categories, constants } = makeSchool();
  const a = appEngine(classes, expenses, categories, constants);
  const b = hubEngine(classes, expenses, categories, constants);
  checked++;
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) {
    failures++;
    if (failures <= 3) {
      console.error(`\n✗ מקרה ${n} — הצעות שונות:`);
      console.error('  מערכת:', sa.slice(0, 600));
      console.error('  מבט רשת:', sb.slice(0, 600));
    }
  }
}

console.log(`${failures ? '✗' : '✓'} ${checked} בתי ספר סינתטיים נבדקו — ${failures} פערים`);
process.exit(failures ? 1 : 0);
