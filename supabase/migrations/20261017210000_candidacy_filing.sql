-- Filing of Candidacy, and one account for the public filing portal (/filing). A student signs in
-- once with their UST Google account; the same account can be a political party's member
-- (party_members, 20261017190000_party_portal.sql) and a candidate. Each is still its own
-- application, filed and reviewed separately.
--
-- A candidate running under a party is endorsed by the party's contact person before the filing
-- reaches the Comelec unit; an independent candidate's goes straight there. Each unit's elective
-- positions are kept in elective_positions, edited under Administrative → Database.
--
-- Additive only. All access goes through the server's admin client, so row level security is on
-- with no policies.

create table if not exists public.public_accounts (
  id uuid primary key default gen_random_uuid(),
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
  consent_at timestamptz not null default now(),
  notices_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists public_accounts_email_unique on public.public_accounts (lower(email));

-- A party member is an account's membership; the member's own columns keep the profile as it was when they joined.
alter table public.party_members add column if not exists account_id uuid references public.public_accounts(id) on delete cascade;
create index if not exists party_members_account on public.party_members (account_id);

-- Each unit's elective positions, in order: '' is the Central Student Council's Executive Board.
create table if not exists public.elective_positions (
  unit text primary key,
  positions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.candidacies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.public_accounts(id) on delete cascade,
  -- The unit it's filed with: '' is the Central Comelec.
  college text not null default '',
  position text not null,
  -- The party it runs under; null for an independent candidate.
  party_id uuid references public.parties(id) on delete set null,
  -- none: independent; waiting: for the party's contact person; endorsed or declined.
  endorsement text not null default 'none' check (endorsement in ('none', 'waiting', 'endorsed', 'declined')),
  endorsed_by text,
  endorsed_at timestamptz,
  date_of_birth date not null,
  residence text not null,
  oath_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'qualified', 'disqualified', 'withdrawn')),
  decision_remarks text not null default '',
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One candidacy at a time per account.
create unique index if not exists candidacies_one_per_account on public.candidacies (account_id) where status <> 'withdrawn';
create index if not exists candidacies_unit_created on public.candidacies (college, created_at desc);
create index if not exists candidacies_party on public.candidacies (party_id);

create table if not exists public.candidacy_submissions (
  id uuid primary key default gen_random_uuid(),
  candidacy_id uuid not null references public.candidacies(id) on delete cascade,
  requirement text not null,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'changes')),
  submitted_by text,
  submitted_at timestamptz,
  feedback text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidacy_id, requirement)
);

-- An account's own notifications: its candidacy's endorsement, feedback and decision.
create table if not exists public.account_notices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.public_accounts(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  actor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists account_notices_account_created on public.account_notices (account_id, created_at desc);

alter table public.public_accounts enable row level security;
alter table public.elective_positions enable row level security;
alter table public.candidacies enable row level security;
alter table public.candidacy_submissions enable row level security;
alter table public.account_notices enable row level security;

-- A candidacy needs its unit's filing period open, as a party needs its registration period.
create or replace function public.check_candidacy_period() returns trigger
language plpgsql set search_path = public as $$
declare period record;
begin
  select mode, opens_at, closes_at, grace_ends_at into period
  from public.unit_periods where kind = 'candidacy' and college = new.college;
  if not found
    or (period.mode = 'scheduled' and (period.opens_at > clock_timestamp() or period.closes_at <= clock_timestamp()))
    or (period.mode = 'closed' and (period.grace_ends_at is null or period.grace_ends_at <= clock_timestamp())) then
    raise exception 'candidacy_closed';
  end if;
  return new;
end $$;
create or replace trigger candidacy_period before insert on public.candidacies
for each row execute function public.check_candidacy_period();

-- As for a party's documents: files change in one statement each, and a sent or approved document is locked.
create or replace function public.candidacy_submission_add_files(p_candidacy uuid, p_requirement text, p_files jsonb)
returns public.candidacy_submissions
language plpgsql set search_path = public as $$
declare submission public.candidacy_submissions;
begin
  insert into public.candidacy_submissions (candidacy_id, requirement) values (p_candidacy, p_requirement)
  on conflict (candidacy_id, requirement) do nothing;
  select * into submission from public.candidacy_submissions where candidacy_id = p_candidacy and requirement = p_requirement for update;
  if submission.status in ('submitted', 'approved') then
    raise exception 'candidacy_submission_locked';
  end if;
  update public.candidacy_submissions set files = files || p_files, updated_at = now()
  where id = submission.id returning * into submission;
  return submission;
end $$;

create or replace function public.candidacy_submission_remove_file(p_candidacy uuid, p_requirement text, p_path text)
returns public.candidacy_submissions
language plpgsql set search_path = public as $$
declare submission public.candidacy_submissions;
begin
  select * into submission from public.candidacy_submissions where candidacy_id = p_candidacy and requirement = p_requirement for update;
  if not found then
    return null;
  end if;
  if submission.status in ('submitted', 'approved') then
    raise exception 'candidacy_submission_locked';
  end if;
  update public.candidacy_submissions
  set files = coalesce((select jsonb_agg(file) from jsonb_array_elements(files) as file where file->>'path' <> p_path), '[]'::jsonb), updated_at = now()
  where id = submission.id returning * into submission;
  return submission;
end $$;

revoke execute on function public.candidacy_submission_add_files(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.candidacy_submission_remove_file(uuid, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
