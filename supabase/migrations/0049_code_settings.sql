-- Add Magna Carta to the shared revision workflow and document publication settings.
-- Run after 0025_code_revisions.sql. Safe to re-run.
alter table public.code_revisions drop constraint if exists code_revisions_code_check;
alter table public.code_revisions add constraint code_revisions_code_check
  check (code in ('constitution', 'elections-code', 'magna-carta'));

create table if not exists public.code_settings (
  code text primary key check (code in ('constitution', 'elections-code', 'magna-carta')),
  visibility text not null default 'hidden' check (visibility in ('published', 'hidden')),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Preserve existing public documents; the empty Magna Carta starts hidden.
insert into public.code_settings (code, visibility) values
  ('constitution', 'published'), ('elections-code', 'published'), ('magna-carta', 'hidden')
on conflict (code) do nothing;

-- The server authorizes reads and writes using the portal's document tab permissions.
alter table public.code_settings enable row level security;
notify pgrst, 'reload schema';
