-- The party portal (/party): every member of a political party has an account, made on the
-- Political Party Registration page, and the party's members share one group. A party is made by
-- its first member, who is its contact person; others ask to join, and the contact person
-- approves them. Members upload the party's documents requirement by requirement, and the
-- Comelec unit the party registers with reviews each one, leaving feedback.
--
-- Additive only: it adds tables and functions and changes nothing that exists. All access is
-- through the server's admin client, which checks the party portal session or the commission
-- portal tab first, so row level security is on with no policies.

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- The unit it registers with: '' is the Central Comelec, as in party_registrations.
  college text not null default '',
  established_at date not null,
  headquarters text not null default '',
  contact_member_id uuid,
  status text not null default 'pending' check (status in ('pending', 'accredited', 'declined', 'withdrawn')),
  decision_remarks text not null default '',
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A name names one party: typing an existing party's name means joining it.
create unique index if not exists parties_name_unique on public.parties (lower(btrim(name))) where status <> 'withdrawn';
create index if not exists parties_unit_created on public.parties (college, created_at desc);

create table if not exists public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  email text not null,
  last_name text not null,
  first_name text not null,
  middle_name text not null default '',
  student_number text not null,
  mobile_number text not null,
  facebook_url text not null,
  college text not null,
  program text not null default '',
  year_level text not null,
  role text not null default 'member' check (role in ('contact', 'member')),
  -- requested: waiting for the contact person; active: in the party's group.
  status text not null default 'requested' check (status in ('requested', 'active', 'declined', 'removed')),
  consent_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  notices_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One party portal account per UST email at a time.
create unique index if not exists party_members_email_unique on public.party_members (lower(email)) where status in ('requested', 'active');
create index if not exists party_members_party on public.party_members (party_id, status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'parties_contact_member_fk') then
    alter table public.parties add constraint parties_contact_member_fk foreign key (contact_member_id) references public.party_members(id) on delete set null;
  end if;
end $$;

-- One row per requirement a party has started: its files, and where its review stands.
create table if not exists public.party_submissions (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  requirement text not null,
  -- [{ name, path, size, type, uploadedBy, uploadedAt }], the files kept in R2's private bucket.
  files jsonb not null default '[]'::jsonb,
  -- draft: being put together; submitted: sent, waiting for review; changes: sent back with feedback; approved.
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'changes')),
  submitted_by text,
  submitted_at timestamptz,
  feedback text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (party_id, requirement)
);

-- What the party portal's Notifications list: feedback, decisions, members joining.
create table if not exists public.party_notices (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  actor text not null default '',
  -- For the contact person alone (someone asking to join).
  for_contact boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists party_notices_party_created on public.party_notices (party_id, created_at desc);

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_submissions enable row level security;
alter table public.party_notices enable row level security;

-- A new party needs its unit's registration period open, as the one-shot registration did (0032).
create or replace trigger party_period before insert on public.parties
for each row execute function public.check_party_registration_period();

-- Adding and removing files in one statement each, so two members uploading at once never lose
-- each other's files. Sent or approved documents are locked.
create or replace function public.party_submission_add_files(p_party uuid, p_requirement text, p_files jsonb)
returns public.party_submissions
language plpgsql set search_path = public as $$
declare submission public.party_submissions;
begin
  insert into public.party_submissions (party_id, requirement) values (p_party, p_requirement)
  on conflict (party_id, requirement) do nothing;
  select * into submission from public.party_submissions where party_id = p_party and requirement = p_requirement for update;
  if submission.status in ('submitted', 'approved') then
    raise exception 'party_submission_locked';
  end if;
  update public.party_submissions set files = files || p_files, updated_at = now()
  where id = submission.id returning * into submission;
  return submission;
end $$;

create or replace function public.party_submission_remove_file(p_party uuid, p_requirement text, p_path text)
returns public.party_submissions
language plpgsql set search_path = public as $$
declare submission public.party_submissions;
begin
  select * into submission from public.party_submissions where party_id = p_party and requirement = p_requirement for update;
  if not found then
    return null;
  end if;
  if submission.status in ('submitted', 'approved') then
    raise exception 'party_submission_locked';
  end if;
  update public.party_submissions
  set files = coalesce((select jsonb_agg(file) from jsonb_array_elements(files) as file where file->>'path' <> p_path), '[]'::jsonb), updated_at = now()
  where id = submission.id returning * into submission;
  return submission;
end $$;

revoke execute on function public.party_submission_add_files(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.party_submission_remove_file(uuid, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
