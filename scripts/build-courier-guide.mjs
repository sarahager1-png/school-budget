// Generate public/courier-guide.html with the screenshots embedded as base64.
import fs from 'fs';

const SHOTS = 'C:/tmp/courier-shots';
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${SHOTS}/${f}`).toString('base64')}`;

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>מדריך לשליח — בקשות תשלום</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Heebo', sans-serif; background: #F0F4F8; color: #1E293B; line-height: 1.7; font-size: 16px; }
  .page { max-width: 720px; margin: 0 auto; padding: 24px 20px 60px; }
  header.hero {
    background: linear-gradient(135deg, #1E0A3C 0%, #0B3B47 60%, #0FA3B1 100%);
    color: #fff; border-radius: 20px; padding: 34px 26px; margin-bottom: 26px; text-align: center;
  }
  header.hero .emoji { font-size: 44px; }
  header.hero h1 { font-size: 28px; font-weight: 900; margin: 8px 0 4px; }
  header.hero p { color: rgba(255,255,255,.78); font-size: 15px; }
  .print-btn {
    display: inline-block; margin-top: 16px; background: #fff; color: #0B3B47;
    border: none; border-radius: 12px; padding: 10px 22px; font-family: inherit;
    font-size: 15px; font-weight: 700; cursor: pointer;
  }
  h2 {
    font-size: 20px; font-weight: 900; color: #1E0A3C;
    margin: 34px 0 12px; padding-bottom: 6px; border-bottom: 3px solid #0FA3B1;
  }
  p, li { color: #334155; font-size: 15px; }
  .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px 20px; margin: 12px 0; }
  .flow { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin: 14px 0 4px; }
  .flow .st {
    padding: 8px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; white-space: nowrap;
  }
  .flow .arrow { align-self: center; color: #94A3B8; font-weight: 900; }
  .steps { counter-reset: step; list-style: none; }
  .steps li { counter-increment: step; position: relative; padding-right: 42px; margin: 10px 0; }
  .steps li::before {
    content: counter(step); position: absolute; right: 0; top: 1px;
    width: 28px; height: 28px; border-radius: 50%; background: #0FA3B1; color: #fff;
    font-weight: 900; font-size: 14px; display: flex; align-items: center; justify-content: center;
  }
  .shot { text-align: center; margin: 16px 0; }
  .shot img {
    max-width: 300px; width: 100%; border-radius: 18px;
    box-shadow: 0 10px 30px rgba(30,10,60,.18); border: 1px solid #E2E8F0;
  }
  .shot.wide img { max-width: 420px; }
  .shot figcaption { font-size: 13px; color: #64748B; margin-top: 8px; }
  .tip { background: #F3E8FF; border: 1px solid #E9D5FF; border-radius: 12px; padding: 12px 16px; margin: 12px 0; font-size: 14px; color: #6B21A8; }
  .warn { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; padding: 12px 16px; margin: 12px 0; font-size: 14px; color: #9A3412; }
  .stepnum {
    display: inline-flex; align-items: center; justify-content: center;
    background: #0FA3B1; color: #fff; border-radius: 999px; font-weight: 900;
    width: 30px; height: 30px; margin-left: 8px; font-size: 15px; vertical-align: middle;
  }
  table.faq { width: 100%; border-collapse: collapse; background: #fff; border-radius: 14px; overflow: hidden; }
  table.faq th, table.faq td { border: 1px solid #E2E8F0; padding: 10px 14px; text-align: right; font-size: 14px; vertical-align: top; }
  table.faq th { background: #F8FAFC; font-weight: 700; width: 42%; }
  footer { text-align: center; margin-top: 44px; color: #94A3B8; font-size: 13px; }
  @media print {
    body { background: #fff; font-size: 13px; }
    .page { padding: 0; max-width: none; }
    .print-btn { display: none; }
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
  <div class="emoji">📦</div>
  <h1>מדריך לשליח</h1>
  <p>ביצוע בקשות תשלום — כל מה שצריך לדעת ב-5 דקות</p>
  <button class="print-btn" onclick="window.print()">🖨️ הדפסת המדריך</button>
</header>

<h2>🎯 התפקיד שלך במשפט אחד</h2>
<div class="card">
  <p>
    המנהלת שולחת לך מהמערכת בקשות תשלום — קנייה, תשלום לספק, הזמנה.
    אתה מבצע, מעלה צילום קבלה, ומסמן שהסתיים. המנהלת רואה הכל בזמן אמת,
    בלי טלפונים ובלי פתקים.
  </p>
  <div class="flow">
    <span class="st" style="background:#FEF9C3;color:#854D0E">⏳ ממתין</span>
    <span class="arrow">←</span>
    <span class="st" style="background:#CCFBF1;color:#0F766E">▶️ בביצוע</span>
    <span class="arrow">←</span>
    <span class="st" style="background:#DBEAFE;color:#1D4ED8">💸 שולם</span>
    <span class="arrow">←</span>
    <span class="st" style="background:#DCFCE7;color:#15803D">✅ הושלם</span>
  </div>
</div>

<h2>🚪 כניסה למערכת</h2>
<div class="card">
  <ol class="steps">
    <li>פותחים את כתובת האתר של בית הספר (מקבלים אותה מהמנהלת בוואטסאפ).</li>
    <li>לוחצים <b>"המשך עם Google"</b> ובוחרים את החשבון שלך — וזהו.</li>
    <li>קיבלת אימייל וסיסמה במקום? לוחצים "כניסה עם אימייל וסיסמה" וממלאים.</li>
  </ol>
  <figure class="shot">
    <img src="${img('1-login.png')}" alt="מסך הכניסה למערכת" />
    <figcaption>מסך הכניסה</figcaption>
  </figure>
  <div class="tip">💡 <b>שווה זהב:</b> להוסיף את המערכת למסך הבית של הטלפון — פותחים את האתר, תפריט הדפדפן ⋮ ← <b>"הוספה למסך הבית"</b>. מעכשיו זו אפליקציה בלחיצה אחת.</div>
</div>

<h2>🏠 המסך שלך</h2>
<div class="card">
  <p>אחרי הכניסה מגיעים ישר למסך הבקשות. למעלה — ספירה לפי מצב: כמה ממתינות לך, כמה בביצוע, כמה שולמו והושלמו. מתחת — כל בקשה בכרטיס משלה.</p>
  <figure class="shot">
    <img src="${img('2-home.png')}" alt="מסך הבקשות של השליח" />
    <figcaption>מסך הבקשות — הספירה למעלה, הכרטיסים מתחת</figcaption>
  </figure>
  <p>🔔 הפעמון למעלה מראה כמה בקשות חדשות ממתינות לך. הלשוניות (הכל / ממתין / בביצוע...) מסננות את הרשימה.</p>
</div>

<h2><span class="stepnum">1</span> קיבלת בקשה חדשה</h2>
<div class="card">
  <p>בקשה חדשה מגיעה עם תג צהוב <b>"ממתין"</b>. בכרטיס רואים: מה לקנות או לשלם, את הסכום, והערות מהמנהלת (איפה, למי, איך).</p>
  <figure class="shot">
    <img src="${img('3-pending-card.png')}" alt="כרטיס בקשה ממתינה" />
    <figcaption>בקשה ממתינה — קוראים את ההערות ולוחצים על הכפתור</figcaption>
  </figure>
  <ol class="steps">
    <li>קוראים את כל הפרטים וההערות.</li>
    <li>לוחצים <b>"התחל ביצוע"</b> — זה מעדכן את המנהלת שאתה על זה.</li>
  </ol>
</div>

<h2><span class="stepnum">2</span> ביצעת? מעלים קבלה</h2>
<div class="card">
  <p>הבקשה עברה לתג <b>"בביצוע"</b>. יוצאים, קונים או משלמים — ושומרים את הקבלה!</p>
  <figure class="shot">
    <img src="${img('4-inprogress-card.png')}" alt="כרטיס בקשה בביצוע" />
    <figcaption>בביצוע — אחרי התשלום לוחצים "העלה קבלה"</figcaption>
  </figure>
  <ol class="steps">
    <li>מצלמים את הקבלה עם מצלמת הטלפון (או שומרים חשבונית PDF).</li>
    <li>בכרטיס לוחצים <b>"העלה קבלה"</b>.</li>
    <li>לוחצים על אזור הקובץ, בוחרים את הצילום, ואפשר להוסיף הערה.</li>
    <li>לוחצים <b>"העלה וסמן שולם"</b>.</li>
  </ol>
  <figure class="shot">
    <img src="${img('5-receipt-modal.png')}" alt="חלון העלאת קבלה" />
    <figcaption>חלון העלאת הקבלה</figcaption>
  </figure>
  <div class="warn">⚠️ הקבלה חשובה — היא נשמרת במערכת ומשמשת את המנהלת להנהלת החשבונות. בלי קבלה אין אסמכתא להוצאה.</div>
</div>

<h2><span class="stepnum">3</span> נמסר? מסמנים הושלם</h2>
<div class="card">
  <p>אחרי שהקבלה הועלתה התג הופך ל<b>"שולם"</b>. כשהמוצר נמסר בפועל / העניין נסגר עד הסוף — לוחצים <b>"סמן הושלם"</b>.</p>
  <figure class="shot">
    <img src="${img('6-paid-card.png')}" alt="כרטיס בקשה ששולמה" />
    <figcaption>שולם — נשארה לחיצה אחת אחרונה</figcaption>
  </figure>
  <p>וזה נראה ככה כשהכל סגור — כל השלבים ירוקים:</p>
  <figure class="shot">
    <img src="${img('7-completed-card.png')}" alt="בקשה שהושלמה" />
    <figcaption>✅ הבקשה הושלמה — כל הכבוד!</figcaption>
  </figure>
</div>

<h2>❓ שאלות נפוצות</h2>
<table class="faq">
  <tr><th>אילו בקשות אני רואה?</th><td>רק את הבקשות ששויכו אליך. אף אחד אחר לא יכול לעדכן אותן חוץ ממך ומהמנהלת.</td></tr>
  <tr><th>שילמתי אבל אין לי קבלה ביד</th><td>אפשר לבקש מהספק צילום קבלה בוואטסאפ ולהעלות את זה. העיקר שתהיה אסמכתא.</td></tr>
  <tr><th>לחצתי בטעות על כפתור</th><td>שום דבר לא נשבר — מעדכנים את המנהלת והיא מסדרת את הסטטוס.</td></tr>
  <tr><th>איפה בקשות ישנות שסיימתי?</th><td>בלשונית <b>"הושלם"</b> למעלה — הכל נשמר, כולל הקבלות.</td></tr>
  <tr><th>כתוב לי "החשבון עדיין לא חובר לבית הספר"</th><td>החשבון שלך עוד לא הוגדר במערכת — פונים לשרה הגר · 0503339770 וזה מסודר בדקה.</td></tr>
  <tr><th>נתקעתי / משהו לא עובד</th><td>שרה הגר · 0503339770 — תמיד שמחה לעזור.</td></tr>
</table>

<footer>
  <p>בנוי ופיתוח: שרה הגר · 0503339770</p>
  <p>יעוץ ארגוני | פתרונות דיגיטליים · מהבנת הארגון לפתרון שעובד.</p>
</footer>

</div>
</body>
</html>
`;

fs.writeFileSync('public/courier-guide.html', html);
console.log('courier-guide.html written,', Math.round(html.length / 1024), 'KB');
