-- UST Central Comelec — requests for Commission Portal access, sent from the portal's sign-in page
-- (Request access). The requester proves the UST Google account twice: once before filling in the
-- form, and again when submitting. Executives approve (which adds the account) or decline them under
-- Accounts. Requesters track theirs on Track application with the PA- reference code and their
-- student number. Requests are deleted 60 days after they're sent, like applications (0007).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Safe to re-run.

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique check (reference_code ~ '^PA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'),
  last_name text not null,
  first_name text not null,
  middle_initial text not null check (char_length(middle_initial) = 1),
  student_number text not null check (student_number ~ '^[0-9]{10}$'),
  -- The Google-verified UST email; approving adds a portal account for it.
  email text not null check (email = lower(email) and email like '%@ust.edu.ph'),
  contact_number text,
  college text not null,
  program text not null,
  year_level text not null check (year_level in ('1', '2', '3', '4', '5', 'swis')),
  -- Their position in the commission, in their own words, for the executive deciding.
  position text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

-- One open request per email at a time.
create unique index if not exists access_requests_pending_email_idx on public.access_requests (email) where status = 'pending';
create index if not exists access_requests_created_at_idx on public.access_requests (created_at desc);

-- Personal data: only the server (secret key) reads or writes it.
alter table public.access_requests enable row level security;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.delete_expired_access_requests() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  delete from public.access_requests where created_at < now() - interval '60 days';
  get diagnostics deleted = row_count;
  return deleted;
end $$;

revoke all on function public.delete_expired_access_requests() from public, anon, authenticated;

-- Every day at 2:05 AM Philippine time, just after the applications job.
select cron.schedule('delete-expired-access-requests', '5 18 * * *', 'select public.delete_expired_access_requests()');
