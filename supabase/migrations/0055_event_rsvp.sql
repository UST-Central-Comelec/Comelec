-- Private collaborator RSVP forms, independent of public registrations and evaluations.
create table if not exists public.event_rsvp_forms (
  event_id text primary key references public.events(id) on delete cascade,
  enabled boolean not null default false,
  invitation_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);
create table if not exists public.event_rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.event_rsvp_forms(event_id) on delete cascade,
  email text not null,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);
create index if not exists event_rsvp_responses_event_created on public.event_rsvp_responses(event_id, created_at desc);
alter table public.event_rsvp_forms enable row level security;
alter table public.event_rsvp_responses enable row level security;
-- Access is enforced by server actions; no direct browser read/write policies.
notify pgrst, 'reload schema';
