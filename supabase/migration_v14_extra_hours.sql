-- v14 (19/7/26): שעות בודדות פר כיתה — עלות בלבד (× תעריף האופק × 12), לא הכנסה.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS extra_hours NUMERIC DEFAULT 0;
