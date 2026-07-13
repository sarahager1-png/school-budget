-- ============================================================
-- v3: saved budget scenarios ("לבנות תקציב שיישמר")
-- A scenario stores the simulation slider values per school+year,
-- so a principal can build a budget, name it, and return to it.
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  budget_year_id UUID REFERENCES budget_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budget_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_scenarios_read" ON budget_scenarios;
CREATE POLICY "budget_scenarios_read" ON budget_scenarios
  FOR SELECT USING (school_id = get_user_school_id());

DROP POLICY IF EXISTS "budget_scenarios_write" ON budget_scenarios;
CREATE POLICY "budget_scenarios_write" ON budget_scenarios
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

CREATE INDEX IF NOT EXISTS idx_budget_scenarios_school_year
  ON budget_scenarios(school_id, budget_year_id);
