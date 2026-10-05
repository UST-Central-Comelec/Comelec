-- UST Central Comelec — the Email Sender's outbox (portal → Apps → Email Sender).
--
-- One row per email written there: what it says, who it's for, when it goes out and how that went.
-- `audience` is a filter over the portal's accounts (a unit, a group of positions, optionally one
-- role), not a list of addresses: it's matched against the accounts when the email goes out, so a
-- scheduled email reaches whoever holds the position then. `deliveries` is who it actually went to.
--
-- status: scheduled (waiting for send_at; "Send now" is a schedule for this moment), sending, sent,
-- failed (nobody could be reached) or cancelled.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0023 first. Safe to re-run.

create table if not exists public.portal_emails (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  title text not null default '',
  body jsonb not null default '[]'::jsonb,
  audience jsonb not null,
  audience_label text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  -- True when a later time was picked; false for "Send now".
  scheduled boolean not null default false,
  send_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  deliveries jsonb not null default '[]'::jsonb,
  error text,
  sender_email text not null,
  sender_name text not null,
  sender_unit text not null,
  sender_affiliation text not null,
  sender_college text,
  created_at timestamptz not null default now()
);

-- What the dispatcher asks every minute: the scheduled emails whose time has come.
create index if not exists portal_emails_due on public.portal_emails (send_at) where status = 'scheduled';
create index if not exists portal_emails_created on public.portal_emails (created_at desc);

-- Read and written only by the server with the secret key.
alter table public.portal_emails enable row level security;

notify pgrst, 'reload schema';
