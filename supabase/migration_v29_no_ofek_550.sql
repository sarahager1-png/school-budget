-- v29 (2/9/26): תעריף עולם ישן 450 → 550 ₪ לשעה (הנחיית שרה).
-- מתואם עם OFEK_RATES.no בקוד (src/data/constants.js) — שני המקומות חייבים להתעדכן יחד.
--
-- שני עדכונים:
--   1. מוסדות שכל המורות בעולם הישן (ofek_salary = false) — התעריף 450 הופך 550.
--      הגבלה ל-450 בדיוק כדי לא לדרוס תעריף שהותאם ידנית (כמו ב-v15).
--   2. מוסדות "חלק וחלק" — חישוב מחדש של הממוצע המשוקלל עם 550 בצד העולם הישן.
--      ההמרה של non_ofek_amount למשקל מורות משתמשת גם היא בתעריף החדש
--      (550 × שעות בפועל × 12), בדיוק כמו nonOfekTeachersFromAmount בקוד.
--
-- החלה על כל בתי הספר:
--   node scripts/apply-via-cli.mjs supabase/migration_v29_no_ofek_550.sql

-- 1. כולן בעולם הישן
UPDATE financial_constants
SET actual_hourly_rate = 550
WHERE ofek_salary = false AND actual_hourly_rate = 450;

-- 2. חלק וחלק — ממוצע משוקלל מחדש
UPDATE financial_constants
SET actual_hourly_rate = ROUND(
  (ofek_teachers * 700
   + CASE WHEN COALESCE(non_ofek_amount, 0) > 0
          THEN non_ofek_amount / (550.0 * COALESCE(NULLIF(actual_weekly_hours, 0), 34) * 12)
          ELSE COALESCE(non_ofek_teachers, 0) END * 550)
  /
  (ofek_teachers
   + CASE WHEN COALESCE(non_ofek_amount, 0) > 0
          THEN non_ofek_amount / (550.0 * COALESCE(NULLIF(actual_weekly_hours, 0), 34) * 12)
          ELSE COALESCE(non_ofek_teachers, 0) END)
)
WHERE COALESCE(ofek_teachers, 0) > 0
  AND (COALESCE(non_ofek_teachers, 0) > 0 OR COALESCE(non_ofek_amount, 0) > 0);
