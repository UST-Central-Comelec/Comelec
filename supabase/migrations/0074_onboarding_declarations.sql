-- Onboarding e-declarations. Request access on the sign-in page now opens with the Data Privacy
-- Notice and Consent, then the requester's profile, then the onboarding documents to accept
-- (src/lib/onboarding/documents.ts). Run once in the Supabase dashboard: SQL Editor → New query →
-- paste this file → Run. Safe to re-run.
begin;

-- Legals → Documents → Onboarding: each save of a document is a new row. Version 1 of every
-- document is the text in src/lib/onboarding/documents.ts, so saved versions start at 2. The
-- latest version is the one requesters see; acceptances record the version they were shown.
create table if not exists public.onboarding_documents (
  key text not null check (key ~ '^[a-z][a-z-]{1,40}$'),
  version integer not null check (version >= 2),
  title text not null check (length(btrim(title)) between 1 and 120),
  statement text not null check (length(btrim(statement)) between 1 and 300),
  body text not null check (length(btrim(body)) between 1 and 60000),
  saved_at timestamptz not null default now(),
  saved_by text not null,
  primary key (key, version)
);
alter table public.onboarding_documents enable row level security;
revoke all on public.onboarding_documents from anon, authenticated;
grant all on public.onboarding_documents to service_role;

-- What the requester agreed to, and when: [{ key, title, version, acceptedAt }]. Kept on the
-- request until it's deleted (60 days), and copied to the account when it's approved.
-- `application_reference` is the accepted application a "Join the Commission" request came from;
-- those are approved as soon as they're sent.
alter table public.access_requests
  add column if not exists declarations jsonb not null default '[]'::jsonb check (jsonb_typeof(declarations) = 'array'),
  add column if not exists application_reference text;

alter table public.portal_accounts
  add column if not exists declarations jsonb not null default '[]'::jsonb check (jsonb_typeof(declarations) = 'array'),
  add column if not exists contact_number text;

commit;
