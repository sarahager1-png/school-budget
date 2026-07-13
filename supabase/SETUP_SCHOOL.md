# הקמת בית ספר חדש — פקודה אחת

המערכת בנויה כ**פרויקט Supabase נפרד לכל בית ספר** + כתובת Surge נפרדת, מאותו קוד.
כל ההקמה אוטומטית:

```bash
# פעם אחת בסשן — טוקן ניהול של Supabase:
set SUPABASE_ACCESS_TOKEN=sbp_...

# הקמה (שם בעברית + slug באנגלית):
node scripts/add-school.mjs "שלהבות נתניה" netanya

# בית ספר בלי ניהול תקציב (מעקב הכנסות/הוצאות בלבד):
node scripts/add-school.mjs "בית חינוך צפת" tzfat --mode simple

# פריסה לאינטרנט:
node scripts/deploy.mjs netanya
```

זהו. בסוף ההקמה מודפסים כתובת האתר ופרטי הכניסה
(ברירת מחדל: `data@reshetch.org.il` / `<slug>2026`).

## מה קורה מאחורי הקלעים

1. נוצר פרויקט Supabase חדש בארגון "שרה הגר" (מוגדר ב-`schools.config.json`)
2. מוחלת הסכימה + כל המיגרציות (`schema.sql`, constants, salaries, v2)
3. seed: בית הספר, שתי שנות תקציב (הנוכחית פעילה), קבועים, 6 קטגוריות הוצאה עם `kind`
4. נכתבים `.env.<slug>` (נכנס ל-git) ו-`.env.<slug>.local` (סודות — לא נכנס)
5. נוצרת משתמשת אדמין ראשונה
6. בית הספר נרשם ב-`schools.config.json`

## פקודות שוטפות

| פעולה | פקודה |
|---|---|
| פריסת בית ספר אחד | `node scripts/deploy.mjs <slug>` |
| פריסת כולם (אחרי עדכון קוד) | `node scripts/deploy.mjs --all` |
| משתמש/ת נוספ/ת לבית ספר | לערוך `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_ROLE` ב-`.env.<slug>.local` ואז `node scripts/seed-admin.mjs <slug>` |
| מיגרציה לבית ספר קיים | `node scripts/apply-sql.mjs <ref> <tokenFile> supabase/migration_*.sql` |

## Google Login (ידני, פעם אחת לבית ספר)

ההקמה האוטומטית פותחת כניסה עם אימייל+סיסמה. להוספת "המשך עם Google":
OAuth client ב-GCP (פרויקט 242059022705) + הפעלת provider דרך
`PATCH /v1/projects/{ref}/config/auth` — ראי git history (הקמת אשקלון) לדוגמה מלאה.

## הערות

- **סיסמת DB** נוצרת אקראית ולא נשמרת — לא צריכים אותה (הכל דרך ה-API). אפשר לאפס מה-dashboard בעת הצורך.
- `seed_ashkelon.sql` נשאר בריפו כתיעוד היסטורי; ההקמה החדשה מייצרת seed אוטומטית.
- שדרוג בתי ספר ותיקים: להריץ את `migration_v2_kind_mode.sql` (אידמפוטנטי).
