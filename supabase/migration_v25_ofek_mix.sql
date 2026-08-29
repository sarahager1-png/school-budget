-- v25 — חלק מהמורות באופק וחלק בעולם הישן
--
-- עד כה שכר אופק היה שאלת כן/לא אחת לכל בית הספר, והתעריף בעלות ההוראה
-- היה 700 ₪ או 450 ₪. במציאות בהרבה מוסדות חלק מהמורות בשכר אופק וחלק
-- בעולם הישן — ולכן נוספות כאן שתי ספירות, והתעריף בפועל
-- (actual_hourly_rate) נשמר כממוצע משוקלל שלהן.
--
-- את צד העולם הישן אפשר לתאר בספירת מורות או בסכום שכר שנתי (למשל 300,000 ₪).
-- הסכום הוא חלק מעלות ההוראה שכבר מחושבת ולא תוספת עליה: הוא מוריד את
-- התעריף המשוקלל (ולכן את עלות ההוראה), וסה"כ ההוצאות לא גדל.
-- ההמרה: מורה בעולם הישן = 450 ₪ × שעות בפועל לכיתה × 12 = 183,600 ₪ בשנה.
--
--   ofek_teachers > 0 וגם (non_ofek_teachers > 0 או non_ofek_amount > 0)
--                    ⇒  המוסד במצב "חלק וחלק"
--   אחרת             ⇒  ofek_salary כמו קודם (כן / לא / טרם נענתה)
--
-- כשנבחר "חלק וחלק" נשמר גם ofek_salary = true, כדי ששאלת דף הבית
-- ("טרם נענתה") לא תחזור, וכדי שדשבורד הרשת ימשיך לראות מוסד עם אופק.
--
-- החלה על כל בתי הספר:
--   set SUPABASE_ACCESS_TOKEN=sbp_...
--   node scripts/apply-migrations-all.mjs supabase/migration_v25_ofek_mix.sql

ALTER TABLE financial_constants
  ADD COLUMN IF NOT EXISTS ofek_teachers INTEGER DEFAULT 0,      -- מורות בשכר אופק
  ADD COLUMN IF NOT EXISTS non_ofek_teachers INTEGER DEFAULT 0,  -- מורות בעולם הישן
  ADD COLUMN IF NOT EXISTS non_ofek_amount NUMERIC DEFAULT 0;    -- שכר שנתי לצוות העולם הישן (חלופה לספירה)

COMMENT ON COLUMN financial_constants.ofek_teachers IS 'מספר המורות בשכר אופק (משמש רק במצב "חלק וחלק")';
COMMENT ON COLUMN financial_constants.non_ofek_teachers IS 'מספר המורות בעולם הישן (משמש רק במצב "חלק וחלק")';
COMMENT ON COLUMN financial_constants.non_ofek_amount IS 'שכר שנתי לצוות העולם הישן בשקלים; > 0 גובר על non_ofek_teachers. חלק מעלות ההוראה — מוריד את התעריף המשוקלל, לא מתווסף להוצאות';
