// Generate public/simulation-guide.html with the screenshots embedded as base64.
import fs from 'fs';

const SHOTS = 'C:/tmp/simulation-shots';
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${SHOTS}/${f}`).toString('base64')}`;

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>מדריך לשערוך תקציב — סימולציה</title>
<link rel="icon" type="image/png" href="/favicon.png" />
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'Heebo', sans-serif; background: #F8F7FB; color: #1A0B35; line-height: 1.75; font-size: 16px; }
  .page { max-width: 760px; margin: 0 auto; padding: 24px 20px 60px; }
  header.hero {
    background: linear-gradient(135deg, #1A0B35 0%, #3D2570 60%, #00B4CC 100%);
    color: #fff; border-radius: 24px; padding: 38px 28px; margin-bottom: 20px; text-align: center;
  }
  header.hero .emoji { font-size: 48px; }
  header.hero h1 { font-size: 30px; font-weight: 900; margin: 10px 0 4px; }
  header.hero p { color: rgba(255,255,255,.8); font-size: 16px; }
  .print-btn {
    display: inline-block; margin-top: 18px; background: #fff; color: #3D2570;
    border: none; border-radius: 12px; padding: 11px 24px; font-family: inherit;
    font-size: 15px; font-weight: 700; cursor: pointer;
  }

  nav.toc {
    display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    background: #fff; border: 1px solid #E2DCF0; border-radius: 16px;
    padding: 14px; margin-bottom: 28px;
  }
  nav.toc a {
    text-decoration: none; color: #4B2E83; background: #F0EDF8;
    padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;
  }

  h2 {
    font-size: 21px; font-weight: 900; color: #1A0B35;
    margin: 36px 0 12px; padding-bottom: 7px; border-bottom: 3px solid #00B4CC;
    display: flex; align-items: center; gap: 8px; scroll-margin-top: 16px;
  }
  h3 { font-size: 16px; font-weight: 800; color: #3D2570; margin: 4px 0 10px; }
  p, li { color: #3A3450; font-size: 15.5px; }
  .card { background: #fff; border: 1px solid #E2DCF0; border-radius: 18px; padding: 20px 22px; margin: 12px 0;
    box-shadow: 0 2px 12px rgba(75,46,131,.06); }
  .steps { counter-reset: step; list-style: none; }
  .steps li { counter-increment: step; position: relative; padding-right: 44px; margin: 12px 0; }
  .steps li::before {
    content: counter(step); position: absolute; right: 0; top: 1px;
    width: 30px; height: 30px; border-radius: 50%; background: #00B4CC; color: #fff;
    font-weight: 900; font-size: 14px; display: flex; align-items: center; justify-content: center;
  }
  .shot { text-align: center; margin: 18px 0; }
  .shot img {
    max-width: 340px; width: 100%; border-radius: 20px;
    box-shadow: 0 12px 32px rgba(75,46,131,.20); border: 1px solid #E2DCF0;
  }
  .shot figcaption { font-size: 13px; color: #8878AA; margin-top: 10px; }
  .tip { background: #F0EDF8; border: 1px solid #D0C5F0; border-radius: 14px; padding: 14px 18px; margin: 14px 0; font-size: 14.5px; color: #3D2570; }
  .warn { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 14px; padding: 14px 18px; margin: 14px 0; font-size: 14.5px; color: #9A3412; }
  .good { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 14px; padding: 14px 18px; margin: 14px 0; font-size: 14.5px; color: #065F46; }
  .stepnum {
    display: inline-flex; align-items: center; justify-content: center;
    background: #00B4CC; color: #fff; border-radius: 999px; font-weight: 900;
    width: 32px; height: 32px; margin-left: 8px; font-size: 15px; vertical-align: middle;
  }
  table.faq { width: 100%; border-collapse: collapse; background: #fff; border-radius: 16px; overflow: hidden; }
  table.faq th, table.faq td { border: 1px solid #E2DCF0; padding: 12px 16px; text-align: right; font-size: 14.5px; vertical-align: top; }
  table.faq th { background: #F8F7FB; font-weight: 700; width: 42%; color: #1A0B35; }
  .contact {
    background: linear-gradient(135deg, #1A0B35, #3D2570); color: #fff; border-radius: 20px;
    padding: 24px; text-align: center; margin-top: 30px;
  }
  .contact a { color: #fff; font-weight: 800; text-decoration: none; }
  footer { text-align: center; margin-top: 30px; color: #8878AA; font-size: 13px; }
  @media print {
    body { background: #fff; font-size: 13px; }
    .page { padding: 0; max-width: none; }
    .print-btn, nav.toc { display: none; }
    header.hero { border-radius: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { break-after: avoid; }
    .card, .shot { break-inside: avoid; }
    .shot img { max-width: 230px; }
  }
</style>
</head>
<body>
<div class="page">

<header class="hero">
  <div class="emoji">🧪</div>
  <h1>מדריך לשערוך תקציב</h1>
  <p>סימולציית "מה יקרה אם" — צעד-אחר-צעד, עם תמונות מהמערכת</p>
  <button class="print-btn" onclick="window.print()">🖨️ הדפסת המדריך</button>
</header>

<nav class="toc" aria-label="ניווט מהיר">
  <a href="#what">מה זה שערוך</a>
  <a href="#open">איך נכנסים</a>
  <a href="#classes">כיתות ותלמידים</a>
  <a href="#income">הכנסות</a>
  <a href="#results">התוצאה מיד</a>
  <a href="#save">שמירת תרחיש</a>
  <a href="#faq">שאלות נפוצות</a>
</nav>

<h2 id="what">🎯 מה המסך הזה עושה</h2>
<div class="card">
  <p>
    מסך <b>שערוך תקציב</b> נותן לשחק עם המספרים ולראות <b>מיד</b> את ההשפעה על התקציב —
    בלי לגעת בשום נתון אמיתי. מושלם לבדוק החלטה לפני שמקבלים אותה:
    מה יקרה אם ייכנסו עוד תלמידים? אם נפתח כיתה נוספת? אם תעריף משרד החינוך ישתנה?
  </p>
  <div class="tip">💡 <b>שום נתון אמיתי לא משתנה כאן</b> — זה מגרש משחקים בטוח. משנים כמה שרוצים בלי חשש, ומה שבונים נשמר רק אם לוחצים "שמירת תרחיש".</div>
</div>

<h2 id="open">🚪 איך נכנסים למסך</h2>
<div class="card">
  <ol class="steps">
    <li>נכנסים למערכת כרגיל (Google או אימייל+סיסמה).</li>
    <li>בתפריט (בצד או תחת "עוד" בטלפון) לוחצים על <b>שערוך תקציב</b> — האייקון 🧪.</li>
  </ol>
  <figure class="shot">
    <img src="${img('1-header.png')}" alt="ראש מסך שערוך תקציב" />
    <figcaption>ראש המסך — שם התרחיש הפעיל ושני כפתורים: שמירת תרחיש ואיפוס</figcaption>
  </figure>
</div>

<h2 id="classes"><span class="stepnum">1</span> משנים כיתות ותלמידים</h2>
<div class="card">
  <p>שני מחוונים ראשונים: כמה תלמידים משתנה בכל כיתה, וכמה כיתות חדשות מוסיפים. גוררים — והמספר בכותרת מתעדכן מיד.</p>
  <figure class="shot">
    <img src="${img('2-classes-sliders.png')}" alt="מחווני כיתות ותלמידים" />
    <figcaption>כאן הוספנו 5 תלמידים לכל כיתה + כיתה חדשה אחת</figcaption>
  </figure>
</div>

<h2 id="income"><span class="stepnum">2</span> משנים הכנסות והוצאות</h2>
<div class="card">
  <p>מתחת, אותו עיקרון להכנסה לתלמיד, תוספת ותעריף משרד החינוך, והכנסות/הוצאות חד-פעמיות (למשל תרומה גדולה שמתוכננת, או הוצאה גדולה צפויה).</p>
  <figure class="shot">
    <img src="${img('3-income-sliders.png')}" alt="מחווני הכנסות" />
    <figcaption>מחווני ההכנסות — אותו עיקרון בדיוק</figcaption>
  </figure>
</div>

<h2 id="results"><span class="stepnum">3</span> רואים את התוצאה מיד</h2>
<div class="card">
  <p>בצד (או מתחת בטלפון) שתי כרטיסיות משוות: <b>מצב נוכחי</b> מול <b>סימולציה</b> — כל אחת עם פס הכנסות/הוצאות והיתרה.</p>
  <figure class="shot">
    <img src="${img('4-current-state.png')}" alt="מצב נוכחי" />
    <figcaption>מצב נוכחי — התקציב האמיתי כמו שהוא היום</figcaption>
  </figure>
  <figure class="shot">
    <img src="${img('5-simulated-state.png')}" alt="מצב מדומה" />
    <figcaption>סימולציה — איך התקציב נראה עם השינויים שהזנו</figcaption>
  </figure>
  <p>ומתחת — סיכום השינוי המשוער בהכנסות, בהוצאות, ובהשפעה הכוללת על היתרה:</p>
  <figure class="shot">
    <img src="${img('6-delta-summary.png')}" alt="סיכום שינוי משוער" />
    <figcaption>שינוי משוער — ההשפעה הכוללת על היתרה, בירוק או באדום</figcaption>
  </figure>
</div>

<h2 id="save"><span class="stepnum">4</span> שומרים תרחיש</h2>
<div class="card">
  <p>בנית תקציב שמוצא חן בעינייך? אין צורך לזכור את המספרים — שומרים אותו בשם, וחוזרים אליו בכל רגע.</p>
  <ol class="steps">
    <li>לוחצים <b>"שמירת תרחיש"</b> למעלה.</li>
    <li>נותנים שם ברור (למשל "תקציב עם כיתה נוספת") ולוחצים <b>שמור</b>.</li>
  </ol>
  <figure class="shot">
    <img src="${img('7-save-modal.png')}" alt="חלון שמירת תרחיש" />
    <figcaption>חלון שמירת תרחיש</figcaption>
  </figure>
  <p>התרחיש מופיע ברשימה למעלה — אפשר <b>לטעון</b> אותו בחזרה (📂), או <b>למחוק</b> (🗑️). "איפוס" מחזיר הכל להתחלה.</p>
  <figure class="shot">
    <img src="${img('8-saved-scenarios.png')}" alt="רשימת תרחישים שמורים" />
    <figcaption>תרחישים שמורים — טעינה או מחיקה בלחיצה אחת</figcaption>
  </figure>
  <div class="good">✅ אפשר לשמור כמה תרחישים שרוצים ולהשוות ביניהם — כלי נהדר לישיבת הנהלה או לתכנון שנה הבאה.</div>
</div>

<h2 id="faq">❓ שאלות נפוצות</h2>
<table class="faq">
  <tr><th>אם אני משנה משהו כאן, זה משפיע על התקציב האמיתי?</th><td>לא, לעולם לא. שערוך תקציב הוא מגרש משחקים נפרד לגמרי. הנתון האמיתי היחיד שנשמר הוא תרחיש שבחרתם לשמור בשם, ואפשר למחוק אותו בכל רגע.</td></tr>
  <tr><th>מי רואה את התרחישים ששמרתי?</th><td>כל בעלי הגישה למסך הזה בבית הספר שלכם — כלי משותף להנהלה.</td></tr>
  <tr><th>מסך שערוך תקציב לא מופיע אצלי</th><td>הוא זמין רק במצב "תקציב מלא" (לא ב"מעקב פשוט"). אם חסר — בודקים בהגדרות ← בית הספר ← "אופן העבודה", או פונים לשרה.</td></tr>
  <tr><th>לחצתי איפוס בטעות</th><td>שום בעיה — זה רק מחזיר את המחוונים להתחלה. תרחישים ששמרתם קודם לא נמחקים.</td></tr>
</table>

<div class="contact">
  <p style="font-size:17px;font-weight:800;margin-bottom:6px">נתקעתם? יש שאלה? אנחנו כאן 🙋</p>
  <p style="opacity:.85;margin-bottom:10px">אין שאלה "מיותרת" — עדיף לשאול מאשר להתלבט לבד.</p>
  <a href="tel:0503339770">שרה הגר · 0503339770</a>
</div>

<footer>
  <p>יעוץ ארגוני | פתרונות דיגיטליים · מהבנת הארגון לפתרון שעובד.</p>
</footer>

</div>
</body>
</html>
`;

fs.writeFileSync('public/simulation-guide.html', html);
console.log('simulation-guide.html written,', Math.round(html.length / 1024), 'KB');
