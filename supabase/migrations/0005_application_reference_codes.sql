-- UST Central Comelec — a reference code per application, shown to the applicant after they submit
-- and used with their surname on /apply/track to look the application up.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0004_applications.sql first. Safe to re-run.

alter table public.applications add column if not exists reference_code text;

-- Give any applications saved before this migration a code. New ones get theirs from the server
-- (src/lib/applications/reference.ts), formatted like CC-7K3M-9QXA.
update public.applications
set reference_code = 'CC-' || upper(substr(md5(id::text), 1, 4)) || '-' || upper(substr(md5(id::text), 5, 4))
where reference_code is null;

alter table public.applications alter column reference_code set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'applications_reference_code_format') then
    alter table public.applications
      add constraint applications_reference_code_format check (reference_code ~ '^CC-[A-Z0-9]{4}-[A-Z0-9]{4}$');
  end if;
end $$;

-- Unique, and the index the tracking lookup uses.
create unique index if not exists applications_reference_code_key on public.applications (reference_code);

-- Portal review. Every application starts as 'pending' (shown as "Pending review"); commissioners
-- mark it 'accepted' or 'declined' (shown as "Rejected") under Applications. These record who
-- made the last change and when.
alter table public.applications add column if not exists status_updated_at timestamptz;
alter table public.applications add column if not exists status_updated_by text;

create index if not exists applications_status_idx on public.applications (status, created_at desc);
