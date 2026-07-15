-- v8: close a pre-existing gap unrelated to any single feature — these 5 tables had
-- FOR ALL policies with NO role check (any authenticated school member could write).
-- Split each into an open SELECT + a principal/admin-only write, mirroring the
-- classes_write / expenses_write pattern used elsewhere. Needed now that every role
-- (including courier) can navigate to every screen — RLS is the real safety net.

DROP POLICY IF EXISTS "employees_own_school" ON employees;
CREATE POLICY "employees_read" ON employees
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "employees_write" ON employees
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

DROP POLICY IF EXISTS "salary_payments_own_school" ON salary_payments;
CREATE POLICY "salary_payments_read" ON salary_payments
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "salary_payments_write" ON salary_payments
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

DROP POLICY IF EXISTS "budget_years_own_school" ON budget_years;
CREATE POLICY "budget_years_read" ON budget_years
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "budget_years_write" ON budget_years
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

DROP POLICY IF EXISTS "financial_constants_own_school" ON financial_constants;
CREATE POLICY "financial_constants_read" ON financial_constants
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "financial_constants_write" ON financial_constants
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

-- profiles: write restricted to admin only (matches the Users tab's existing admin-only
-- delete design — principal/courier can view the users list but not manage it)
DROP POLICY IF EXISTS "profiles_own_school" ON profiles;
CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "profiles_write" ON profiles
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() = 'admin');
