-- UST Central Comelec — the new event registration form, and the switch for Google verification.
--
-- An event can now require student authentication through Google, or not (require_google). When it
-- does, anyone registering as a UST student or as UST faculty or staff verifies their @ust.edu.ph
-- account first, and the verified email is the one saved. Everyone else, and everyone at an event
-- that doesn't require it, types their email.
--
-- The form itself changed: five steps (consent; personal information; university affiliation;
-- organization; logistics). Registrations can come from outside the University now, so the email no
-- longer has to be a UST one, and the old student-only answers (student number, year level,
-- organizations, interest) are no longer asked; they're kept on the rows that have them.
--
-- `requests` holds the logistics a registrant asked for, each with the unit's answer:
--   { "parking": { "plate": "ABC 1234", "model": "…", "color": "…", "arrival": "08:30", "status": "pending" },
--     "accessibility": { "status": "approved" }, "navigation": {…}, "dietary": { "allergens": "…", "status": … },
--     "certificate": {…}, "excuseLetter": {…} }
-- where status is pending, approved or unavailable.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0028 first. Safe to re-run.

alter table public.events add column if not exists require_google boolean not null default true;

alter table public.event_registrations alter column student_number drop not null;
alter table public.event_registrations alter column college drop not null;
alter table public.event_registrations alter column program drop not null;
alter table public.event_registrations alter column year_level drop not null;
alter table public.event_registrations alter column interest drop not null;

-- The checks that held every registrant to a UST email and a student number.
do $$
declare
  rule record;
begin
  for rule in
    select conname from pg_constraint
    where conrelid = 'public.event_registrations'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%ust.edu.ph%' or pg_get_constraintdef(oid) like '%student_number%')
  loop
    execute format('alter table public.event_registrations drop constraint %I', rule.conname);
  end loop;
end $$;

alter table public.event_registrations drop constraint if exists event_registrations_email_lower;
alter table public.event_registrations add constraint event_registrations_email_lower check (email = lower(email) and email like '%_@_%');

alter table public.event_registrations add column if not exists middle_name text not null default '';
alter table public.event_registrations add column if not exists age smallint check (age between 10 and 120);
alter table public.event_registrations add column if not exists affiliation text check (affiliation in ('ust-student', 'ust-staff', 'other-institution', 'independent'));
-- UST faculty and staff: their college, faculty or office. Others: their university or institution.
alter table public.event_registrations add column if not exists office text;
alter table public.event_registrations add column if not exists institution text;
alter table public.event_registrations add column if not exists attending_as text check (attending_as in ('representative', 'independent'));
alter table public.event_registrations add column if not exists organization_name text;
alter table public.event_registrations add column if not exists organization_committee text;
alter table public.event_registrations add column if not exists organization_position text;
-- The email was verified through UST Google sign-in. Every registration before this file was.
alter table public.event_registrations add column if not exists verified boolean not null default true;
alter table public.event_registrations add column if not exists requests jsonb not null default '{}';

notify pgrst, 'reload schema';
