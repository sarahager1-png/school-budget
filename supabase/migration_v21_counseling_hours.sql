-- v21 — שעות ייעוץ ותוספת חוגים כשדות שנערכים במערכת
--
-- שני המרכיבים האלה היו קבועים מקובעים בקוד בלי עמודה במסד:
--   • ייעוץ — 2 שעות לכיתה בחודש, ערך רשתי אחיד.
--   • חוגים — 2,000 ₪ לכיתה בחודש, וכיבוי שלו נעשה בדגל build
--     (VITE_DISABLE_CLUBS) שהיה חייב להישאר מסונכרן ידנית עם רשימה
--     מקבילה בפונקציית מבט רשת. עמודה במסד מייתרת את הכפילות הזאת.
--
-- העלויות בתחשיב:
--   ייעוץ = שעות × actual_hourly_rate × 12 חודשים, לכל כיתה.
--   חוגים = סכום חודשי × 10 חודשי פעילות, לכל כיתה.
--
-- החלה:  node scripts/apply-sql.mjs <ref> <tokenFile> supabase/migration_v21_counseling_hours.sql

-- ברירת מחדל 2 — זהה להתנהגות הנוכחית, כך שהחלת המיגרציה לא מזיזה אף מספר.
alter table public.financial_constants
  add column if not exists counseling_hours_per_class numeric not null default 2;

-- כאן במכוון בלי ברירת מחדל ובלי NOT NULL: ערך NULL פירושו "לא נקבע",
-- והמערכת ממשיכה להתנהג בדיוק כמו היום (2,000 ₪, או 0 בבתי הספר שבהם
-- VITE_DISABLE_CLUBS=1 — רעננה, ירושלים ועפולה). ברגע שמזינים ערך במסך
-- ההגדרות הוא גובר. כך אין שום סיכון שהמיגרציה תוסיף הוצאה למי שכיבה חוגים.
alter table public.financial_constants
  add column if not exists clubs_monthly_expense_per_class numeric;

comment on column public.financial_constants.counseling_hours_per_class is
  'שעות ייעוץ לכיתה בחודש. עלות = שעות × actual_hourly_rate × 12.';
comment on column public.financial_constants.clubs_monthly_expense_per_class is
  'תוספת חוגים לכיתה בחודש (₪). NULL = לא נקבע, נופל לברירת המחדל של הבנייה. עלות = סכום × 10 חודשים.';
