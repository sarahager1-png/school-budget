# הקמת שלהבות אשקלון

מערכת התקצוב היא **פרויקט Supabase נפרד לכל בית ספר** + פריסת Surge נפרדת, מאותו קוד.
זהו המדריך להקמת אשקלון (וכל בית ספר חדש עתידי).

## 1. הזנת מפתחות הפרויקט של אשקלון

ערכי את `.env.ashkelon` (כבר קיים, עם placeholders):

```
VITE_SUPABASE_URL=https://<ASHKELON-REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
VITE_SCHOOL_NAME=שלהבות אשקלון
```

צרי `.env.ashkelon.local` (לא נכנס ל-git) עם מפתח ה-service_role:

```
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

## 2. הרצת הסכימה + ה-seed על פרויקט אשקלון

ב-Supabase SQL Editor של פרויקט אשקלון, הריצי לפי הסדר:

1. `supabase/schema.sql`
2. `supabase/migration_add_constants_cols.sql`
3. `supabase/migration_salaries.sql`
4. `supabase/seed_ashkelon.sql`  ← בית ספר "שלהבות אשקלון", שנים תשפ"ו (פעילה) + תשפ"ז, קבועים ברירת-מחדל, קטגוריות הוצאה

`seed_ashkelon.sql` אידמפוטנטי — הרצה חוזרת לא תיצור כפילויות.

## 3. יצירת משתמש כניסה ראשון (אדמין)

אין טריגר שיוצר `profiles` אוטומטית, ולכן צריך ליצור משתמש + פרופיל פעם אחת:

```
npm run seed:ashkelon
```

ברירת מחדל: `data@reshetch.org.il` / `ashkelon2026` (תפקיד admin).
לשינוי — ערכי `ADMIN_EMAIL` / `ADMIN_PASSWORD` ב-`.env.ashkelon.local`.

## 4. בנייה ופריסה

```
npm run deploy:ashkelon
```

בונה עם המיתוג של אשקלון ומעלה ל-`chabad-ashkelon-budget.surge.sh`.

---

המודל זהה לכל בית ספר נוסף: `.env.<school>` + `.env.<school>.local`, מצב build תואם,
ותת-דומיין Surge משלו. הקוד עצמו לא משתנה בין בתי הספר — רק המפתחות והשם.
