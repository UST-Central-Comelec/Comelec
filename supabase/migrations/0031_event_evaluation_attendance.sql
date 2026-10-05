-- Run after 0030. Each event owns its evaluation settings and responses.
begin;
alter table public.event_registrations add column if not exists attendance_confirmed_at timestamptz;
create table if not exists public.event_evaluation_forms (
  event_id text primary key references public.events(id) on delete cascade,
  enabled boolean not null default false,
  allow_anonymous boolean not null default false,
  questions jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.event_evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  registration_id uuid references public.event_registrations(id) on delete cascade,
  anonymous boolean not null default false,
  answers jsonb not null,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  check ((anonymous and registration_id is null) or (not anonymous and registration_id is not null)),
  unique (registration_id)
);
create index if not exists event_evaluation_responses_event_idx on public.event_evaluation_responses(event_id);
alter table public.event_evaluation_forms enable row level security;
alter table public.event_evaluation_responses enable row level security;
revoke all on public.event_evaluation_forms, public.event_evaluation_responses from anon, authenticated;
grant all on public.event_evaluation_forms, public.event_evaluation_responses to service_role;
commit;
notify pgrst, 'reload schema';
