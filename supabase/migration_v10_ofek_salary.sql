-- v10 (19/7/26): שכר אופק חדש — שאלה קריטית לכל בית ספר
-- NULL = טרם נענתה; המערכת שואלת בדף הבית עד שעונים.
-- כן ← תעריף עלות הוראה 600 ₪/שעה, לא ← 400 ₪/שעה.
ALTER TABLE financial_constants ADD COLUMN IF NOT EXISTS ofek_salary BOOLEAN;
