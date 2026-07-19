-- v12 (19/7/26): הנחיית שרה — חישוב חדש
-- 1. שעות בפועל לכיתה בחודש: 29 → 34 (רק מי שעדיין על ברירת המחדל הישנה)
-- 2. הכנסה חדשה לתלמיד: תל"ן (תשלום הורה) 885 ₪ לשנה, בנוסף להכנסה לתלמיד
ALTER TABLE financial_constants ADD COLUMN IF NOT EXISTS income_per_student_talan NUMERIC DEFAULT 885;
UPDATE financial_constants SET actual_weekly_hours = 34 WHERE actual_weekly_hours = 29;
