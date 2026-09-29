-- UST Central Comelec — closing applications from the portal (Recruitment → Settings → Closed) takes
-- effect after a 5-minute grace period, so anyone partway through the form can still submit.
-- grace_ends_at is when a 'closed' period actually closes; null means it closed straight away (rows
-- saved before this migration). The portal sets it; this file only adds the column and teaches the
-- database check about it.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0010 first. Safe to re-run.

alter table public.recruitment_settings add column if not exists grace_ends_at timestamptz;

create or replace function public.check_application_period() returns trigger
language plpgsql as $$
declare
  period record;
begin
  select mode, closes_at, grace_ends_at into period from public.recruitment_settings where id;
  if (period.mode = 'closed' and (period.grace_ends_at is null or now() >= period.grace_ends_at))
    or (period.mode = 'scheduled' and now() >= period.closes_at) then
    raise exception 'applications_closed';
  end if;
  return new;
end $$;
