-- UST Central Comelec — when Political Party Registration (PolPaR) and Filing of Candidacy are open,
-- set in the portal (PolPaR → Settings, Filing of Candidacy → Settings). One row per filing, with the
-- same modes as commissioner applications (0010, 0011):
--   mode 'scheduled': open until closes_at, then closed automatically (the countdown on its page);
--   mode 'open':      open with no closing date;
--   mode 'closed':    closed once grace_ends_at passes (null: closed straight away).
-- Both start closed.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Safe to re-run.

create table if not exists public.filing_periods (
  kind text primary key check (kind in ('party-registration', 'candidacy')),
  mode text not null default 'closed' check (mode in ('scheduled', 'open', 'closed')),
  closes_at timestamptz,
  grace_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  check (mode <> 'scheduled' or closes_at is not null)
);

insert into public.filing_periods (kind) values ('party-registration'), ('candidacy')
on conflict (kind) do nothing;

-- Read and written only by the server with the secret key.
alter table public.filing_periods enable row level security;
