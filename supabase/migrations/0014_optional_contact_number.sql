-- UST Central Comelec — the mobile number on /apply is optional. Applications sent without one
-- store null.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0004 first. Safe to re-run.

alter table public.applications alter column contact_number drop not null;
