-- UST Central Comelec — events and activities, and the students who register for them.
-- Events are added in the portal (Events) and listed on the website's Events & activities page.
-- Each belongs to the unit that organizes it: the Central Comelec, or one college's Local Comelec
-- unit. Central accounts manage the Central Comelec's events, and can read every unit's and ask it
-- for changes; a Local account manages only its own college's (src/lib/events/access.ts).
-- Students register from the website after verifying their UST Google account, or join the waitlist
-- while registration hasn't opened yet: one entry per email per event.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0017 first. Safe to re-run.

create table if not exists public.events (
  id text primary key,
  name text not null,
  -- The short description shown when the event is opened in the website's list.
  summary text not null,
  -- The event's background, shown on its own page. Paragraphs are separated by blank lines.
  background text not null default '',
  -- The day and times in Manila. Ingress is when participants may start coming in, and egress is
  -- when they should have left; the activity itself runs from starts_time to ends_time.
  event_date date not null,
  ingress_time time,
  starts_time time not null,
  ends_time time not null,
  egress_time time,
  venue_mode text not null check (venue_mode in ('onsite', 'online')),
  -- The room and building, or the platform and how to get the link.
  venue_details text not null,
  -- Who may take part.
  open_to_students boolean not null default true,
  open_to_externals boolean not null default false,
  open_to_admins boolean not null default false,
  registration_status text not null default 'closed' check (registration_status in ('closed', 'open', 'waitlist', 'cancelled', 'rescheduled')),
  -- The organizing unit: the Central Comelec, or the Local Comelec unit of `college`.
  organizer text not null check (organizer in ('central', 'local')),
  college text,
  -- Changes the Central Comelec asked a Local unit to make, until the unit marks them addressed.
  change_request text check (char_length(change_request) <= 1000),
  change_requested_by text,
  change_requested_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  check (starts_time < ends_time),
  check (ingress_time is null or ingress_time <= starts_time),
  check (egress_time is null or egress_time >= ends_time),
  check (open_to_students or open_to_externals or open_to_admins),
  check ((organizer = 'central') = (college is null))
);

create index if not exists events_event_date_idx on public.events (event_date);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  -- Deleting an event deletes its registrations with it.
  event_id text not null references public.events (id) on delete cascade,
  -- 'waitlisted' is someone who joined before registration opened. Registering once it opens
  -- moves the same entry to 'registered'.
  status text not null default 'registered' check (status in ('registered', 'waitlisted')),
  last_name text not null,
  first_name text not null,
  -- Empty for someone without a middle name.
  middle_initial text not null default '' check (char_length(middle_initial) <= 1),
  student_number text not null check (student_number ~ '^[0-9]{10}$'),
  -- The Google-verified UST email, whatever the form said.
  email text not null check (email = lower(email) and email like '%@ust.edu.ph'),
  sex text not null check (sex in ('male', 'female', 'undisclosed')),
  -- College and program names as listed on ust.edu.ph (src/lib/applications/options.ts).
  college text not null,
  program text not null,
  year_level text not null check (year_level in ('1', '2', '3', '4', '5', 'swis')),
  -- Every organization they belong to, as they named it. Empty when none.
  organizations text[] not null default '{}' check (cardinality(organizations) <= 8),
  -- How interested they are: 1 (not interested) to 5 (extremely interested).
  interest smallint not null check (interest between 1 and 5),
  consent boolean not null check (consent),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, email)
);

-- Registrations hold personal data. Only the server (secret key) reads or writes these tables; Row
-- Level Security with no policies blocks the public (publishable/anon) key entirely.
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

-- How many people registered and joined the waitlist per event, for the portal's Events list.
-- security_invoker makes the view follow the caller's access to event_registrations, so it's as
-- closed to the public key as the table is.
create or replace view public.event_registration_counts with (security_invoker = true) as
select
  event_id,
  count(*) filter (where status = 'registered')::integer as registered,
  count(*) filter (where status = 'waitlisted')::integer as waitlisted
from public.event_registrations
group by event_id;

revoke all on public.event_registration_counts from public, anon, authenticated;

-- Tell the Supabase API about the new tables now, instead of waiting for it to notice.
notify pgrst, 'reload schema';
