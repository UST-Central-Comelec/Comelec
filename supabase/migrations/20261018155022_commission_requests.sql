-- Commission-to-Local requests are separate from public filing accounts.
create table if not exists public.commission_request_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 1000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create unique index if not exists commission_request_types_name on public.commission_request_types (lower(btrim(name)));
insert into public.commission_request_types(name, description)
select name, description from (values
  ('Consultation', 'Arrange a consultation with a Local Comelec unit.'),
  ('Commissioner request', 'Ask a Local Comelec unit to send a commissioner to an activity.')
) as defaults(name, description)
where not exists (select 1 from public.commission_request_types);

create table if not exists public.commission_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null default ('RQ-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  batch_id uuid not null,
  type_id uuid not null references public.commission_request_types(id),
  -- Snapshot: renaming a type does not rewrite a request already sent.
  type_name text not null check (length(btrim(type_name)) between 1 and 100),
  sender_email text not null,
  sender_name text not null,
  sender_college text,
  college text not null check (length(btrim(college)) > 0),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  details text not null check (length(btrim(details)) between 1 and 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours'),
  mode text not null check (mode in ('in-person', 'online')),
  venue text not null check (length(btrim(venue)) between 1 and 300),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'done')),
  response text not null default '' check (length(response) <= 3000),
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference),
  unique (sender_email, batch_id, college)
);
create index if not exists commission_requests_unit_status on public.commission_requests(college, status, created_at desc);
create index if not exists commission_requests_sender on public.commission_requests(sender_email, created_at desc);
create index if not exists commission_requests_type on public.commission_requests(type_id);
alter table public.commission_requests enable row level security;
alter table public.commission_request_types enable row level security;
-- Portal sessions are checked server-side; neither public API role may read these records.
revoke all on public.commission_requests, public.commission_request_types from public, anon, authenticated;
grant select, insert, update on public.commission_requests, public.commission_request_types to service_role;
notify pgrst, 'reload schema';
