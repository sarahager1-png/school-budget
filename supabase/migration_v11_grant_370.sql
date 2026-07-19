-- v11 (19/7/26): תוספת משרד החינוך לתלמיד 360 → 370 ₪ לשנה (הנחיית שרה).
-- מעדכן רק בתי ספר שעדיין על ברירת המחדל הישנה.
UPDATE financial_constants SET ministry_grant_per_student = 370 WHERE ministry_grant_per_student = 360;
