-- UST Central Comelec — Commission directory groups.
-- En Banc and the Chamber of Chairpersons are no longer entered by hand; the site builds them:
--   En Banc: every Local Comelec Central Representative (one per college) + the Central Comelec
--            Executive Board.
--   Chamber of Chairpersons: every Local Comelec Chairperson. One of them is Primus (head of the
--            chamber) and one is Vicar (their associate), set in the portal: chamber_role below.
-- Existing En Banc entries become Local Comelec Central Representatives of the same college, so
-- they keep showing under En Banc.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0001 first. Safe to re-run.

alter table public.members add column if not exists chamber_role text check (chamber_role in ('primus', 'vicar'));

-- At most one Primus and one Vicar.
create unique index if not exists members_chamber_role_idx on public.members (chamber_role) where chamber_role is not null;

update public.members
set body = 'local', position = 'Central Representative', updated_at = now(), updated_by = 'system'
where body = 'en-banc';
