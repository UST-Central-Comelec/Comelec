-- UST Central Comelec — applications are kept for 60 days after they're submitted, then deleted.
-- A nightly job (pg_cron, built into Supabase) does the deleting, so it runs whether or not anyone
-- visits the site. The site also hides applications past 60 days straight away
-- (APPLICATION_RETENTION_DAYS in src/lib/applications/options.ts); keep the two numbers the same.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0004–0006 first. Safe to re-run.

create extension if not exists pg_cron with schema pg_catalog;

-- Deletes applications older than 60 days, and interview slots that ended over 60 days ago with
-- nobody booked. Returns how many applications were deleted.
create or replace function public.delete_expired_applications() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  delete from public.applications where created_at < now() - interval '60 days';
  get diagnostics deleted = row_count;

  delete from public.interview_slots slot
  where slot.starts_at < now() - interval '60 days'
    and not exists (select 1 from public.applications application where application.interview_slot_id = slot.id);

  return deleted;
end $$;

-- Supabase exposes functions over its API by default; this one is for the scheduler only.
revoke all on function public.delete_expired_applications() from public, anon, authenticated;

-- Every day at 2:00 AM Philippine time (18:00 UTC). Scheduling the same name again just updates it.
select cron.schedule('delete-expired-applications', '0 18 * * *', 'select public.delete_expired_applications()');

-- Clear anything already past 60 days right now.
select public.delete_expired_applications() as applications_deleted_now;
