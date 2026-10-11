-- Apply after 0068_secretariat_settings.sql.
-- Secretariat → Calendar: each unit's notes, to-do list and highlighted dates. Events and each unit's
-- Recruitment, Political Party Registration and Filing of Candidacy aren't stored here: the calendar
-- reads them from public.events and public.unit_periods.
--
-- Every row belongs to a unit: college is null for the Central Comelec, or a college's Local unit.
-- Notes and to-dos stay with their unit. The Central Comelec's highlights (moratorium periods,
-- holidays, university events) also show on every Local unit's calendar, read-only.
-- Private to the portal: server actions check the tab, editing rights and the unit.
begin;

create table if not exists public.calendar_notes (
  id uuid primary key default gen_random_uuid(),
  college text,
  note_date date not null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_by text not null,
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);
create index if not exists calendar_notes_unit_date on public.calendar_notes (coalesce(college, ''), note_date);
alter table public.calendar_notes enable row level security;
revoke all on public.calendar_notes from anon, authenticated;
grant all on public.calendar_notes to service_role;

create table if not exists public.calendar_todos (
  id uuid primary key default gen_random_uuid(),
  college text,
  title text not null check (length(btrim(title)) between 1 and 300),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  done_by text,
  created_by text not null,
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null,
  check (done = (done_at is not null))
);
create index if not exists calendar_todos_unit on public.calendar_todos (coalesce(college, ''), done, due_date);
alter table public.calendar_todos enable row level security;
revoke all on public.calendar_todos from anon, authenticated;
grant all on public.calendar_todos to service_role;

create table if not exists public.calendar_highlights (
  id uuid primary key default gen_random_uuid(),
  college text,
  start_date date not null,
  end_date date not null,
  -- moratorium, holiday and university have colours of their own; custom takes `color`.
  kind text not null check (kind in ('moratorium', 'holiday', 'university', 'custom')),
  color text check (color is null or color in ('gold', 'orange', 'teal', 'blue', 'pink', 'slate')),
  label text not null default '' check (length(label) <= 120),
  created_by text not null,
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null,
  check (end_date >= start_date and end_date - start_date <= 366),
  check ((kind = 'custom') = (color is not null))
);
create index if not exists calendar_highlights_unit_dates on public.calendar_highlights (coalesce(college, ''), start_date, end_date);
alter table public.calendar_highlights enable row level security;
revoke all on public.calendar_highlights from anon, authenticated;
grant all on public.calendar_highlights to service_role;

notify pgrst, 'reload schema';
commit;
