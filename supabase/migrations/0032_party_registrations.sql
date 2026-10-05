-- Political party registration: run after 0028. Private documents and records;
-- all access is through the server, which checks the portal tab and unit scope.
create table if not exists public.party_registrations (
  id uuid primary key,
  reference text not null unique,
  party_name text not null,
  college text not null default '',
  email text not null,
  payload jsonb not null,
  documents jsonb not null,
  created_at timestamptz not null default now(),
  review jsonb not null default '{}'::jsonb,
  reviewed_by text,
  reviewed_at timestamptz
);
create index if not exists party_registrations_unit_created on public.party_registrations(college, created_at desc);
alter table public.party_registrations enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('party-registration', 'party-registration', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.check_party_registration_period() returns trigger
language plpgsql set search_path = public as $$
declare period record;
begin
  select mode, opens_at, closes_at, grace_ends_at into period
  from public.unit_periods where kind = 'party-registration' and college = new.college;
  if not found
    or (period.mode = 'scheduled' and (period.opens_at > clock_timestamp() or period.closes_at <= clock_timestamp()))
    or (period.mode = 'closed' and (period.grace_ends_at is null or period.grace_ends_at <= clock_timestamp())) then
    raise exception 'party_registration_closed';
  end if;
  return new;
end $$;
drop trigger if exists party_registration_period on public.party_registrations;
create trigger party_registration_period before insert on public.party_registrations
for each row execute function public.check_party_registration_period();
notify pgrst, 'reload schema';
