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

  /* ניווט מהיר */
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
  .flow { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin: 16px 0 4px; }
  .flow .st {
    padding: 9px 15px; border-radius: 999px; font-weight: 700; font-size: 14px; white-space: nowrap;
  }
  .flow .arrow { align-self: center; color: #94A3B8; font-weight: 900; }
  .steps { counter-reset: step; list-style: none; }
  .steps li { counter-increment: step; position: relative; padding-right: 44px; margin: 12px 0; }
  .steps li::before {
    content: counter(step); position: absolute; right: 0; top: 1px;
    width: 30px; height: 30px; border-radius: 50%; background: #00B4CC; color: #fff;
    font-weight: 900; font-size: 14px; display: flex; align-items: center; justify-content: center;
  }
  .checklist { list-style: none; }
  .checklist li { position: relative; padding-right: 30px; margin: 8px 0; }
  .checklist li::before { content: '☐'; position: absolute; right: 0; color: #4B2E83; font-size: 18px; }
  .shot { text-align: center; margin: 18px 0; }
  .shot img {
    max-width: 300px; width: 100%; border-radius: 20px;
    box-shadow: 0 12px 32px rgba(75,46,131,.20); border: 1px solid #E2DCF0;
  }
  .shot.wide img { max-width: 440px; }
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
  <div class="emoji">📦</div>
  <h1>מדריך לשליח</h1>
  <p>ביצוע בקשות תשלום — צעד-אחר-צעד, עם תמונות מהמערכת</p>
  <button class="print-btn" onclick="window.print()">🖨️ הדפסת המדריך</button>
</header>

<nav class="toc" aria-label="ניווט מהיר">
  <a href="#role">התפקיד שלי</a>
  <a href="#before">לפני שמתחילים</a>
  <a href="#login">כניסה למערכת</a>
  <a href="#home">המסך שלי</a>
  <a href="#step1">קבלת בקשה</a>
  <a href="#step2">ביצוע והעלאת קבלה</a>
  <a href="#step3">סיום</a>
  <a href="#faq">שאלות נפוצות</a>
</nav>

<h2 id="role">🎯 התפקיד שלך במשפט אחד</h2>
<div class="card">
  <p>
    המנהלת שולחת לך מהמערכת בקשות תשלום — קנייה, תשלום לספק, הזמנה.
    אתה מבצע, מעלה צילום קבלה, ומסמן שהסתיים. המנהלת רואה הכל בזמן אמת,
    בלי טלפונים ובלי פתקים לאיבוד. כל בקשה עוברת ארבעה שלבים ברורים:
  </p>
  <div class="flow">
    <span class="st" style="background:#FEF9C3;color:#854D0E">⏳ ממתין</span>
    <span class="arrow">←</span>
    <span class="st" style="background:#E5F8FB;color:#00849A">▶️ בביצוע</span>
    <span class="arrow">←</span>
    <span class="st" style="background:#DBEAFE;color:#1D4ED8">💸 שולם</span>
    <span class="arrow">←</span>
    <span class="st" style="background:#DCFCE7;color:#15803D">✅ הושלם</span>
  </div>
  <p style="margin-top:14px">
    <b>חשוב לדעת:</b> אתה רואה במערכת <u>רק</u> את הבקשות ששויכו אליך — לא את כל תקציב בית הספר.
    זה מסך פשוט, מיועד בדיוק לתפקיד שלך.
  </p>
</div>

<h2 id="before">✅ לפני שמתחילים</h2>
<div class="card">
  <ul class="checklist">
    <li>יש לי טלפון עם אינטרנט ומצלמה — זה כל מה שצריך.</li>
    <li>קיבלתי מהמנהלת את כתובת האתר של בית הספר (בוואטסאפ).</li>
    <li>אני יודע/ת אם אני נכנס/ת עם Google או עם אימייל+סיסמה (המנהלת תגיד לי).</li>
  </ul>
</div>

<h2 id="login">🚪 כניסה למערכת</h2>
<div class="card">
  <ol class="steps">
    <li>פותחים בדפדפן של הטלפון או המחשב את כתובת האתר של בית הספר.</li>
    <li>אם יש כפתור <b>"המשך עם Google"</b> — לוחצים עליו ובוחרים את חשבון הג'ימייל שלכם. זהו, נכנסתם, בלי סיסמה.</li>
    <li>אין כפתור Google? לוחצים <b>"כניסה עם אימייל וסיסמה"</b> וממלאים את הפרטים שקיבלתם.</li>
  </ol>
  <figure class="shot">
    <img src="${img('1-login.png')}" alt="מסך הכניסה למערכת" />
    <figcaption>מסך הכניסה</figcaption>
  </figure>
  <div class="tip">💡 <b>שווה זהב — עושים פעם אחת:</b> אחרי הכניסה, בתפריט הדפדפן (⋮ או שיתוף ⬆️) בוחרים <b>"הוספה למסך הבית"</b>. מאותו רגע יש אייקון על הטלפון כמו כל אפליקציה — פותחים בלחיצה אחת, בלי לחפש כתובות.</div>
  <div class="warn">⚠️ אם מופיעה הודעה שהחשבון "עדיין לא חובר לבית הספר" — זה לא תקלה אצלכם. פונים לשרה הגר (למטה) והיא מחברת את החשבון תוך דקה.</div>
</div>

<h2 id="home">🏠 המסך שלי</h2>
<div class="card">
  <p>אחרי הכניסה מגיעים ישר למסך הבקשות — זה המסך היחיד שאתם צריכים. למעלה רואים ספירה לפי מצב: כמה ממתינות, כמה בביצוע, כמה שולמו והושלמו. מתחת — כל בקשה בכרטיס נפרד, עם כל הפרטים.</p>
  <figure class="shot">
    <img src="${img('2-home.png')}" alt="מסך הבקשות של השליח" />
    <figcaption>מסך הבקשות — הספירה למעלה, הכרטיסים מתחת</figcaption>
  </figure>
  <p>🔔 <b>הפעמון</b> למעלה מראה כמה בקשות חדשות ממתינות לכם — מספר עגול וצבעוני שאי אפשר לפספס.</p>
  <p>📑 <b>הלשוניות</b> (הכל / ממתין / בביצוע / שולם / הושלם) מסננות את הרשימה — נוח כשיש הרבה בקשות ורוצים לראות רק אחד הסוגים.</p>
</div>

<h2 id="step1"><span class="stepnum">1</span> קיבלת בקשה חדשה</h2>
<div class="card">
  <p>בקשה חדשה מגיעה עם תג צהוב <b>"ממתין"</b>. בכרטיס רואים הכל: מה לקנות או לשלם, את הסכום, ותאריך היצירה. שימו לב במיוחד להערות מהמנהלת — שם בדרך כלל כתוב איפה לקנות, למי לשלם ואיך.</p>
  <figure class="shot">
    <img src="${img('3-pending-card.png')}" alt="כרטיס בקשה ממתינה" />
    <figcaption>בקשה ממתינה — קוראים את ההערות ולוחצים על הכפתור</figcaption>
  </figure>
  <ol class="steps">
    <li>קוראים את כל הפרטים וההערות בעיון.</li>
    <li>לוחצים <b>"התחל ביצוע"</b> — הכרטיס עובר לצבע תכלת, והמנהלת רואה מיד שאתם טיפלתם בזה.</li>
  </ol>
  <div class="tip">💡 לא בטוחים במשהו לפני שיוצאים לקנות? עדיף להתקשר או לשלוח וואטסאפ למנהלת <u>לפני</u> שלוחצים "התחל ביצוע" — כך אין עיכוב אחרי שכבר התחלתם.</div>
</div>

<h2 id="step2"><span class="stepnum">2</span> ביצעת? מעלים קבלה</h2>
<div class="card">
  <p>הבקשה עכשיו בתג <b>"בביצוע"</b>. יוצאים, קונים או משלמים — והצעד הכי חשוב: <u>שומרים את הקבלה או החשבונית</u>. בלעדיה אי אפשר לסיים את הבקשה.</p>
  <figure class="shot">
    <img src="${img('4-inprogress-card.png')}" alt="כרטיס בקשה בביצוע" />
    <figcaption>בביצוע — אחרי התשלום לוחצים "העלה קבלה"</figcaption>
  </figure>
  <ol class="steps">
    <li>מצלמים את הקבלה עם מצלמת הטלפון (אפשר גם קובץ PDF של חשבונית דיגיטלית).</li>
    <li>בכרטיס לוחצים <b>"העלה קבלה"</b>.</li>
    <li>בחלון שנפתח לוחצים על אזור הריבוע עם החץ, ובוחרים את התמונה מהגלריה.</li>
    <li>אפשר (לא חובה) להוסיף הערה — למשל אם היה שינוי קטן ממה שביקשו.</li>
    <li>לוחצים <b>"העלה וסמן שולם"</b> — וזהו, הקבלה נשמרת אוטומטית במערכת.</li>
  </ol>
  <figure class="shot">
    <img src="${img('5-receipt-modal.png')}" alt="חלון העלאת קבלה" />
    <figcaption>חלון העלאת הקבלה</figcaption>
  </figure>
  <div class="warn">⚠️ <b>הקבלה חשובה מאוד</b> — היא נשמרת במערכת ומשמשת את המנהלת להנהלת חשבונות בית הספר. בלי קבלה אין אסמכתא רשמית להוצאה, אז עדיף לצלם ברגע התשלום ולא לסמוך על הזיכרון.</div>
  <div class="good">✅ טעות בקבלה או שכחת להעלות? אין בעיה — אפשר לפנות למנהלת והיא תעזור לתקן. שום דבר לא "נשבר" אם משהו לא מדויק.</div>
</div>

<h2 id="step3"><span class="stepnum">3</span> נמסר? מסמנים הושלם</h2>
<div class="card">
  <p>אחרי העלאת הקבלה התג הופך אוטומטית ל<b>"שולם"</b>. השלב האחרון: כשהמוצר נמסר בפועל בבית הספר, או שהעניין נסגר לגמרי — לוחצים <b>"סמן הושלם"</b>.</p>
  <figure class="shot">
    <img src="${img('6-paid-card.png')}" alt="כרטיס בקשה ששולמה" />
    <figcaption>שולם — נשארה לחיצה אחת אחרונה</figcaption>
  </figure>
  <p>וכך זה נראה כשהכל סגור — כל השלבים ירוקים ומסומנים ב-✓:</p>
  <figure class="shot">
    <img src="${img('7-completed-card.png')}" alt="בקשה שהושלמה" />
    <figcaption>✅ הבקשה הושלמה — כל הכבוד!</figcaption>
  </figure>
  <p>בקשות שהושלמו לא נעלמות — הן עוברות ללשונית <b>"הושלם"</b> למעלה, ואפשר לחזור ולראות אותן (וגם את הקבלה) מתי שרוצים.</p>
</div>

<h2 id="faq">❓ שאלות נפוצות</h2>
<table class="faq">
  <tr><th>אילו בקשות אני רואה?</th><td>רק את הבקשות ששויכו אליך אישית. אף שליח אחר לא רואה אותן, ואף אחד חוץ ממך ומהמנהלת לא יכול לעדכן אותן.</td></tr>
  <tr><th>שילמתי אבל אין לי קבלה ביד</th><td>אפשר לבקש מהספק צילום קבלה בוואטסאפ ולהעלות אותו במקום. העיקר שתהיה אסמכתא כלשהי לתשלום.</td></tr>
  <tr><th>לחצתי בטעות על כפתור לא נכון</th><td>שום דבר לא נשבר ואי אפשר "לקלקל" את המערכת. פשוט מעדכנים את המנהלת בוואטסאפ והיא מסדרת את הסטטוס הנכון.</td></tr>
  <tr><th>איפה בקשות ישנות שכבר סיימתי?</th><td>בלשונית <b>"הושלם"</b> למעלה במסך — הכל נשמר שם לצמיתות, כולל הקבלות שהעליתם.</td></tr>
  <tr><th>אפשר להעלות כמה קבלות לאותה בקשה?</th><td>המערכת שומרת קובץ אחד לבקשה. אם יש כמה קבלות — הכי נוח לצלם את כולן יחד בתמונה אחת ברורה, או לשלוח את הנוספות למנהלת בוואטסאפ.</td></tr>
  <tr><th>המערכת לא נטענת / איטית</th><td>בדקו חיבור אינטרנט, ונסו לרענן את הדף (משיכה למטה בטלפון, או F5 במחשב). אם זה נמשך — פנו לשרה.</td></tr>
  <tr><th>כתוב לי "החשבון עדיין לא חובר לבית הספר"</th><td>החשבון שלכם עוד לא הוגדר במערכת מהצד האחורי. פונים לשרה הגר (למטה) וזה מסודר תוך דקות.</td></tr>
  <tr><th>שכחתי את הסיסמה</th><td>אם יש כפתור "המשך עם Google" — הכי פשוט להשתמש בו ולדלג על סיסמאות לגמרי. אחרת פונים לשרה לאיפוס.</td></tr>
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

fs.writeFileSync('public/courier-guide.html', html);
console.log('courier-guide.html written,', Math.round(html.length / 1024), 'KB');
