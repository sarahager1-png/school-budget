-- ============================================================
-- שלהבות אשקלון — initial seed (empty shell + default constants)
-- ============================================================
-- PREREQUISITE: run these on the אשקלון Supabase project FIRST, in order:
--   1. supabase/schema.sql
--   2. supabase/migration_add_constants_cols.sql
--   3. supabase/migration_salaries.sql
-- Then run THIS file. It is idempotent — re-running does nothing once
-- 'שלהבות אשקלון' already exists.
-- ============================================================

DO $$
DECLARE
  v_school    UUID;
  v_year_86   UUID;  -- תשפ"ו (2025/26)
  v_year_87   UUID;  -- תשפ"ז (2026/27)
BEGIN
  -- Skip entirely if already seeded
  IF EXISTS (SELECT 1 FROM schools WHERE name = 'שלהבות אשקלון') THEN
    RAISE NOTICE 'שלהבות אשקלון already exists — skipping seed.';
    RETURN;
  END IF;

  -- School
  INSERT INTO schools (name)
  VALUES ('שלהבות אשקלון')
  RETURNING id INTO v_school;

  -- Budget years (Sep 1 → Aug 31). תשפ"ו is active (current school year).
  INSERT INTO budget_years (school_id, year, label, start_date, end_date, is_active, status)
  VALUES (v_school, 2025, 'תשפ"ו', '2025-09-01', '2026-08-31', true, 'active')
  RETURNING id INTO v_year_86;

  INSERT INTO budget_years (school_id, year, label, start_date, end_date, is_active, status)
  VALUES (v_school, 2026, 'תשפ"ז', '2026-09-01', '2027-08-31', false, 'active')
  RETURNING id INTO v_year_87;

  -- Financial constants — one row per year, all columns left at their
  -- schema defaults (the "default constants" baseline).
  INSERT INTO financial_constants (school_id, budget_year_id) VALUES (v_school, v_year_86);
  INSERT INTO financial_constants (school_id, budget_year_id) VALUES (v_school, v_year_87);

  -- Expense categories (network-standard set; editable in-app)
  INSERT INTO expense_categories (school_id, name, color, sort_order) VALUES
    (v_school, 'שכר ושכר עבודה',     '#7c3aed', 1),
    (v_school, 'פעילות חינוכית',      '#0ea5e9', 2),
    (v_school, 'אחזקה ותפעול',        '#10b981', 3),
    (v_school, 'ציוד וריהוט',         '#f59e0b', 4),
    (v_school, 'אירועים וחגים',       '#ec4899', 5),
    (v_school, 'פיתוח מקצועי',        '#6366f1', 6),
    (v_school, 'אחר',                 '#64748b', 7);

  RAISE NOTICE 'Seeded שלהבות אשקלון (school_id=%)', v_school;
END $$;
