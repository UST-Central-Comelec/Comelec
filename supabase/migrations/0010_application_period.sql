-- UST Central Comelec — when commissioner applications are open, set in the portal
-- (Recruitment → Settings). One row:
--   mode 'scheduled': open until closes_at, then closed automatically (the countdown on /apply);
--   mode 'open':      open with no closing date;
--   mode 'closed':    closed right now, until someone reopens it.
-- closes_at is kept when switching modes, so going back to 'scheduled' remembers the date.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0004 first. Safe to re-run.

create table if not exists public.recruitment_settings (
  -- Always true: the table holds a single row.
  id boolean primary key default true check (id),
  mode text not null default 'scheduled' check (mode in ('scheduled', 'open', 'closed')),
  closes_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  check (mode <> 'scheduled' or closes_at is not null)
);

-- Starts on the closing date the site used before this setting existed.
insert into public.recruitment_settings (id, mode, closes_at)
values (true, 'scheduled', '2026-10-29 23:59:59+08')
on conflict (id) do nothing;

alter table public.recruitment_settings enable row level security;

-- Refuses new applications while the period is closed, including a form left open in a tab past
-- the closing time.
create or replace function public.check_application_period() returns trigger
language plpgsql as $$
declare
  period record;
begin
  select mode, closes_at into period from public.recruitment_settings where id;
  if period.mode = 'closed' or (period.mode = 'scheduled' and now() >= period.closes_at) then
    raise exception 'applications_closed';
  end if;
  return new;
end $$;

drop trigger if exists applications_check_period on public.applications;
create trigger applications_check_period
  before insert on public.applications
  for each row execute function public.check_application_period();
