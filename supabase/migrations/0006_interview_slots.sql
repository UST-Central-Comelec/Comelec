-- UST Central Comelec — interview slots that commissioners add in the portal (Interviews), and the
-- slot each applicant books on /apply.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0004 and 0005 first. Safe to re-run.

create table if not exists public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  mode text not null check (mode in ('online', 'onsite')),
  -- Room for on-site interviews, or a note such as "Google Meet link sent by email" for online ones.
  location text,
  -- How many applicants can book this slot.
  capacity integer not null default 1 check (capacity between 1 and 100),
  created_at timestamptz not null default now(),
  created_by text not null
);

create index if not exists interview_slots_starts_at_idx on public.interview_slots (starts_at);

-- Deleting a slot is only allowed from the portal when nobody has booked it; "set null" is a
-- safety net so an application is never lost with its slot.
alter table public.applications
  add column if not exists interview_slot_id uuid references public.interview_slots (id) on delete set null;

create index if not exists applications_interview_slot_idx on public.applications (interview_slot_id);

-- Stops a slot from being overbooked, even when two applicants pick its last place at the same
-- moment: the slot row is locked while its bookings are counted.
create or replace function public.check_interview_slot_capacity() returns trigger
language plpgsql as $$
declare
  slot_capacity integer;
  booked integer;
begin
  if new.interview_slot_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.interview_slot_id is not distinct from old.interview_slot_id then
    return new;
  end if;

  select capacity into slot_capacity from public.interview_slots where id = new.interview_slot_id for update;
  if slot_capacity is null then
    raise exception 'interview_slot_missing';
  end if;

  select count(*) into booked from public.applications where interview_slot_id = new.interview_slot_id and id <> new.id;
  if booked >= slot_capacity then
    raise exception 'interview_slot_full';
  end if;

  return new;
end $$;

drop trigger if exists applications_interview_slot_capacity on public.applications;
create trigger applications_interview_slot_capacity
  before insert or update of interview_slot_id on public.applications
  for each row execute function public.check_interview_slot_capacity();

-- Server-only, like the other application tables.
alter table public.interview_slots enable row level security;
