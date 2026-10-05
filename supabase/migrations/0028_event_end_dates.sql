-- UST Central Comelec — events run from a start date to an end date, and a unit's Recruitment,
-- Political Party Registration and Filing of Candidacy run on theirs.
--
-- An event had one date. Now it has a start date and an end date: the activity starts on the first
-- at starts_time and ends on the second at ends_time. Events saved before this end the day they start.
--
-- A unit's period (0027) takes its dates from its event details: it opens at its start date and
-- time (opens_at) and closes at its end date and time (closes_at). Before opens_at nobody can apply
-- or file. There's no longer an "always open": a period always has an end.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0027 first. Safe to re-run.

-- Events -----------------------------------------------------------------------------------------

alter table public.events add column if not exists end_date date;
update public.events set end_date = event_date where end_date is null;
alter table public.events alter column end_date set not null;

-- The activity's times compare across days now, not within one.
do $$
declare
  rule record;
begin
  for rule in
    select conrelid::regclass as owner, conname from pg_constraint
    where conrelid in ('public.events'::regclass, 'public.unit_periods'::regclass) and contype = 'c'
      and pg_get_constraintdef(oid) like '%starts_time < ends_time%'
      and pg_get_constraintdef(oid) not like '%end_date%'
  loop
    execute format('alter table %s drop constraint %I', rule.owner, rule.conname);
  end loop;
end $$;

alter table public.events drop constraint if exists events_dates_in_order;
alter table public.events add constraint events_dates_in_order
  check (end_date >= event_date and (end_date > event_date or starts_time < ends_time));

-- A unit's periods ---------------------------------------------------------------------------------

alter table public.unit_periods add column if not exists end_date date;
alter table public.unit_periods add column if not exists opens_at timestamptz;
update public.unit_periods set end_date = event_date where end_date is null and event_date is not null;

alter table public.unit_periods drop constraint if exists unit_periods_dates_in_order;
alter table public.unit_periods add constraint unit_periods_dates_in_order
  check (event_date is null or starts_time is null or ends_time is null or (coalesce(end_date, event_date) >= event_date and (coalesce(end_date, event_date) > event_date or starts_time < ends_time)));

-- Refuses a new application while the unit it's for isn't taking any: before it opens, after it
-- closes, or while it's closed. As in 0027, an application to serve in the Central Comelec goes by
-- the Central Comelec's period, and one to serve in a Local Comelec by the applicant's own college's.
create or replace function public.check_application_period() returns trigger
language plpgsql as $$
declare
  period record;
begin
  select mode, opens_at, closes_at, grace_ends_at into period
  from public.unit_periods
  where kind = 'recruitment' and college = case when new.preferred_body = 'local' then new.college else '' end;
  if not found
    or (period.mode = 'closed' and (period.grace_ends_at is null or now() >= period.grace_ends_at))
    or (period.mode = 'scheduled' and (now() >= period.closes_at or (period.opens_at is not null and now() < period.opens_at))) then
    raise exception 'applications_closed';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
