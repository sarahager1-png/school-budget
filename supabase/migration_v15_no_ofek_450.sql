-- v15 (19/7/26): תעריף ללא אופק 400 → 450 ₪ לשעה (הנחיית שרה).
-- נוגע רק בבתי ספר שענו "לא" לאופק וקיבלו 400; תעריף המשרד (400) בעמודה אחרת ולא מושפע.
UPDATE financial_constants SET actual_hourly_rate = 450 WHERE actual_hourly_rate = 400 AND ofek_salary = false;
