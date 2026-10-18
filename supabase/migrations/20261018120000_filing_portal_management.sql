-- The commission's side of the filing portal (PolPaR and Filing of Candidacy in the commission
-- portal): managing the public's accounts and what's filed under them.
--
--   * An account can be suspended (it can't sign in, and its open sessions end) and restored, and
--     its sessions can be ended without suspending it.
--   * A party member can be removed, and the contact person's role handed to another member.
--   * A party's registration, and a candidacy, can be withdrawn by the unit, with who did it and why.
--
-- Additive only: new columns with defaults, and two functions. All access is still through the
-- server's admin client, so row level security stays on with no policies.

alter table public.public_accounts
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by text,
  add column if not exists suspension_reason text not null default '',
  -- Sessions started before this are over (src/lib/filing-portal/session.ts).
  add column if not exists sessions_revoked_at timestamptz;

alter table public.party_members
  add column if not exists removed_by text,
  add column if not exists removed_at timestamptz,
  add column if not exists removal_reason text not null default '';

alter table public.parties
  add column if not exists withdrawn_by text,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawal_reason text not null default '';

alter table public.candidacies
  add column if not exists withdrawn_by text,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawal_reason text not null default '';

-- Hands the contact person's role to another active member, in one statement: the old contact
-- becomes a member, the new one the contact, and the party points at them.
create or replace function public.party_set_contact(p_party uuid, p_member uuid)
returns public.parties
language plpgsql set search_path = public as $$
declare party public.parties;
begin
  select * into party from public.parties where id = p_party for update;
  if not found then
    raise exception 'party_missing';
  end if;
  if not exists (select 1 from public.party_members where id = p_member and party_id = p_party and status = 'active') then
    raise exception 'party_member_inactive';
  end if;
  update public.party_members set role = 'member', updated_at = now() where party_id = p_party and role = 'contact' and id <> p_member;
  update public.party_members set role = 'contact', updated_at = now() where id = p_member;
  update public.parties set contact_member_id = p_member, updated_at = now() where id = p_party returning * into party;
  return party;
end $$;

-- Withdraws a party's registration: frees its name and its members (who can register again), and
-- closes the endorsement requests waiting on it. Nothing happens to one already withdrawn.
create or replace function public.party_withdraw(p_party uuid, p_by text, p_reason text)
returns setof public.parties
language plpgsql set search_path = public as $$
declare party public.parties;
begin
  update public.parties
  set status = 'withdrawn', withdrawn_by = p_by, withdrawn_at = now(), withdrawal_reason = p_reason, updated_at = now()
  where id = p_party and status <> 'withdrawn'
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

revoke execute on function public.party_set_contact(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.party_withdraw(uuid, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
