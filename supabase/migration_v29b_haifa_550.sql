-- v29b (2/9/26): השלמה ל-v29 — חיפה עמדה על תעריף עולם ישן מותאם ידנית (500 ₪),
-- ולכן הגבלת ה"= 450" של v29 דילגה עליה. שרה אישרה: גם חיפה עוברת ל-550.
--
-- החלה על חיפה בלבד:
--   node scripts/apply-via-cli.mjs --only haifa supabase/migration_v29b_haifa_550.sql

UPDATE financial_constants
SET actual_hourly_rate = 550
WHERE ofek_salary = false AND actual_hourly_rate = 500;
