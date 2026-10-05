-- UST Central Comelec — which automatic emails are switched off or on (portal → Apps → Email
-- Sender → Automatic).
--
-- The site emails by itself when something happens: a receipt for an application, a notice to an
-- Executive Board, a change to an account. Each of those has a switch, and a default
-- (src/lib/notifications/switches.ts). A row here is one email whose switch differs from its
-- default; an email with no row follows its default. So this table starts empty, and every email
-- behaves as it did before.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0025 first. Safe to re-run.

create table if not exists public.email_settings (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

-- Read and written only by the server with the secret key.
alter table public.email_settings enable row level security;

notify pgrst, 'reload schema';
