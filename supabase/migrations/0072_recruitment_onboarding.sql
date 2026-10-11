-- Recruitment → Onboarding: each unit's acceptance content and Messenger invite.
begin;
create table if not exists public.recruitment_onboarding (
  college text primary key default '',
  body text not null check (length(btrim(body)) between 1 and 10000),
  messenger_url text not null default '' check (length(messenger_url) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by text not null
);
alter table public.recruitment_onboarding enable row level security;
revoke all on public.recruitment_onboarding from anon, authenticated;
grant all on public.recruitment_onboarding to service_role;
commit;
