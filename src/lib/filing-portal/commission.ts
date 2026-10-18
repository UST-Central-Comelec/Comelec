import "server-only";

import { listAccountCandidacies, toCandidacy } from "@/lib/candidacy/store";
import type { Candidacy } from "@/lib/candidacy/types";
import { toMember, toParty } from "@/lib/party-portal/store";
import type { Party, PartyMember } from "@/lib/party-portal/types";
import { createAdminClient } from "@/lib/supabase/server";
import { listAccountNotices, toAccount } from "./accounts";
import type { Notice, PublicAccount } from "./types";

// The commission's view of the filing portal's accounts (PolPaR → Applicants → Accounts, and
// Filing of Candidacy's): who has signed up, what each has filed, and the unit's changes to them.
// Callers have checked the tab, and that a Local unit only reaches accounts tied to its own
// college's parties and filings (`touchesUnit`).

type Row = Record<string, unknown>;
const db = () => createAdminClient();
const str = (value: unknown) => (typeof value === "string" ? value : "");
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Couldn’t ${what}: ${error.message}`);
}

export type AccountMembership = { memberId: string; partyId: string; partyName: string; college: string; partyStatus: Party["status"]; partySanction: Party["sanction"]; role: PartyMember["role"]; status: PartyMember["status"]; createdAt: string };
export type AccountCandidacy = Pick<Candidacy, "id" | "reference" | "college" | "position" | "status" | "endorsement" | "partyName" | "createdAt">;

export type AccountListRow = PublicAccount & {
  /** Asked to join, or a member, now. */
  membership: AccountMembership | null;
  /** The filing that isn't withdrawn. */
  candidacy: AccountCandidacy | null;
  /** The units its parties and filings are with, past ones too: "" for the Central Comelec. */
  units: string[];
};

/** Whether a Local unit (`college`) may see the account: one of its parties or filings, now or before, is with that unit. */
export const touchesUnit = (units: readonly string[], college: string | null) => college === null || units.includes(college);

/** Every filing portal account a unit may see, newest first: all of them for the Central Comelec. */
export async function listFilingAccounts(college: string | null): Promise<AccountListRow[]> {
  const { data, error } = await db().from("public_accounts")
    .select("*, party_members(id, party_id, role, status, created_at, party:parties!party_members_party_id_fkey(id, name, college, status, sanction)), candidacies(*, party:parties(name, status, sanction))")
    .order("created_at", { ascending: false }).limit(5000);
  fail("load the accounts", error);
  const rows = (data ?? []).map((row): AccountListRow => {
    const memberships = ((row.party_members ?? []) as Row[]).map((member) => {
      const party = one(member.party as Row | Row[] | null);
      return { memberId: str(member.id), partyId: str(member.party_id), partyName: str(party?.name), college: str(party?.college), partyStatus: str(party?.status) as Party["status"], partySanction: party?.sanction === "suspended" || party?.sanction === "blacklisted" ? (party.sanction as Party["sanction"]) : null, role: str(member.role) as PartyMember["role"], status: str(member.status) as PartyMember["status"], createdAt: str(member.created_at) };
    });
    const candidacies = ((row.candidacies ?? []) as Row[]).map(toCandidacy);
    const current = candidacies.find((item) => item.status !== "withdrawn") ?? null;
    return {
      ...toAccount(row),
      membership: memberships.find((item) => item.status === "requested" || item.status === "active") ?? null,
      candidacy: current && { id: current.id, reference: current.reference, college: current.college, position: current.position, status: current.status, endorsement: current.endorsement, partyName: current.partyName, createdAt: current.createdAt },
      units: [...new Set([...memberships.map((item) => item.college), ...candidacies.map((item) => item.college)])],
    };
  });
  return rows.filter((row) => touchesUnit(row.units, college));
}

export type AccountDetail = {
  account: PublicAccount;
  /** Every party it has been in or asked to join, newest first. */
  memberships: Array<PartyMember & { party: Party }>;
  candidacies: Candidacy[];
  notices: Notice[];
  units: string[];
};

/** One account, with its parties and filings, past ones too, and what it has been told. */
export async function getAccountDetail(id: string): Promise<AccountDetail | null> {
  if (!isUuid(id)) return null;
  const client = db();
  const [{ data: account, error }, { data: members, error: membersError }, candidacies, notices] = await Promise.all([
    client.from("public_accounts").select("*").eq("id", id).maybeSingle(),
    client.from("party_members").select("*, party:parties!party_members_party_id_fkey(*)").eq("account_id", id).order("created_at", { ascending: false }),
    listAccountCandidacies(id),
    listAccountNotices(id, 50),
  ]);
  fail("load the account", error);
  fail("load the account’s parties", membersError);
  if (!account) return null;
  const memberships = (members ?? []).flatMap((row) => {
    const party = one(row.party as Row | Row[] | null);
    return party ? [{ ...toMember(row), party: toParty(party) }] : [];
  });
  return { account: toAccount(account), memberships, candidacies, notices, units: [...new Set([...memberships.map((item) => item.party.college), ...candidacies.map((item) => item.college)])] };
}

export type ProfileChange = Pick<PublicAccount, "lastName" | "firstName" | "middleName" | "studentNumber" | "mobileNumber" | "facebookUrl" | "college" | "program" | "yearLevel">;

/**
 * Corrects an account's profile, over the version the commissioner opened (`seen`, its updatedAt).
 * The party rosters it's on (asked to join, or a member) take the correction too. "conflict" when
 * the account changed in between, "missing" when it's gone.
 */
export async function updateAccountProfile(id: string, change: ProfileChange, seen: string): Promise<PublicAccount | "conflict" | "missing"> {
  const now = new Date().toISOString();
  const values = {
    last_name: change.lastName, first_name: change.firstName, middle_name: change.middleName, student_number: change.studentNumber, mobile_number: change.mobileNumber,
    facebook_url: change.facebookUrl, college: change.college, program: change.program, year_level: change.yearLevel,
  };
  const client = db();
  const { data, error } = await client.from("public_accounts").update({ ...values, updated_at: now }).eq("id", id).eq("updated_at", seen).select("*").maybeSingle();
  fail("save the profile", error);
  if (!data) {
    const { data: exists } = await client.from("public_accounts").select("id").eq("id", id).maybeSingle();
    return exists ? "conflict" : "missing";
  }
  const { error: rosterError } = await client.from("party_members").update({ ...values, updated_at: now }).eq("account_id", id).in("status", ["requested", "active"]);
  if (rosterError) console.error("Couldn’t update the party roster with the corrected profile:", rosterError.message);
  return toAccount(data);
}

/**
 * Suspends the account (it can't sign in, and its sessions end) or restores it. Null when it was
 * already so. Like ending its sessions, it leaves updatedAt alone: it sets one value, so the last
 * click wins, and it never trips a profile correction open at the same time.
 */
export async function setAccountSuspended(id: string, suspend: boolean, by: string, reason: string): Promise<PublicAccount | null> {
  const now = new Date().toISOString();
  let query = db().from("public_accounts").update(suspend
    ? { suspended_at: now, suspended_by: by, suspension_reason: reason, sessions_revoked_at: now }
    : { suspended_at: null, suspended_by: null, suspension_reason: "" }).eq("id", id);
  query = suspend ? query.is("suspended_at", null) : query.not("suspended_at", "is", null);
  const { data, error } = await query.select("*").maybeSingle();
  fail(suspend ? "suspend the account" : "restore the account", error);
  return data ? toAccount(data) : null;
}

/** Ends every session the account has open now; it can sign in again. */
export async function endAccountSessions(id: string): Promise<PublicAccount | null> {
  const { data, error } = await db().from("public_accounts").update({ sessions_revoked_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
  fail("sign the account out", error);
  return data ? toAccount(data) : null;
}
