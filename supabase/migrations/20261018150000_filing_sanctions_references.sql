-- Three additions to the filing portal's records, for the commission's side:
--
--   * Reference IDs: PP-7K3M-9QXA for a political party, FC-7K3M-9QXA for a filing of candidacy,
--     like the commissioner application's CC- codes (src/lib/applications/reference.ts). Eight
--     characters from an alphabet without look-alikes; UUIDs stay the internal identifiers.
--   * A decision taken with documents still outstanding (accredited or qualified anyway, with
--     remarks) is marked, so the record says so.
--   * A party can be suspended or blacklisted, with who did it and why. It's a label over its
--     status: lifting it puts the party back where it was. A blacklisted party's name stays taken,
--     and its registration can't be withdrawn (which would free the name).
--
-- Additive only: new columns, a function, and a replaced function body.

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
    if p_prefix not in ('PP', 'FC') then raise exception 'unknown_reference_prefix'; end if;
  end loop;
end;
$$;

alter table public.parties add column if not exists reference text;
alter table public.candidacies add column if not exists reference text;
update public.parties set reference = public.new_filing_reference('PP') where reference is null;
update public.candidacies set reference = public.new_filing_reference('FC') where reference is null;
alter table public.parties alter column reference set default public.new_filing_reference('PP');
alter table public.candidacies alter column reference set default public.new_filing_reference('FC');
alter table public.parties alter column reference set not null;
alter table public.candidacies alter column reference set not null;
create unique index if not exists parties_reference_unique on public.parties (reference);
create unique index if not exists candidacies_reference_unique on public.candidacies (reference);

-- Accredited or qualified with documents outstanding: the remarks say why.
alter table public.parties add column if not exists decision_override boolean not null default false;
alter table public.candidacies add column if not exists decision_override boolean not null default false;

alter table public.parties
  add column if not exists sanction text check (sanction in ('suspended', 'blacklisted')),
  add column if not exists sanction_reason text not null default '',
  add column if not exists sanctioned_by text,
  add column if not exists sanctioned_at timestamptz;

-- As before (20261018120000_filing_portal_management.sql), but never for a blacklisted party.
create or replace function public.party_withdraw(p_party uuid, p_by text, p_reason text)
returns setof public.parties
language plpgsql set search_path = public as $$
declare party public.parties;
begin
  update public.parties
  set status = 'withdrawn', withdrawn_by = p_by, withdrawn_at = now(), withdrawal_reason = p_reason, updated_at = now()
  where id = p_party and status <> 'withdrawn' and sanction is distinct from 'blacklisted'
  returning * into party;
  if not found then
    return;
  end if;
  update public.party_members
  set status = 'removed', removed_by = p_by, removed_at = now(), removal_reason = 'The party’s registration was withdrawn.', updated_at = now()
  where party_id = p_party and status in ('requested', 'active');
  update public.candidacies
  set endorsement = 'declined', endorsed_by = p_by, endorsed_at = now(), updated_at = now()
  where party_id = p_party and endorsement = 'waiting' and status <> 'withdrawn';
  return next party;
end $$;

revoke execute on function public.new_filing_reference(text) from public, anon, authenticated;
revoke execute on function public.party_withdraw(uuid, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
