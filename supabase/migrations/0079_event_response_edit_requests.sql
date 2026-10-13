-- Respondents request corrections through reference-and-surname tracking.
create table if not exists public.event_response_edit_requests (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  registration_id uuid references public.event_registrations(id) on delete cascade,
  rsvp_response_id uuid references public.event_rsvp_responses(id) on delete cascade,
  requested_changes text not null check (length(btrim(requested_changes)) between 1 and 4000),
  status text not null default 'pending' check (status in ('pending', 'addressed')),
  created_at timestamptz not null default now(),
  addressed_at timestamptz,
  addressed_by text,
  check (num_nonnulls(registration_id, rsvp_response_id) = 1)
);
create unique index if not exists event_registration_pending_edit
  on public.event_response_edit_requests(registration_id) where status = 'pending';
create unique index if not exists event_rsvp_pending_edit
  on public.event_response_edit_requests(rsvp_response_id) where status = 'pending';
create index if not exists event_response_edit_requests_event
  on public.event_response_edit_requests(event_id, created_at desc);
alter table public.event_response_edit_requests enable row level security;
-- No browser policies. Server actions verify the tracked identity or event editor.
notify pgrst, 'reload schema';
