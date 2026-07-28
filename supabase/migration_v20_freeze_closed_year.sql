-- v20 — הקפאת שנת תקציב סגורה
--
-- מרגע שהמנהלת חותמת, נשמר ב-budget_approvals.summary סנפשוט מלא: הסכומים,
-- מצבת הכיתות, מספרי התלמידים והצעות הייעול עם הסימון. המסכים כבר מציגים
-- את הסנפשוט במקום לחשב מחדש — והמיגרציה הזאת מוסיפה את האכיפה עצמה:
-- אחרי סגירה המסד דוחה כל שינוי בנתונים שמזיזים את המספרים.
--
-- בלי האכיפה הזאת די בשינוי במספר תלמידים אחד כדי להזיז תקציב חתום.
--
-- החלה:  node scripts/apply-sql.mjs <ref> <tokenFile> supabase/migration_v20_freeze_closed_year.sql

-- שנה סגורה = קיימת רשומת אישור שבה summary->'suggestions' הוא מערך.
-- summary ישן (סכומים בלבד) אינו נחשב סגור, כדי לא לנעול נתונים למפרע.
create or replace function public.budget_year_is_closed(p_year uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.budget_approvals
    where budget_year_id = p_year
      and jsonb_typeof(summary -> 'suggestions') = 'array'
  );
$$;

create or replace function public.reject_change_when_year_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year uuid;
begin
  if tg_op = 'DELETE' then
    v_year := old.budget_year_id;
  else
    v_year := new.budget_year_id;
  end if;

  if v_year is not null and public.budget_year_is_closed(v_year) then
    raise exception 'התקציב לשנה זו נסגר בחתימה — לא ניתן לשנות נתונים'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- הטבלאות שמזיזות את השורה התחתונה. budget_approvals עצמה לא נעולה —
-- אחרת החתימה השנייה (שליח/מפקחת) לא הייתה יכולה להישמר אחרי הסגירה.
do $$
declare
  t text;
begin
  foreach t in array array['classes', 'income_sources', 'expenses', 'financial_constants']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_freeze_closed_year on public.%I', t);
      execute format(
        'create trigger trg_freeze_closed_year
           before insert or update or delete on public.%I
           for each row execute function public.reject_change_when_year_closed()', t);
    end if;
  end loop;
end $$;

-- פתיחה מחדש (רק במקרה של טעות אמיתית, מהדשבורד) — עדיף דרך כפתור "פתיחה
-- מחדש לעריכה" באפליקציה (useBudgetClosed.reopen), ששומר את draftParams.
-- אם חייבים SQL ידני, לשמור את הכוונון ולא לאפס הכל:
--   update public.budget_approvals
--   set summary = case when summary ? 'draftParams'
--     then jsonb_build_object('draftParams', summary->'draftParams') else null end
--   where budget_year_id = '<id>';
-- מרגע שה-summary נוקה מ-suggestions השנה חוזרת להיות פתוחה, והחתימה הבאה תקפיא מחדש.
