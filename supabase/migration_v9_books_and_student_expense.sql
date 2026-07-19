-- v9 (19/7/26): מודל הוצאות/הכנסות תלמיד מעודכן לפי הנחיית שרה
-- 1. הכנסה חדשה לתלמיד: ספרי לימוד 280 ₪/שנה (עמודה חדשה, ברירת מחדל רשת)
-- 2. הוצאה לתלמיד 1,400 → 1,200 (כולל אירועים, ערבי הורים, פיתוח מקצועי, שכפולים)
-- 3. פיתוח מקצועי לכיתה 2,000 → 0 (נכלל מעכשיו בהוצאה לתלמיד)
-- העדכונים נוגעים רק בערכי ברירת המחדל הישנים — בית ספר ששינה ידנית שומר על ערכיו.

ALTER TABLE financial_constants ADD COLUMN IF NOT EXISTS income_per_student_books NUMERIC DEFAULT 280;

UPDATE financial_constants SET expense_per_student = 1200 WHERE expense_per_student = 1400;

UPDATE financial_constants SET professional_dev_per_class = 0 WHERE professional_dev_per_class = 2000;
