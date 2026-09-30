-- UST Central Comelec — conflicts applicants declare on the Qualifications step of /apply: another
-- University office, a political party, fraternity or sorority, or a politically involved
-- organization. None disqualifies an applicant, but each must be resolved before they take office,
-- and submitting the form with one means pledging to resolve it.
-- Stored as a list of { "type": "office" | "party" | "politics", "detail": "what they named" }
-- (src/lib/applications/options.ts). An empty list means none; null means the application was sent
-- before the form asked.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0004 first. Safe to re-run.

alter table public.applications add column if not exists conflicts jsonb check (conflicts is null or jsonb_typeof(conflicts) = 'array');
