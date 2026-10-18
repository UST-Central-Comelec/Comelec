-- The filing portal's Services, and a qualified candidate's campaign:
--
--   * filing_requests: a consultation booked with a Comelec unit (BC- ID), or a request for a
--     commissioner at an activity (RC- ID). The unit confirms it with a time, a place and who goes,
--     or declines it; the filer can cancel it.
--   * petitions: a petition or a case filed with a unit (PC- ID), with its evidence. The unit
--     dockets it (the respondent is asked to answer, Elections Code Article XII, Section 5), then
--     resolves or dismisses it; the filer can withdraw it until then.
--   * campaign_materials: a tarpaulin, poster, handbill, electronic material or campaign page, sent
--     for the unit's approval before it's used (Article VII, Sections 5, 8 and 11).
--   * campaign_activities: the candidate's campaign schedule (Article VII, Section 1.3), each
--     activity approved by the unit (Section 7(b)(4)).
--
-- Additive only: a replaced function body, new tables, a trigger. All access goes through the
-- server's admin client, so row level security is on with no policies.

-- As in 20261018150000_filing_sanctions_references.sql, with three more prefixes.
create or replace function public.new_filing_reference(p_prefix text)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  -- A version 4 UUID's random bytes (byte 6 carries the version and byte 8 the variant).
  positions constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10];
  candidate text;
  entropy bytea;
begin
  if p_prefix not in ('PP', 'FC', 'BC', 'RC', 'PC') then raise exception 'unknown_reference_prefix'; end if;
  loop
    entropy := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := p_prefix || '-';
    for i in 1..8 loop
      if i = 5 then candidate := candidate || '-'; end if;
      -- 256 is a multiple of 32, so every character is equally likely.
      candidate := candidate || substr(alphabet, 1 + get_byte(entropy, positions[i]) % 32, 1);
    end loop;
    -- Hold the candidate until this transaction ends, including concurrent inserts.
    perform pg_advisory_xact_lock(73031, hashtext(candidate));
    if p_prefix = 'PP' and not exists (select 1 from public.parties where reference = candidate) then return candidate; end if;
    if p_prefix = 'FC' and not exists (select 1 from public.candidacies where reference = candidate) then return candidate; end if;
    if p_prefix in ('BC', 'RC') and not exists (select 1 from public.filing_requests where reference = candidate) then return candidate; end if;
    if p_prefix = 'PC' and not exists (select 1 from public.petitions where reference = candidate) then return candidate; end if;
  end loop;
end;
$$;

create table if not exists public.filing_requests (
  id uuid primary key default gen_random_uuid(),
  -- BC- for a consultation, RC- for a commissioner request: set on insert (filing_request_reference).
  reference text not null,
  account_id uuid not null references public.public_accounts(id) on delete cascade,
  kind text not null check (kind in ('consultation', 'commissioner')),
  -- The unit it's addressed to: '' is the Central Comelec.
  college text not null default '',
  -- Whom it's for: the filer, their party, or their candidacy.
  on_behalf text not null default 'self' check (on_behalf in ('self', 'party', 'candidacy')),
  party_id uuid references public.parties(id) on delete set null,
  -- A consultation's topic, or what the commissioner is asked to do (src/lib/filing-portal/services.ts).
  topic text not null,
  -- A consultation's question in a line, or the activity's name.
  subject text not null,
  details text not null default '',
  mode text not null default 'in-person' check (mode in ('in-person', 'online')),
  -- Where the activity is, for a commissioner request.
  venue text not null default '',
  -- The time asked for: a consultation's preferred slot, or the activity's.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'done')),
  -- What the unit confirmed: the time, the room or meeting link, and who meets them or goes.
  confirmed_start timestamptz,
  confirmed_end timestamptz,
  location text not null default '',
  assigned text not null default '',
  response text not null default '',
  handled_by text,
  handled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (confirmed_end is null or confirmed_end > confirmed_start)
);
create unique index if not exists filing_requests_reference_unique on public.filing_requests (reference);
create index if not exists filing_requests_account_created on public.filing_requests (account_id, created_at desc);
create index if not exists filing_requests_unit_created on public.filing_requests (college, created_at desc);

create or replace function public.filing_request_reference() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.reference is null then
    new.reference := public.new_filing_reference(case new.kind when 'consultation' then 'BC' else 'RC' end);
  end if;
  return new;
end $$;
create or replace trigger filing_request_reference before insert on public.filing_requests
for each row execute function public.filing_request_reference();

create table if not exists public.petitions (
  id uuid primary key default gen_random_uuid(),
  reference text not null default public.new_filing_reference('PC'),
  account_id uuid not null references public.public_accounts(id) on delete cascade,
  -- The unit it's filed with: '' is the Central Comelec.
  college text not null default '',
  type text not null check (type in ('qualification', 'nuisance', 'protest', 'offense', 'party', 'other')),
  subject text not null,
  -- Who it's against: a candidate, a party, anyone; '' when there's no one.
  respondent text not null default '',
  -- When what it's about happened, for the five school days of Article XII, Section 4.
  occurred_on date,
  statement text not null,
  relief text not null default '',
  files jsonb not null default '[]'::jsonb,
  status text not null default 'filed' check (status in ('filed', 'docketed', 'resolved', 'dismissed', 'withdrawn')),
  -- The unit's latest word: what it asked of the parties on docketing, or its resolution.
  remarks text not null default '',
  docketed_by text,
  docketed_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists petitions_reference_unique on public.petitions (reference);
create index if not exists petitions_account_created on public.petitions (account_id, created_at desc);
create index if not exists petitions_unit_created on public.petitions (college, created_at desc);

create table if not exists public.campaign_materials (
  id uuid primary key default gen_random_uuid(),
  candidacy_id uuid not null references public.candidacies(id) on delete cascade,
  kind text not null check (kind in ('tarpaulin', 'poster', 'printed', 'electronic', 'page')),
  title text not null,
  -- A tarpaulin's in metres, a poster's in inches; null for the rest.
  width numeric,
  height numeric,
  -- Where it'll be put up or posted.
  placement text not null default '',
  link text not null default '',
  -- A party candidate's tarpaulin or poster shows all of the party's candidates (Section 5).
  shows_party boolean not null default false,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'changes', 'declined')),
  feedback text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaign_materials_candidacy on public.campaign_materials (candidacy_id, created_at desc);

create table if not exists public.campaign_activities (
  id uuid primary key default gen_random_uuid(),
  candidacy_id uuid not null references public.candidacies(id) on delete cascade,
  kind text not null check (kind in ('room-to-room', 'online', 'forum', 'other')),
  title text not null,
  -- The rooms, building, or platform.
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  details text not null default '',
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'declined', 'cancelled')),
  feedback text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists campaign_activities_candidacy on public.campaign_activities (candidacy_id, starts_at);

alter table public.filing_requests enable row level security;
alter table public.petitions enable row level security;
alter table public.campaign_materials enable row level security;
alter table public.campaign_activities enable row level security;

revoke execute on function public.new_filing_reference(text) from public, anon, authenticated;
revoke execute on function public.filing_request_reference() from public, anon, authenticated;

notify pgrst, 'reload schema';
