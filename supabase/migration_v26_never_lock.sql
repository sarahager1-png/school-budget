-- v26 — ביטול נעילת שנת תקציב
--
-- ההכרעה (27.8.2026): המערכות פתוחות לעריכה תמיד. שמירה שומרת, לעולם לא
-- נועלת. המיגרציה הזאת מבטלת את האכיפה שהוסיפה v20:
--   1. budget_year_is_closed מחזירה תמיד false — כל בדיקה שנשענת עליה נפתחת.
--   2. הטריגרים על classes / income_sources / expenses / financial_constants מוסרים.
--   3. שנים שנשארו עם סנפשוט הקפאה נפתחות — נשמר בהן רק draftParams (הכוונון
--      של מסך הייעול), בדיוק כמו כפתור "פתיחה מחדש לעריכה". החתימות עצמן
--      (principal_signature / courier_signature) אינן נמחקות.
--
-- באפליקציה הצד השני של אותה הכרעה: LOCK_BUDGET_ON_SAVE = false ב-
-- src/lib/efficiency.js, ושמירה וחתימה כבר לא כותבות סנפשוט ל-summary.
--
-- החלה על כל בתי הספר:
--   set SUPABASE_ACCESS_TOKEN=sbp_...
--   node scripts/apply-migrations-all.mjs supabase/migration_v26_never_lock.sql
-- הרצה חוזרת בטוחה.

create or replace function public.budget_year_is_closed(p_year uuid)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  select false;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['classes', 'income_sources', 'expenses', 'financial_constants']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_freeze_closed_year on public.%I', t);
    end if;
  end loop;
end $$;

-- cascade — מפיל גם טריגר שנשאר על טבלה שאינה ברשימה שלמעלה
drop function if exists public.reject_change_when_year_closed() cascade;

-- פתיחת שנים שנשארו קפואות, בלי לאבד את הכוונון
update public.budget_approvals
set summary = case
      when summary ? 'draftParams' then jsonb_build_object('draftParams', summary -> 'draftParams')
      else null
    end,
    updated_at = now()
where jsonb_typeof(summary -> 'suggestions') = 'array';
