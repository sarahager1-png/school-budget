-- Employees (staff salary records)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly salary payments
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  receipt_url TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_own_school" ON employees;
CREATE POLICY "employees_own_school" ON employees
  FOR ALL USING (school_id = get_user_school_id());

DROP POLICY IF EXISTS "salary_payments_own_school" ON salary_payments;
CREATE POLICY "salary_payments_own_school" ON salary_payments
  FOR ALL USING (school_id = get_user_school_id());

CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON salary_payments(school_id, month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id, month);
