// Generate public/system-guide.html — the full-system photographed guide, with all
// screenshots embedded as base64. Covers every screen a user sees in the system.
import fs from 'fs';

const SHOTS = 'C:/tmp/system-shots';
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${SHOTS}/${f}`).toString('base64')}`;

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>מדריך כולל — מערכת ניהול תקציב</title>
<link rel="icon" type="image/png" href="/favicon.png" />
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'Heebo', sans-serif; background: #F8F7FB; color: #1A0B35; line-height: 1.75; font-size: 16px; }
  .page { max-width: 780px; margin: 0 auto; padding: 24px 20px 60px; }
  header.hero {
    background: linear-gradient(135deg, #1A0B35 0%, #3D2570 60%, #00B4CC 100%);
    color: #fff; border-radius: 24px; padding: 40px 28px; margin-bottom: 20px; text-align: center;
  }
  header.hero .emoji { font-size: 50px; }
  header.hero h1 { font-size: 31px; font-weight: 900; margin: 10px 0 6px; }
  header.hero p { color: rgba(255,255,255,.82); font-size: 16px; }
  .print-btn {
    display: inline-block; margin-top: 18px; background: #fff; color: #3D2570;
    border: none; border-radius: 12px; padding: 11px 24px; font-family: inherit;
    font-size: 15px; font-weight: 700; cursor: pointer;
  }
  nav.toc {
    display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    background: #fff; border: 1px solid #E2DCF0; border-radius: 16px; padding: 14px; margin-bottom: 28px;
  }
  nav.toc a {
    text-decoration: none; color: #4B2E83; background: #F0EDF8;
    padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;
  }
  h2 {
    font-size: 22px; font-weight: 900; color: #1A0B35;
    margin: 40px 0 12px; padding-bottom: 7px; border-bottom: 3px solid #00B4CC;
    display: flex; align-items: center; gap: 10px; scroll-margin-top: 16px;
  }
  h2 .n {
    display: inline-flex; align-items: center; justify-content: center;
    background: #3D2570; color: #fff; border-radius: 12px; font-weight: 900;
    width: 34px; height: 34px; font-size: 16px; flex-shrink: 0;
  }
  p, li { color: #3A3450; font-size: 15.5px; }
  .card { background: #fff; border: 1px solid #E2DCF0; border-radius: 18px; padding: 20px 22px; margin: 12px 0;
    box-shadow: 0 2px 12px rgba(75,46,131,.06); }
  .lead { font-size: 16.5px; }
  ul.bullets { list-style: none; margin-top: 8px; }
  ul.bullets li { position: relative; padding-right: 22px; margin: 6px 0; }
  ul.bullets li::before { content: '•'; position: absolute; right: 0; color: #00B4CC; font-weight: 900; font-size: 18px; }
  .shot { text-align: center; margin: 18px 0; }
  .shot img { max-width: 320px; width: 100%; border-radius: 22px; box-shadow: 0 12px 32px rgba(75,46,131,.20); border: 1px solid #E2DCF0; }
  .shot figcaption { font-size: 13px; color: #8878AA; margin-top: 10px; }
  .tip { background: #F0EDF8; border: 1px solid #D0C5F0; border-radius: 14px; padding: 14px 18px; margin: 14px 0; font-size: 14.5px; color: #3D2570; }
  .good { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 14px; padding: 14px 18px; margin: 14px 0; font-size: 14.5px; color: #065F46; }
  .role { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 14px; padding: 14px 18px; margin: 14px 0; font-size: 14.5px; color: #9A3412; }
  table.faq { width: 100%; border-collapse: collapse; background: #fff; border-radius: 16px; overflow: hidden; }
  table.faq th, table.faq td { border: 1px solid #E2DCF0; padding: 12px 16px; text-align: right; font-size: 14.5px; vertical-align: top; }
  table.faq th { background: #F8F7FB; font-weight: 700; width: 42%; color: #1A0B35; }
  .contact { background: linear-gradient(135deg, #1A0B35, #3D2570); color: #fff; border-radius: 20px; padding: 24px; text-align: center; margin-top: 30px; }
  .contact a { color: #fff; font-weight: 800; text-decoration: none; }
  footer { text-align: center; margin-top: 30px; color: #8878AA; font-size: 13px; }
  @media print {
    body { background: #fff; font-size: 13px; }
    .page { padding: 0; max-width: none; }
    .print-btn, nav.toc { display: none; }
    header.hero { border-radius: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { break-after: avoid; }
    .card, .shot { break-inside: avoid; }
    .shot img { max-width: 210px; }
  }
</style>
</head>
<body>
<div class="page">

<header class="hero">
  <div class="emoji">📘</div>
  <h1>מדריך כולל למערכת התקציב</h1>
  <p>סיור מלא בכל המסכים — צעד-אחר-צעד, עם תמונות מהמערכת</p>
  <button class="print-btn" onclick="window.print()">🖨️ הדפסת המדריך</button>
</header>

<nav class="toc" aria-label="ניווט מהיר">
  <a href="#intro">מה זה</a>
  <a href="#login">כניסה</a>
  <a href="#dashboard">דף הבית</a>
  <a href="#classes">כיתות</a>
  <a href="#income">הכנסות</a>
  <a href="#tuition">גבייה</a>
  <a href="#expenses">הוצאות</a>
  <a href="#requests">בקשות תשלום</a>
  <a href="#salaries">משכורות</a>
  <a href="#sim">שערוך תקציב</a>
  <a href="#reports">דוחות</a>
  <a href="#faq">שאלות</a>
</nav>

<h2 id="intro">🎯 מה המערכת עושה</h2>
<div class="card">
  <p class="lead">
    המערכת מרכזת במקום אחד את כל התמונה הכספית של בית החינוך: כמה נכנס, כמה יוצא, ומה נשאר —
    גם בטלפון וגם במחשב. במקום אקסלים ופתקים, רושמים פעם אחת והמערכת מחשבת, מסכמת ומציגה הכל לבד.
  </p>
  <div class="role">
    👀 <b>מה רואים ומי עורך:</b> כל בעל/ת גישה למערכת — כולל שליח — יכול/ה <b>לראות את כל המסכים ואת כל התמונה הכספית</b>.
    <b>עריכה</b> (הוספה, שינוי ומחיקה) שמורה למנהלת/הנהלה בלבד. כלומר: אתם רואים הכל, ומי שאחראי על הרישום הוא מי שמזין.
  </div>
</div>

<h2 id="login">🚪 כניסה למערכת</h2>
<div class="card">
  <ul class="bullets">
    <li>פותחים בדפדפן את כתובת האתר של בית החינוך (קיבלתם בהודעה נפרדת).</li>
    <li>אם יש כפתור <b>"המשך עם Google"</b> — לוחצים ובוחרים את חשבון הג'ימייל. זהו, בלי סיסמה.</li>
    <li>אחרת בוחרים <b>"כניסה עם אימייל וסיסמה"</b> וממלאים את הפרטים שקיבלתם.</li>
  </ul>
  <figure class="shot"><img src="${img('0-login.png')}" alt="מסך הכניסה" /><figcaption>מסך הכניסה</figcaption></figure>
  <div class="tip">💡 <b>עושים פעם אחת:</b> בתפריט הדפדפן בוחרים "הוספה למסך הבית" — ומאותו רגע יש אייקון על הטלפון, נכנסים בלחיצה אחת.</div>
</div>

<h2 id="dashboard"><span class="n">1</span> דף הבית</h2>
<div class="card">
  <p>מבט-על מהיר: סך ההכנסות, סך ההוצאות, פער עלות ההוראה, והיתרה השנתית. אם משהו אדום — יש גירעון. מתחת יש גם גרף הכנסות מול הוצאות.</p>
  <figure class="shot"><img src="${img('1-dashboard.png')}" alt="דף הבית" /><figcaption>דף הבית — כל המספרים הגדולים במבט אחד</figcaption></figure>
</div>

<h2 id="classes"><span class="n">2</span> כיתות</h2>
<div class="card">
  <p>רשימת הכיתות ומספר התלמידים בכל אחת. לחיצה על כיתה פותחת את כל החשבון שלה — כמה היא מכניסה ממשרד החינוך, כמה היא עולה, ומה היתרה. כאן רואים בדיוק איפה יש עודף ואיפה גירעון.</p>
  <figure class="shot"><img src="${img('2-classes.png')}" alt="מסך כיתות" /><figcaption>כיתות — תלמידים, תקן ויתרה לכל כיתה</figcaption></figure>
</div>

<h2 id="income"><span class="n">3</span> הכנסות</h2>
<div class="card">
  <p>כל הכסף שנכנס: תקציב משרד החינוך (מחושב לבד לפי הכיתות), ומקורות נוספים — תרומות, עירייה, הורים. למעלה יש פירוט לפי מקור, ומתחת טבלה של ההכנסה הצפויה מכל כיתה.</p>
  <figure class="shot"><img src="${img('3-income.png')}" alt="מסך הכנסות" /><figcaption>הכנסות — משרד החינוך + מקורות נוספים</figcaption></figure>
</div>

<h2 id="tuition"><span class="n">4</span> גבייה — שכר לימוד</h2>
<div class="card">
  <p>מעקב שכר לימוד: לכל תלמיד/משפחה רואים כמה צריך, כמה שולם ומה נותר — עם פס התקדמות וסטטוס (שולם / חלקית / טרם). למעלה סיכום כולל וכמה אחוז נגבו מהצפי.</p>
  <figure class="shot"><img src="${img('4-tuition.png')}" alt="מסך גבייה" /><figcaption>גבייה — מי שילם, מי חלקית, ומה נשאר לגבות</figcaption></figure>
</div>

<h2 id="expenses"><span class="n">5</span> הוצאות</h2>
<div class="card">
  <p>כל הכסף שיוצא, מסודר בקטגוריות: שכר, בניין, אירועים, ציוד. הוצאה חודשית נספרת אוטומטית ×12 בסיכום השנתי. למעלה גם "כלל תקציב אירועים" — כמה מוציאים לתלמיד לשנה מול התקרה.</p>
  <figure class="shot"><img src="${img('5-expenses.png')}" alt="מסך הוצאות" /><figcaption>הוצאות — לפי קטגוריה, עם מעקב תקרת אירועים</figcaption></figure>
</div>

<h2 id="requests"><span class="n">6</span> בקשות תשלום</h2>
<div class="card">
  <p>המסך המרכזי לשליח. המנהלת שולחת בקשת תשלום — קנייה, תשלום לספק, הזמנה — והשליח מבצע, מעלה צילום קבלה, ומסמן שהסתיים. כל בקשה עוברת ארבעה שלבים: <b>ממתין ← בביצוע ← שולם ← הושלם</b>.</p>
  <figure class="shot"><img src="${img('6-requests.png')}" alt="מסך בקשות תשלום" /><figcaption>בקשות תשלום — כאן השליח מבצע ומעלה קבלות</figcaption></figure>
  <div class="tip">📦 יש מדריך נפרד מפורט לשליח על ביצוע בקשות תשלום — בכתובת <b>/courier-guide.html</b> באתר.</div>
</div>

<h2 id="salaries"><span class="n">7</span> משכורות</h2>
<div class="card">
  <p>רשימת העובדים והמשכורת של כל אחד. לכל חודש רואים מי קיבל משכורת ומי עוד ממתין, עם סה״כ חודשי וספירת "שולמו / ממתינים". בוחרים חודש בסרגל למעלה.</p>
  <figure class="shot"><img src="${img('7-salaries.png')}" alt="מסך משכורות" /><figcaption>משכורות — סטטוס תשלום לכל עובד/ת, חודש-חודש</figcaption></figure>
</div>

<h2 id="sim"><span class="n">8</span> שערוך תקציב</h2>
<div class="card">
  <p>מגרש משחקים בטוח לבדוק "מה יקרה אם" — עוד תלמידים? כיתה נוספת? שינוי תעריף? מזיזים מחוונים ורואים מיד את ההשפעה על התקציב, <b>בלי לגעת בשום נתון אמיתי</b>. אפשר לשמור תרחישים ולחזור אליהם.</p>
  <figure class="shot"><img src="${img('8-simulation.png')}" alt="מסך שערוך תקציב" /><figcaption>שערוך תקציב — סימולציית "מה יקרה אם"</figcaption></figure>
  <div class="tip">🧪 יש מדריך נפרד מפורט לשערוך תקציב — בכתובת <b>/simulation-guide.html</b> באתר.</div>
</div>

<h2 id="reports"><span class="n">9</span> דוחות</h2>
<div class="card">
  <p>דוח חודשי, דוח לפי כיתות ולפי קטגוריות, וסיכום שנתי — עם ייצוא לאקסל והדפסה. מושלם לישיבת הנהלה או למפקח.</p>
  <figure class="shot"><img src="${img('9-reports.png')}" alt="מסך דוחות" /><figcaption>דוחות — ייצוא והדפסה לישיבות</figcaption></figure>
</div>

<h2 id="faq">❓ שאלות נפוצות</h2>
<table class="faq">
  <tr><th>אני רואה הכל — גם אני יכול/ה לערוך?</th><td>הצפייה פתוחה לכולם; העריכה (הוספה/שינוי/מחיקה) שמורה למנהלת/הנהלה. אם צריך לשנות נתון — פונים למי שאחראי על הרישום.</td></tr>
  <tr><th>"נעלמו לי נתונים"</th><td>כמעט תמיד פשוט נבחרה שנת תקציב אחרת בכפתור למעלה. הנתונים לא נמחקים לבד אף פעם.</td></tr>
  <tr><th>למה יש מסך שאני לא רואה?</th><td>חלק מהמסכים (כמו שערוך תקציב) זמינים רק במצב "תקציב מלא". בבית ספר במצב "מעקב פשוט" הם מוסתרים לכולם.</td></tr>
  <tr><th>מי רואה את הנתונים שלנו?</th><td>רק המשתמשים של בית החינוך שלכם. לכל בית חינוך מסד נתונים נפרד לגמרי.</td></tr>
  <tr><th>שכחתי סיסמה</th><td>אם נכנסים עם Google — אין סיסמה לזכור. אחרת פונים לשרה לאיפוס.</td></tr>
</table>

<div class="contact">
  <p style="font-size:17px;font-weight:800;margin-bottom:6px">יש שאלה? אנחנו כאן 🙋</p>
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

fs.writeFileSync('public/system-guide.html', html);
console.log('system-guide.html written,', Math.round(html.length / 1024), 'KB');
