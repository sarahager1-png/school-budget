-- ============================================================
-- v16: budget approvals — annual budget summary signed by the
-- principal and the courier (shliach). One row per school+year;
-- each signature slot is filled from the summary screen.
-- Idempotent — safe to re-run on every school project.
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  budget_year_id UUID REFERENCES budget_years(id) ON DELETE CASCADE,
  summary JSONB,
  principal_name TEXT,
  principal_signature TEXT,
  principal_signed_at TIMESTAMPTZ,
  courier_name TEXT,
  courier_signature TEXT,
  courier_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, budget_year_id)
);

ALTER TABLE budget_approvals ENABLE ROW LEVEL SECURITY;

-- Everyone in the school reads; every role signs (the courier signs too,
-- so writes cannot be manager-only). No DELETE policy — a signed
-- document is not deletable from the client.
DROP POLICY IF EXISTS "budget_approvals_read" ON budget_approvals;
CREATE POLICY "budget_approvals_read" ON budget_approvals
  FOR SELECT USING (school_id = get_user_school_id());
DROP POLICY IF EXISTS "budget_approvals_insert" ON budget_approvals;
CREATE POLICY "budget_approvals_insert" ON budget_approvals
  FOR INSERT WITH CHECK (school_id = get_user_school_id());
DROP POLICY IF EXISTS "budget_approvals_update" ON budget_approvals;
CREATE POLICY "budget_approvals_update" ON budget_approvals
  FOR UPDATE USING (school_id = get_user_school_id());

CREATE INDEX IF NOT EXISTS idx_budget_approvals_school_year
  ON budget_approvals(school_id, budget_year_id);
