-- UST Central Comelec — website content, portal accounts and uploads.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Safe to re-run: tables, bucket and starter rows are only created if missing.

-- Content ------------------------------------------------------------------

create table if not exists public.news (
  id text primary key,
  title text not null,
  category text not null check (category in ('announcement', 'press-release', 'event', 'explainer', 'election-watch')),
  date date not null,
  excerpt text not null,
  body text not null default '',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create table if not exists public.documents (
  id text primary key,
  kind text not null check (kind in ('executive-order', 'memorandum', 'resolution', 'constitution', 'elections-code', 'proclamation')),
  title text not null,
  reference text not null default '',
  date date not null,
  summary text not null default '',
  file_url text,
  file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create table if not exists public.members (
  id text primary key,
  name text not null,
  position text not null,
  body text not null check (body in ('central', 'en-banc', 'local')),
  unit text not null default '',
  photo_url text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

-- Who may sign in to the portal (with their @ust.edu.ph Google account).
-- The built-in executive (PORTAL_EXECUTIVE_EMAIL) isn't stored here.
create table if not exists public.portal_accounts (
  id text primary key,
  name text not null,
  email text not null unique check (email = lower(email) and email like '%@ust.edu.ph'),
  role text not null check (role in ('commissioner', 'executive')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

-- The website reads and writes these only from the server, with the secret key. Row Level
-- Security with no policies blocks direct access with the public (publishable/anon) key.
alter table public.news enable row level security;
alter table public.documents enable row level security;
alter table public.members enable row level security;
alter table public.portal_accounts enable row level security;

-- Uploads ------------------------------------------------------------------

-- Public bucket: anyone can open a document PDF or member photo by its URL; only the server
-- (secret key) can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Starter content (what the site showed before Supabase) --------------------

insert into public.news (id, title, category, date, excerpt, body, featured, created_at, updated_at, updated_by) values
  ('2026-central-elections-calendar', 'The 2026 Central Elections calendar is now live', 'announcement', '2026-09-12', 'Mark your calendars. From accreditation to proclamation, here are the dates every Thomasian voter needs to know.', 'Mark your calendars. From accreditation to proclamation, here are the dates every Thomasian voter needs to know.', true, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed'),
  ('what-makes-a-vote-count', 'What makes a vote count? A guide to the ballot', 'election-watch', '2026-09-08', 'A quick, clear reference for making sure your voice is read exactly as you intend.', 'A quick, clear reference for making sure your voice is read exactly as you intend.', false, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed'),
  ('meet-the-commission-2026', 'Meet the commission behind the 2026 polls', 'announcement', '2026-08-27', 'Get to know the student leaders and professionals stewarding this year’s election.', 'Get to know the student leaders and professionals stewarding this year’s election.', false, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed'),
  ('students-guide-to-election-day', 'The student’s guide to election day', 'explainer', '2026-08-19', 'Everything you need to know before you step into the precinct.', 'Everything you need to know before you step into the precinct.', false, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed'),
  ('call-for-applications-electoral-board-2026', 'Call for applications: Electoral Board 2026', 'announcement', '2026-08-04', 'Applications are open to Thomasians who want to serve the student body.', 'Applications are open to Thomasians who want to serve the student body.', false, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed')
on conflict (id) do nothing;

insert into public.documents (id, kind, title, reference, date, summary, file_url, file_name, created_at, updated_at, updated_by) values
  ('2026-official-results', 'proclamation', '2026 Central Elections: Official results', '', '2026-05-24', '', null, null, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed')
on conflict (id) do nothing;

insert into public.members (id, name, position, body, unit, photo_url, display_order, created_at, updated_at, updated_by) values
  ('central-chairperson', 'To be announced', 'Chairperson', 'central', '', null, 1, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed'),
  ('central-vice-chairperson', 'To be announced', 'Vice Chairperson', 'central', '', null, 2, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed'),
  ('central-secretary-general', 'To be announced', 'Secretary General', 'central', '', null, 3, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z', 'seed')
on conflict (id) do nothing;
