-- Each official document gets its own page on the website (/archive/<id>) showing its main text
-- and signatories ("SGD." with name and position — never signature images).
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.

alter table public.documents
  add column if not exists body text not null default '',
  add column if not exists signatories jsonb not null default '[]'::jsonb;
