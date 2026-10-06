-- Announcements and activity notifications. Access is checked by the server;
-- no browser role can read or write these tables directly. Safe to re-run.
create table if not exists public.portal_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('announcement', 'activity')),
  title text not null,
  body text not null default '',
  sender_name text not null,
  audience_label text not null,
  recipient_ids text[] not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_messages_recipients on public.portal_messages using gin (recipient_ids);
create index if not exists portal_messages_latest on public.portal_messages (created_at desc, id desc);
create table if not exists public.portal_message_reads (
  message_id uuid not null references public.portal_messages(id) on delete cascade,
  account_id text not null,
  read_at timestamptz not null default now(),
  primary key (message_id, account_id)
);
alter table public.portal_messages enable row level security;
alter table public.portal_message_reads enable row level security;
notify pgrst, 'reload schema';
