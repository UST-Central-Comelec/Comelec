-- Apply after 0069_secretariat_calendar.sql.
-- Who's online: when each person last had a portal page open, for the header's online pill and its
-- list of everyone seen in the last 24 hours. One row per person (their sign-in email, so switching
-- between their Central and Local accounts doesn't list them twice), refreshed about once a minute
-- while a portal tab is in front. The other columns are what the list shows, copied from the account
-- they were last using.
-- Private to the portal: only the server reads and writes it, after checking the session.
begin;

create table if not exists public.portal_presence (
  email text primary key,
  account_id text not null,
  name text not null,
  role text not null default '',
  college text,
  avatar_url text,
  last_seen_at timestamptz not null default now()
);
create index if not exists portal_presence_last_seen on public.portal_presence (last_seen_at desc);
alter table public.portal_presence enable row level security;
revoke all on public.portal_presence from anon, authenticated;
grant all on public.portal_presence to service_role;

notify pgrst, 'reload schema';
commit;
