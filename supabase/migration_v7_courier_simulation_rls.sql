-- v7: allow couriers to open שערוך תקציב (simulations) with correct totals + save their own scenarios.
-- income_sources: split into a school-wide read policy (mirrors classes_read/expenses_read)
-- while keeping write restricted to principal/admin.
DROP POLICY IF EXISTS "income_sources_own_school" ON income_sources;
DROP POLICY IF EXISTS "income_sources_read" ON income_sources;
DROP POLICY IF EXISTS "income_sources_write" ON income_sources;
CREATE POLICY "income_sources_read" ON income_sources
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "income_sources_write" ON income_sources
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

-- budget_scenarios: couriers can now save/load/delete scenarios too (read policy already open).
DROP POLICY IF EXISTS "budget_scenarios_write" ON budget_scenarios;
CREATE POLICY "budget_scenarios_write" ON budget_scenarios
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin', 'courier'));
