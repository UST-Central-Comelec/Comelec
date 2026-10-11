-- Per-account applicant read state for Recruitment navigation badges.
create table if not exists public.portal_application_views (
  application_id uuid not null references public.applications(id) on delete cascade,
  account_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (application_id, account_id)
);
create index if not exists portal_application_views_account on public.portal_application_views(account_id);
alter table public.portal_application_views enable row level security;
notify pgrst, 'reload schema';
