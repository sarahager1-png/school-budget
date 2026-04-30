-- ============================================================
-- School Budget System — Supabase Schema
-- Each table includes school_id for multi-tenancy + RLS
-- ============================================================

-- Schools
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('principal', 'courier', 'admin')),
  initials TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Years (Sep 1 → Aug 31)
CREATE TABLE budget_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Constants (editable per school/year)
CREATE TABLE financial_constants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  budget_year_id UUID REFERENCES budget_years(id) ON DELETE CASCADE,
  school_weeks INTEGER DEFAULT 36,
  full_class_student_threshold INTEGER DEFAULT 21,
  half_class_student_threshold INTEGER DEFAULT 11,
  full_class_ministry_hours INTEGER DEFAULT 22,
  half_class_ministry_hours INTEGER DEFAULT 11,
  ministry_hourly_rate NUMERIC DEFAULT 400,
  actual_weekly_hours INTEGER DEFAULT 29,
  actual_hourly_rate NUMERIC DEFAULT 600,
  income_per_student NUMERIC DEFAULT 350,
  expense_per_student NUMERIC DEFAULT 1400,
  professional_dev_per_class NUMERIC DEFAULT 2000,
  principal_monthly_salary NUMERIC DEFAULT 27000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  budget_year_id UUID REFERENCES budget_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level TEXT,
  section TEXT,
  student_count INTEGER NOT NULL DEFAULT 0 CHECK (student_count >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additional Income Sources
CREATE TABLE income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  budget_year_id UUID REFERENCES budget_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT CHECK (type IN ('donation', 'municipal', 'events', 'parents', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Categories
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses (budget line items)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  budget_year_id UUID REFERENCES budget_years(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  period TEXT DEFAULT 'yearly' CHECK (period IN ('monthly', 'yearly')),
  is_recurring BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Requests (for courier workflow)
CREATE TABLE expense_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paid', 'completed', 'rejected')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Receipts Storage References
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  expense_request_id UUID REFERENCES expense_requests(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_constants ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's school_id
CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Profiles: users see only their own school
CREATE POLICY "profiles_own_school" ON profiles
  FOR ALL USING (school_id = get_user_school_id());

-- Budget Years: own school
CREATE POLICY "budget_years_own_school" ON budget_years
  FOR ALL USING (school_id = get_user_school_id());

-- Financial Constants: own school
CREATE POLICY "financial_constants_own_school" ON financial_constants
  FOR ALL USING (school_id = get_user_school_id());

-- Classes: read all in school; principal/admin can mutate
CREATE POLICY "classes_read" ON classes
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "classes_write" ON classes
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

-- Income Sources: principal/admin full access
CREATE POLICY "income_sources_own_school" ON income_sources
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

-- Expense Categories: all read; admin write
CREATE POLICY "expense_categories_read" ON expense_categories
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "expense_categories_write" ON expense_categories
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() = 'admin');

-- Expenses: read all; principal/admin mutate
CREATE POLICY "expenses_read" ON expenses
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "expenses_write" ON expenses
  FOR ALL USING (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));

-- Expense Requests: read all; courier can update their assigned; principal creates
CREATE POLICY "expense_requests_read" ON expense_requests
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "expense_requests_create" ON expense_requests
  FOR INSERT WITH CHECK (school_id = get_user_school_id() AND get_user_role() IN ('principal', 'admin'));
CREATE POLICY "expense_requests_update_courier" ON expense_requests
  FOR UPDATE USING (school_id = get_user_school_id() AND (
    get_user_role() IN ('principal', 'admin') OR
    (get_user_role() = 'courier' AND assigned_to = auth.uid())
  ));

-- Receipts: couriers can insert; all in school can read
CREATE POLICY "receipts_read" ON receipts
  FOR SELECT USING (school_id = get_user_school_id());
CREATE POLICY "receipts_insert" ON receipts
  FOR INSERT WITH CHECK (school_id = get_user_school_id());

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_classes_school_year ON classes(school_id, budget_year_id);
CREATE INDEX idx_expenses_school_year ON expenses(school_id, budget_year_id);
CREATE INDEX idx_expense_requests_school ON expense_requests(school_id, status);
CREATE INDEX idx_expense_requests_assigned ON expense_requests(assigned_to, status);
