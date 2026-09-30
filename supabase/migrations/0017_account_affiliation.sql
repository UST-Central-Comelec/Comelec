-- UST Central Comelec — each portal account's college/faculty and affiliation: Central Comelec, or
-- a college's Local Comelec. Local accounts see only the Directory, Recruitment applications, PolPaR
-- and Filing of Candidacy, and only their own college's people there (src/lib/auth/session.ts).
-- Executives are always Central. Access requests (0016) carry the affiliation the requester gave.
-- Existing accounts become Central with no college; set each one's college under Accounts.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0016 first. Safe to re-run.

alter table public.portal_accounts add column if not exists college text;
alter table public.portal_accounts add column if not exists affiliation text not null default 'central';

alter table public.portal_accounts drop constraint if exists portal_accounts_affiliation_check;
alter table public.portal_accounts add constraint portal_accounts_affiliation_check check (
  affiliation in ('central', 'local')
  and (affiliation = 'central' or college is not null)
  and (role = 'commissioner' or affiliation = 'central')
);

alter table public.access_requests add column if not exists affiliation text not null default 'central';

alter table public.access_requests drop constraint if exists access_requests_affiliation_check;
alter table public.access_requests add constraint access_requests_affiliation_check check (affiliation in ('central', 'local'));

-- Tell the Supabase API about the new columns now, instead of waiting for it to notice.
notify pgrst, 'reload schema';
