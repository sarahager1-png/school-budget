-- ============================================================
-- v24: עריכה מלאה לשליח — מזכרת בתיה בלבד!
-- בקשת שרה (5/8/26): במזכרת בתיה השליח מנהל בפועל את התקציב —
-- לפתוח לו את הטבלאות ששמורות למנהלת: כיתות, קבועים (הגדרות),
-- שנות תקציב, משכורות, גבייה, ויצירת בקשות תשלום.
-- profiles (ניהול משתמשים) ו-expense_categories נשארים admin בלבד.
--
-- ⚠ לא להוסיף ל-add-school.mjs ולא ל-DEFAULT_FILES של
--   apply-migrations-all.mjs — המיגרציה הזו מוחלת רק על פרויקט
--   מזכרת בתיה (njsanabfbmnaqvwraqdh), יחד עם VITE_COURIER_FULL_EDIT=1
--   ב-.env.mazkeret. בשאר בתי הספר השליח נשאר עורך הכנסות/הוצאות בלבד.
--
-- החלה:  node scripts/apply-sql.mjs njsanabfbmnaqvwraqdh <tokenFile> supabase/migration_v24_mazkeret_courier_full_edit.sql
-- ============================================================

DROP POLICY IF EXISTS "classes_write" ON classes;
CREATE POLICY "classes_write" ON classes
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));

DROP POLICY IF EXISTS "financial_constants_write" ON financial_constants;
CREATE POLICY "financial_constants_write" ON financial_constants
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));

DROP POLICY IF EXISTS "budget_years_write" ON budget_years;
CREATE POLICY "budget_years_write" ON budget_years
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));

DROP POLICY IF EXISTS "employees_write" ON employees;
CREATE POLICY "employees_write" ON employees
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));

DROP POLICY IF EXISTS "salary_payments_write" ON salary_payments;
CREATE POLICY "salary_payments_write" ON salary_payments
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));

DROP POLICY IF EXISTS "tuition_payers_write" ON tuition_payers;
CREATE POLICY "tuition_payers_write" ON tuition_payers
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));

DROP POLICY IF EXISTS "tuition_payments_write" ON tuition_payments;
CREATE POLICY "tuition_payments_write" ON tuition_payments
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));

-- יצירת בקשת תשלום (בהוצאות) פתוחה במקור רק למנהלת/אדמין
DROP POLICY IF EXISTS "expense_requests_create" ON expense_requests;
CREATE POLICY "expense_requests_create" ON expense_requests
  FOR INSERT WITH CHECK (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));
