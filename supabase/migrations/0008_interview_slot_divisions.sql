-- UST Central Comelec — each interview slot belongs to one division. Divisions set their own
-- interview availability in the portal, and applicants only see the times for the division they
-- chose on /apply.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0006 first. Safe to re-run.

-- Division ids match src/lib/applications/options.ts (divisions).
alter table public.interview_slots add column if not exists division text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'interview_slots_division_check') then
    alter table public.interview_slots
      add constraint interview_slots_division_check check (division in ('executive', 'legal', 'operations', 'public-information'));
  end if;

  -- Required from now on. Slots added before this migration have no division; while any are left
  -- (the portal lists them as "No division" so they can be deleted), the column stays optional.
  if not exists (select 1 from public.interview_slots where division is null) then
    alter table public.interview_slots alter column division set not null;
  end if;
end $$;

create index if not exists interview_slots_division_idx on public.interview_slots (division, starts_at);
