-- UST Central Comelec — commissioner applications from the public /apply page, and the open slots
-- per position that commissioners set in the portal (Recruitment).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Safe to re-run.

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  last_name text not null,
  first_name text not null,
  middle_initial text not null check (char_length(middle_initial) = 1),
  student_number text not null check (student_number ~ '^[0-9]{10}$'),
  email text not null check (email = lower(email) and email like '%@ust.edu.ph'),
  contact_number text not null,
  facebook_url text not null,
  -- College and program names as listed on ust.edu.ph (src/lib/applications/options.ts).
  college text not null,
  program text not null,
  year_level text not null check (year_level in ('1', '2', '3', '4', '5', 'swis')),
  preferred_body text not null check (preferred_body in ('central', 'local')),
  -- Division and position as shown on the form; position_id matches recruitment_slots.
  division text not null,
  position text not null,
  position_id text not null,
  -- Google Drive links.
  cv_url text not null,
  endorsement_url text,
  portfolio_url text,
  consent boolean not null check (consent),
  -- Election year the application is for; one application per email per year.
  cycle integer not null default extract(year from now())::integer,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (email, cycle)
);

create index if not exists applications_created_at_idx on public.applications (created_at desc);

create table if not exists public.recruitment_slots (
  position_id text primary key,
  slots integer not null default 0 check (slots between 0 and 999),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

-- Applications hold personal data. Only the server (secret key) reads or writes these tables; Row
-- Level Security with no policies blocks the public (publishable/anon) key entirely.
alter table public.applications enable row level security;
alter table public.recruitment_slots enable row level security;
