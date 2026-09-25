-- v30 (25.9.2026): המנהלת רשאית לכתוב את שורת ההוצאה "שכר מנהלת" בלבד.
--
-- רקע: מיגרציה v22 העבירה את הכתיבה ל-expenses לשליח/אדמין. אבל שורת
-- "שכר מנהלת" מסונכרנת מההגדרות (syncPrincipalSalaryExpense ב-AppContext),
-- ואת ההגדרות המנהלת כן רשאית לשמור. התוצאה: המנהלת שומרת שכר מנהלת,
-- הקבוע נכתב, ה-UPDATE על שורת ההוצאה נדחה ב-RLS בשקט (0 שורות, בלי שגיאה),
-- והמסכים ממשיכים להציג את הסכום הישן. נמצא בביקורת של טופס התקציב.
--
-- הפתרון: מדיניות נוספת ל-expenses שמתירה למנהלת לכתוב שורות ששמן
-- "שכר מנהלת" בבית הספר שלה — ותו לא. שאר השורות נשארות כמו ב-v22.

DROP POLICY IF EXISTS "expenses_principal_salary_row" ON expenses;
CREATE POLICY "expenses_principal_salary_row" ON expenses
  FOR ALL
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'principal'
    AND name = 'שכר מנהלת'
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'principal'
    AND name = 'שכר מנהלת'
  );
