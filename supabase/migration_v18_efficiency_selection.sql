-- ============================================================
-- v18: which efficiency suggestions the principal actually chose to
-- adopt, plus a free-text notes section — saved on budget_approvals
-- (same row as the signatures) so the signed document reflects only
-- the chosen suggestions, not every suggestion the system computed.
-- Idempotent — safe to re-run on every school project.
-- ============================================================

ALTER TABLE budget_approvals ADD COLUMN IF NOT EXISTS selected_suggestion_keys TEXT[];
ALTER TABLE budget_approvals ADD COLUMN IF NOT EXISTS notes TEXT;
