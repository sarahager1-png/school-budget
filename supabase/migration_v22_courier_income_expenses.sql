-- v22: delegate income/expense line-item management to the courier role.
-- Principal keeps the per-student (1200) class/ministry model (classes,
-- financial_constants — unchanged, still principal/admin only, read stays open
-- so the courier can always view it). Courier becomes the sole editor of the
-- rest of the budget: income sources and expenses (rent, donations, etc.).

DROP POLICY IF EXISTS "income_sources_write" ON income_sources;
CREATE POLICY "income_sources_write" ON income_sources
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('courier', 'admin'));

DROP POLICY IF EXISTS "expenses_write" ON expenses;
CREATE POLICY "expenses_write" ON expenses
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('courier', 'admin'));
