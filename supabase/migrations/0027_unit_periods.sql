-- UST Central Comelec — every unit opens and closes its own Recruitment, Political Party
-- Registration and Filing of Candidacy.
--
-- Until now there was one setting of each for the whole commission (public.recruitment_settings,
-- 0010 and 0011; public.filing_periods, 0015). Now the Central Comelec and each college's Local
-- Comelec unit has its own, set from its own Settings subtab in the portal: a row here per unit per
-- kind. A unit with no row hasn't opened anything, and counts as closed.
--
-- Each row also carries the same details an event has (name, description, date and times, venue,
-- who it's open to). While a unit's period is open, it's listed on the website's Events page and in
-- the portal's Events tab with those details, beside the events added under Events.
--
-- The Central Comelec's rows start as the old single settings stood, so nothing opens or closes by
-- running this. The old tables are left in place, no longer read.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0019 first. Safe to re-run.

create table if not exists public.unit_periods (
  kind text not null check (kind in ('recruitment', 'party-registration', 'candidacy')),
  -- Whose it is: '' for the Central Comelec, or the college of a Local Comelec unit.
  college text not null default '',
  -- The same modes as before:
  --   'scheduled': open until closes_at, then closed automatically;
  --   'open':      open with no closing date;
  --   'closed':    closed once grace_ends_at passes (null: closed straight away).
  mode text not null default 'closed' check (mode in ('scheduled', 'open', 'closed')),
  closes_at timestamptz,
  grace_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  -- The event details, as on the portal's event form. All empty until the unit fills them in;
  -- details_updated_at says whether it has.
  name text,
  summary text,
  background text not null default '',
  event_date date,
  ingress_time time,
  starts_time time,
  ends_time time,
  egress_time time,
  venue_mode text check (venue_mode in ('onsite', 'online')),
  venue_details text,
  open_to_students boolean not null default true,
  open_to_externals boolean not null default false,
  open_to_admins boolean not null default false,
  details_updated_at timestamptz,
  details_updated_by text,
  primary key (kind, college),
  check (mode <> 'scheduled' or closes_at is not null),
  -- Filled in together, with the same rules as an event (0019).
  check (details_updated_at is null or (name is not null and summary is not null and event_date is not null and starts_time is not null and ends_time is not null and venue_mode is not null and venue_details is not null)),
  check (starts_time is null or ends_time is null or starts_time < ends_time),
  check (ingress_time is null or ingress_time <= starts_time),
  check (egress_time is null or egress_time >= ends_time),
  check (open_to_students or open_to_externals or open_to_admins)
);

-- The Central Comelec's settings as they stand, carried over from the old tables where they exist.
do $$
begin
  if to_regclass('public.recruitment_settings') is not null then
    insert into public.unit_periods (kind, college, mode, closes_at, grace_ends_at, updated_at, updated_by)
    select 'recruitment', '', mode, closes_at, grace_ends_at, updated_at, updated_by from public.recruitment_settings
    on conflict (kind, college) do nothing;
  end if;
  if to_regclass('public.filing_periods') is not null then
    insert into public.unit_periods (kind, college, mode, closes_at, grace_ends_at, updated_at, updated_by)
    select kind, '', mode, closes_at, grace_ends_at, updated_at, updated_by from public.filing_periods
    on conflict (kind, college) do nothing;
  end if;
end $$;

-- Read and written only by the server with the secret key.
alter table public.unit_periods enable row level security;

-- Refuses a new application while the unit it's for isn't taking any, including a form left open in
-- a tab past the closing time. An application to serve in the Central Comelec goes by the Central
-- Comelec's period; one to serve in a Local Comelec, by the applicant's own college's.
create or replace function public.check_application_period() returns trigger
language plpgsql as $$
declare
  period record;
begin
  select mode, closes_at, grace_ends_at into period
  from public.unit_periods
  where kind = 'recruitment' and college = case when new.preferred_body = 'local' then new.college else '' end;
  if not found
    or (period.mode = 'closed' and (period.grace_ends_at is null or now() >= period.grace_ends_at))
    or (period.mode = 'scheduled' and now() >= period.closes_at) then
    raise exception 'applications_closed';
  end if;
  return new;
end $$;

-- Tell the Supabase API about the new table now, instead of waiting for it to notice.
notify pgrst, 'reload schema';
