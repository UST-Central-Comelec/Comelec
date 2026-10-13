-- Extend tracking edit requests to commissioner applications and portal access requests.
create table if not exists public.submission_edit_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade,
  access_request_id uuid references public.access_requests(id) on delete cascade,
  requested_changes text not null check (length(btrim(requested_changes)) between 1 and 4000),
  status text not null default 'pending' check (status in ('pending', 'addressed')),
  created_at timestamptz not null default now(),
  addressed_at timestamptz,
  addressed_by text,
  check (num_nonnulls(application_id, access_request_id) = 1)
);
create unique index if not exists application_pending_edit
  on public.submission_edit_requests(application_id) where status = 'pending';
create unique index if not exists access_request_pending_edit
  on public.submission_edit_requests(access_request_id) where status = 'pending';
alter table public.submission_edit_requests enable row level security;
-- No direct browser policies: actions check the tracked identity or the managing officer.
notify pgrst, 'reload schema';
