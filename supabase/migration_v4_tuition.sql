-- ============================================================
-- v4: tuition collection ("גבייה — שכר לימוד")
-- Who is expected to pay, how much was collected, what remains.
-- Operational tracking — does NOT feed the budget totals (the
-- budget's tuition side stays students × income_per_student).
-- Idempotent — safe to re-run on every school project.
-- ============================================================

CREATE TABLE IF NOT EXISTS tuition_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  budget_year_id UUID REFERENCES budget_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_name TEXT,
  amount_due NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tuition_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES tuition_payers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT,
  paid_at DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tuition_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tuition_payers_read" ON tuition_payers;
CREATE POLICY "tuition_payers_read" ON tuition_payers
  FOR SELECT USING (school_id = get_user_school_id());
DROP POLICY IF EXISTS "tuition_payers_write" ON tuition_payers;
CREATE POLICY "tuition_payers_write" ON tuition_payers
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

DROP POLICY IF EXISTS "tuition_payments_read" ON tuition_payments;
CREATE POLICY "tuition_payments_read" ON tuition_payments
  FOR SELECT USING (school_id = get_user_school_id());
DROP POLICY IF EXISTS "tuition_payments_write" ON tuition_payments;
CREATE POLICY "tuition_payments_write" ON tuition_payments
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

CREATE INDEX IF NOT EXISTS idx_tuition_payers_school_year ON tuition_payers(school_id, budget_year_id);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_payer ON tuition_payments(payer_id);
