-- ============================================================
-- v2: semantic category kinds + per-school mode
-- Run on EVERY school project (idempotent, safe to re-run).
--
-- Fixes: dashboard/report totals used to match categories by the
-- demo ids (ec1..ec5), so on real projects salary/building/events
-- line items were silently missing from the totals.
-- Adds: schools.mode = 'full' | 'simple' ("ללא תקציב" — plain
-- income/expense tracking without ministry budget calculations).
-- ============================================================

-- 1. Per-school working mode
ALTER TABLE schools ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'full';

-- 2. Semantic kind per expense category
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS kind TEXT;

-- Infer kind from the Hebrew category name (order matters: salary and
-- profdev first, building/equipment before the broad 'events' match).
UPDATE expense_categories SET kind = CASE
  WHEN name LIKE '%שכר%'                                        THEN 'salary'
  WHEN name LIKE '%פיתוח%'                                      THEN 'profdev'
  WHEN name LIKE '%בניין%' OR name LIKE '%בנין%'
    OR name LIKE '%אחזק%'  OR name LIKE '%תחזוק%'
    OR name LIKE '%תפעול%'                                      THEN 'building'
  WHEN name LIKE '%קיץ%'   OR name LIKE '%ציוד%'
    OR name LIKE '%ריהוט%' OR name LIKE '%תשתי%'                THEN 'equipment'
  WHEN name LIKE '%אירוע%' OR name LIKE '%ארוע%'
    OR name LIKE '%חג%'    OR name LIKE '%מסיב%'
    OR name LIKE '%פעיל%'                                       THEN 'events'
  ELSE 'other'
END
WHERE kind IS NULL;
