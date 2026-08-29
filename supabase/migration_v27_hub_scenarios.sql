-- v27 — תרחישי המסמך המרכז במבט רשת
--
-- טבלה אחת בלבד, ורק בפרויקט שבו יושבת הפונקציה network-budget —
-- שלהבות אשקלון (ogkwvrerolofujhydhsl). לא להריץ ב-12 המסדים.
--
-- כאן נשמר עותק העבודה של ההנהלה: מספרי תלמידים, סעיפים שנוספו או הוסרו
-- ובסיס חישוב מכוון. זה אינו תקציב בית הספר — נתוני בית הספר משתנים רק
-- כשלוחצים במפורש "החלה על המערכת", וזה כותב ישירות למסד של אותו מוסד.
--
-- החלה: SQL Editor של פרויקט אשקלון. הרצה חוזרת בטוחה.

create table if not exists public.hub_scenarios (
  slug        text primary key,
  state       jsonb not null,
  updated_at  timestamptz not null default now()
);

comment on table public.hub_scenarios is
  'עותקי עבודה של ההנהלה במסמך המרכז שבמבט רשת. אינם נתוני בית ספר.';

-- הגישה היחידה היא דרך הפונקציה, עם מפתח השירות שעוקף RLS. אין policy
-- ולכן אף לקוח אנונימי לא יכול לקרוא או לכתוב כאן.
alter table public.hub_scenarios enable row level security;
