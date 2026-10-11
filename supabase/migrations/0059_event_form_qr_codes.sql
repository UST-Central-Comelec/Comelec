-- QR codes for each event's forms (registration, RSVP, evaluation). A code points to /q/<token>,
-- which forwards to the form; generating a new code replaces the token, so the old code stops working.
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.
create table if not exists public.event_form_qr_codes (
  event_id text not null references public.events(id) on delete cascade,
  form text not null check (form in ('registration', 'rsvp', 'evaluation')),
  token text not null unique check (token ~ '^[A-Za-z0-9]{10}$'),
  created_at timestamptz not null default now(),
  primary key (event_id, form)
);
alter table public.event_form_qr_codes enable row level security;
-- Read and written by the server only; no browser policies.
notify pgrst, 'reload schema';
