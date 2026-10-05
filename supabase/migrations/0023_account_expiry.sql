-- UST Central Comelec — the date commissioners' portal access ends (the end-of-school-year clean-up).
--
-- One row. After the end of `expires_on` (Philippine time), every commissioner's account
-- (Executive Board, Executive Associate, Deputy) is revoked. Official accounts, advisers and admins
-- have no expiry. `swept_at` is when that was done for this date; setting a new date clears it, so
-- accounts restored or added afterwards run until the new date.
-- The date is set in the portal under Accounts → Expiration. It starts as June 30, 2027.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0022 first. Safe to re-run.

create table if not exists public.account_expiry (
  id boolean primary key default true check (id),
  expires_on date not null,
  swept_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

insert into public.account_expiry (id, expires_on) values (true, '2027-06-30')
on conflict (id) do nothing;

-- Read and written only by the server with the secret key.
alter table public.account_expiry enable row level security;

notify pgrst, 'reload schema';
