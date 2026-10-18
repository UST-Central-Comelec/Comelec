import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { fullName, type DocumentStatus, type FilingFile, type PublicAccount } from "@/lib/filing-portal/types";
import { unitName, type JoinableParty, type Party, type PartyMember, type PartyNotice, type Submission } from "./types";

// Political parties' records (supabase/migrations/20261017190000_party_portal.sql). Every caller
// has already checked who's asking: the filing portal's session (src/lib/filing-portal/session.ts)
// or a commission portal tab (./review-actions.ts, the PolPaR pages).

type Row = Record<string, unknown>;
const db = () => createAdminClient();
const str = (value: unknown) => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown) => (typeof value === "string" ? value : null);

export const toParty = (row: Row): Party => ({
  id: str(row.id), reference: str(row.reference), name: str(row.name), college: str(row.college), establishedAt: str(row.established_at), headquarters: str(row.headquarters),
  contactMemberId: strOrNull(row.contact_member_id), status: str(row.status) as Party["status"], decisionRemarks: str(row.decision_remarks),
  decidedBy: strOrNull(row.decided_by), decidedAt: strOrNull(row.decided_at), decisionOverride: row.decision_override === true,
  sanction: row.sanction === "suspended" || row.sanction === "blacklisted" ? row.sanction : null, sanctionReason: str(row.sanction_reason), sanctionedBy: strOrNull(row.sanctioned_by), sanctionedAt: strOrNull(row.sanctioned_at),
  withdrawnBy: strOrNull(row.withdrawn_by), withdrawnAt: strOrNull(row.withdrawn_at), withdrawalReason: str(row.withdrawal_reason),
  createdAt: str(row.created_at), updatedAt: str(row.updated_at),
});

export const toMember = (row: Row): PartyMember => ({
  id: str(row.id), partyId: str(row.party_id), accountId: strOrNull(row.account_id), email: str(row.email), lastName: str(row.last_name), firstName: str(row.first_name), middleName: str(row.middle_name),
  studentNumber: str(row.student_number), mobileNumber: str(row.mobile_number), facebookUrl: str(row.facebook_url),
  college: str(row.college), program: str(row.program), yearLevel: str(row.year_level),
  role: str(row.role) as PartyMember["role"], status: str(row.status) as PartyMember["status"],
  decidedBy: strOrNull(row.decided_by), decidedAt: strOrNull(row.decided_at),
  removedBy: strOrNull(row.removed_by), removedAt: strOrNull(row.removed_at), removalReason: str(row.removal_reason), createdAt: str(row.created_at),
});

const toFiles = (value: unknown): FilingFile[] => (Array.isArray(value) ? value : []).filter((file): file is FilingFile => Boolean(file) && typeof file === "object" && typeof (file as FilingFile).path === "string");

export const toSubmission = (row: Row): Submission => ({
  id: str(row.id), partyId: str(row.party_id), requirement: str(row.requirement), files: toFiles(row.files), status: str(row.status) as DocumentStatus,
  submittedBy: strOrNull(row.submitted_by), submittedAt: strOrNull(row.submitted_at), feedback: str(row.feedback),
  reviewedBy: strOrNull(row.reviewed_by), reviewedAt: strOrNull(row.reviewed_at), updatedAt: str(row.updated_at),
});

const toNotice = (row: Row): PartyNotice => ({
  id: str(row.id), partyId: str(row.party_id), kind: str(row.kind), title: str(row.title), body: str(row.body), href: strOrNull(row.href),
  actor: str(row.actor), forContact: row.for_contact === true, createdAt: str(row.created_at),
});

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Couldn’t ${what}: ${error.message}`);
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/* Parties and members */

export async function getParty(id: string): Promise<Party | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("parties").select("*").eq("id", id).maybeSingle();
  fail("load the party", error);
  return data ? toParty(data) : null;
}

export async function getMember(id: string): Promise<PartyMember | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("party_members").select("*").eq("id", id).maybeSingle();
  fail("load the member", error);
  return data ? toMember(data) : null;
}

/** The account's membership now: asked to join, or a member. */
export async function membershipOfAccount(accountId: string): Promise<PartyMember | null> {
  const { data, error } = await db().from("party_members").select("*").eq("account_id", accountId).in("status", ["requested", "active"]).limit(1).maybeSingle();
  fail("look up the membership", error);
  return data ? toMember(data) : null;
}

export async function listMembers(partyId: string): Promise<PartyMember[]> {
  const { data, error } = await db().from("party_members").select("*").eq("party_id", partyId).in("status", ["requested", "active"]).order("created_at");
  fail("load the members", error);
  return (data ?? []).map(toMember);
}

/** Parties with `status`, with who to ask: pending ones new members can join, accredited ones candidates run under. */
export async function listJoinableParties(status: "pending" | "accredited" = "pending"): Promise<JoinableParty[]> {
  const { data, error } = await db().from("parties").select("id, name, college, established_at, headquarters, contact:party_members!parties_contact_member_fk(first_name, middle_name, last_name)").eq("status", status).is("sanction", null).order("name");
  fail("load the parties", error);
  return (data ?? []).map((row) => {
    const contact = (Array.isArray(row.contact) ? row.contact[0] : row.contact) as Row | null;
    return {
      id: str(row.id), name: str(row.name), college: str(row.college), unit: unitName(str(row.college)),
      establishedAt: str(row.established_at), headquarters: str(row.headquarters),
      contactName: contact ? fullName({ firstName: str(contact.first_name), middleName: str(contact.middle_name), lastName: str(contact.last_name) }) : "",
    };
  });
}

/** The account joining, with its profile as it stands now. */
export type NewMember = PublicAccount;

const memberRow = (member: NewMember) => ({
  account_id: member.id, email: member.email.trim().toLowerCase(), last_name: member.lastName, first_name: member.firstName, middle_name: member.middleName,
  student_number: member.studentNumber, mobile_number: member.mobileNumber, facebook_url: member.facebookUrl,
  college: member.college, program: member.program, year_level: member.yearLevel,
});

export type CreateResult = { member: PartyMember; party: Party } | { error: "name-taken" | "email-taken" | "closed" | "party-gone" };

/** A new party, with its maker as its contact person and first member. */
export async function createPartyWithContact(party: { name: string; college: string; establishedAt: string; headquarters: string }, member: NewMember): Promise<CreateResult> {
  const client = db();
  const { data: created, error } = await client.from("parties").insert({ name: party.name, college: party.college, established_at: party.establishedAt, headquarters: party.headquarters }).select("*").single();
  if (error) {
    if (error.message.includes("party_registration_closed")) return { error: "closed" };
    if (error.code === "23505") return { error: "name-taken" };
    throw new Error(`Couldn’t make the party: ${error.message}`);
  }
  const { data: contact, error: memberError } = await client.from("party_members").insert({ ...memberRow(member), party_id: created.id, role: "contact", status: "active" }).select("*").single();
  if (memberError) {
    // No member, no party: take it back, so its name is free again.
    await client.from("parties").delete().eq("id", created.id);
    if (memberError.code === "23505") return { error: "email-taken" };
    throw new Error(`Couldn’t add the contact person: ${memberError.message}`);
  }
  const { data: linked, error: linkError } = await client.from("parties").update({ contact_member_id: contact.id, updated_at: new Date().toISOString() }).eq("id", created.id).select("*").single();
  fail("name the contact person", linkError);
  return { member: toMember(contact), party: toParty(linked) };
}

/** Asks to join a party that's still waiting for its review. The contact person decides. */
export async function requestToJoin(partyId: string, member: NewMember): Promise<CreateResult> {
  const party = await getParty(partyId);
  if (!party || party.status !== "pending" || party.sanction) return { error: "party-gone" };
  const { data, error } = await db().from("party_members").insert({ ...memberRow(member), party_id: partyId, role: "member", status: "requested" }).select("*").single();
  if (error) {
    if (error.code === "23505") return { error: "email-taken" };
    throw new Error(`Couldn’t send the request: ${error.message}`);
  }
  return { member: toMember(data), party };
}

/** Approves or declines a request to join. Only a request still waiting changes: the last click wins. */
export async function decideRequest(partyId: string, memberId: string, approve: boolean, by: string): Promise<PartyMember | null> {
  const { data, error } = await db().from("party_members")
    .update({ status: approve ? "active" : "declined", decided_by: by, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", memberId).eq("party_id", partyId).eq("status", "requested").select("*").maybeSingle();
  fail("answer the request", error);
  return data ? toMember(data) : null;
}

/** Someone takes back their own request to join, while it's still waiting. */
export async function withdrawJoinRequest(memberId: string, accountId: string, by: string): Promise<PartyMember | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("party_members").update({ status: "removed", removed_by: by, removed_at: now, removal_reason: "They took back their request.", updated_at: now })
    .eq("id", memberId).eq("account_id", accountId).eq("status", "requested").select("*").maybeSingle();
  fail("take back the request", error);
  return data ? toMember(data) : null;
}

/* Submissions */

export async function listSubmissions(partyId: string): Promise<Submission[]> {
  const { data, error } = await db().from("party_submissions").select("*").eq("party_id", partyId);
  fail("load the documents", error);
  return (data ?? []).map(toSubmission);
}

export async function getSubmission(partyId: string, requirement: string): Promise<Submission | null> {
  const { data, error } = await db().from("party_submissions").select("*").eq("party_id", partyId).eq("requirement", requirement).maybeSingle();
  fail("load the document", error);
  return data ? toSubmission(data) : null;
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("party_submissions").select("*").eq("id", id).maybeSingle();
  fail("load the document", error);
  return data ? toSubmission(data) : null;
}

/** Adds files in one statement, so two members uploading at once keep both. "locked" when it's sent or approved. */
export async function addFiles(partyId: string, requirement: string, files: FilingFile[]): Promise<Submission | "locked"> {
  const { data, error } = await db().rpc("party_submission_add_files", { p_party: partyId, p_requirement: requirement, p_files: files });
  if (error?.message.includes("party_submission_locked")) return "locked";
  fail("save the files", error);
  return toSubmission(data as Row);
}

export async function removeFile(partyId: string, requirement: string, path: string): Promise<"removed" | "locked"> {
  const { error } = await db().rpc("party_submission_remove_file", { p_party: partyId, p_requirement: requirement, p_path: path });
  if (error?.message.includes("party_submission_locked")) return "locked";
  fail("remove the file", error);
  return "removed";
}

/** Sends a requirement's files for review. Only from a draft, or after changes were asked for. */
export async function sendSubmission(partyId: string, requirement: string, by: string): Promise<Submission | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("party_submissions")
    .update({ status: "submitted", submitted_by: by, submitted_at: now, updated_at: now })
    .eq("party_id", partyId).eq("requirement", requirement).in("status", ["draft", "changes"]).select("*").maybeSingle();
  fail("send the document", error);
  return data ? toSubmission(data) : null;
}

/** Takes a sent document back to change it, while it's still waiting for review. */
export async function takeBackSubmission(partyId: string, requirement: string): Promise<Submission | null> {
  const { data, error } = await db().from("party_submissions")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("party_id", partyId).eq("requirement", requirement).eq("status", "submitted").select("*").maybeSingle();
  fail("take the document back", error);
  return data ? toSubmission(data) : null;
}

/**
 * The unit's review of a document: approved, or sent back with what to change. Only over the
 * version the reviewer opened (`seen`, its updatedAt) and only once it's been sent, so files the
 * party changed or took back in the meantime are never approved unseen. Null when it moved on.
 */
export async function reviewSubmission(id: string, status: "approved" | "changes", feedback: string, by: string, seen: string): Promise<Submission | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("party_submissions").update({ status, feedback, reviewed_by: by, reviewed_at: now, updated_at: now })
    .eq("id", id).eq("updated_at", seen).in("status", ["submitted", "approved", "changes"]).select("*").maybeSingle();
  fail("save the review", error);
  return data ? toSubmission(data) : null;
}

/** Every file a party keeps, in bytes, for its overall limit. */
export async function partyBytes(partyId: string) {
  return (await listSubmissions(partyId)).reduce((sum, submission) => sum + submission.files.reduce((size, file) => size + (Number(file.size) || 0), 0), 0);
}

/* The party's decision */

/** Accredits, declines or reopens a party: never one that's withdrawn, suspended or blacklisted. `override`: accredited with documents outstanding. */
export async function decideParty(id: string, status: "pending" | "accredited" | "declined", remarks: string, by: string, override = false): Promise<Party | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("parties").update({ status, decision_remarks: remarks, decided_by: by, decided_at: now, decision_override: override, updated_at: now })
    .eq("id", id).neq("status", "withdrawn").is("sanction", null).select("*").maybeSingle();
  fail("save the decision", error);
  return data ? toParty(data) : null;
}

/** Suspends or blacklists a party, or lifts it (`sanction` null). Only from no sanction to one, or back: the last click wins. */
export async function setPartySanction(id: string, sanction: "suspended" | "blacklisted" | null, reason: string, by: string): Promise<Party | null> {
  const now = new Date().toISOString();
  let query = db().from("parties").update(sanction
    ? { sanction, sanction_reason: reason, sanctioned_by: by, sanctioned_at: now, updated_at: now }
    : { sanction: null, sanction_reason: "", sanctioned_by: by, sanctioned_at: now, updated_at: now }).eq("id", id).neq("status", "withdrawn");
  query = sanction ? query.is("sanction", null) : query.not("sanction", "is", null);
  const { data, error } = await query.select("*").maybeSingle();
  fail(sanction ? "save the sanction" : "lift the sanction", error);
  return data ? toParty(data) : null;
}

/* The unit managing a party's people */

/** Everyone who has been in the party or asked to join, newest last: removed and declined ones too. */
export async function listMemberHistory(partyId: string): Promise<PartyMember[]> {
  const { data, error } = await db().from("party_members").select("*").eq("party_id", partyId).order("created_at");
  fail("load the members", error);
  return (data ?? []).map(toMember);
}

/** Removes a member, or a request to join, by the unit. Never the contact person: hand their role on first. */
export async function removeMember(partyId: string, memberId: string, by: string, reason: string): Promise<PartyMember | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("party_members").update({ status: "removed", removed_by: by, removed_at: now, removal_reason: reason, updated_at: now })
    .eq("id", memberId).eq("party_id", partyId).in("status", ["requested", "active"]).neq("role", "contact").select("*").maybeSingle();
  fail("remove the member", error);
  return data ? toMember(data) : null;
}

/** Makes an active member the party's contact person; the old one stays on as a member. */
export async function setContactPerson(partyId: string, memberId: string): Promise<Party | "inactive"> {
  const { data, error } = await db().rpc("party_set_contact", { p_party: partyId, p_member: memberId });
  if (error?.message.includes("party_member_inactive") || error?.message.includes("party_missing")) return "inactive";
  fail("change the contact person", error);
  return toParty(data as Row);
}

/** Withdraws the registration: frees its name and members, and closes endorsement requests waiting on it. Null if it already was. */
export async function withdrawParty(partyId: string, by: string, reason: string): Promise<Party | null> {
  const { data, error } = await db().rpc("party_withdraw", { p_party: partyId, p_by: by, p_reason: reason });
  fail("withdraw the registration", error);
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  return row?.id ? toParty(row) : null;
}

/* Notifications */

export async function addNotice(notice: { partyId: string; kind: string; title: string; body?: string; href?: string; actor?: string; forContact?: boolean }) {
  const { error } = await db().from("party_notices").insert({ party_id: notice.partyId, kind: notice.kind, title: notice.title, body: notice.body ?? "", href: notice.href ?? null, actor: notice.actor ?? "", for_contact: notice.forContact ?? false });
  // A notice that didn't save mustn't undo what the notice is about.
  if (error) console.error("Couldn’t add a party notice:", error.message);
}

/** A member's notifications, newest first: the party's, and the contact person's own. */
export async function listNotices(member: Pick<PartyMember, "partyId" | "role">, limit = 100): Promise<PartyNotice[]> {
  let query = db().from("party_notices").select("*").eq("party_id", member.partyId).order("created_at", { ascending: false }).limit(limit);
  if (member.role !== "contact") query = query.eq("for_contact", false);
  const { data, error } = await query;
  fail("load the notifications", error);
  return (data ?? []).map(toNotice);
}

/** How many of the party's notifications came after `since` (the account's last look). */
export async function countPartyNotices(member: Pick<PartyMember, "partyId" | "role">, since: string | null) {
  let query = db().from("party_notices").select("id", { count: "exact", head: true }).eq("party_id", member.partyId);
  if (member.role !== "contact") query = query.eq("for_contact", false);
  if (since) query = query.gt("created_at", since);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/* The commission portal's lists */

type Person = { first_name: string; middle_name: string; last_name: string; email: string };

export type PartySummary = Party & {
  contact: { name: string; email: string } | null;
  members: number;
  requests: number;
  /** Each requirement's review: what the list and its progress bars read. */
  documents: Array<{ requirement: string; status: DocumentStatus }>;
  /** Candidates filed under it (not withdrawn), and of those, endorsed and qualified. */
  candidates: number;
  endorsed: number;
  qualified: number;
  /** The last thing anyone did: the party's own change, or a document's. */
  lastActivity: string;
};

/** Every party a unit may see, withdrawn ones too: all of them for the Central Comelec, its own for a Local unit (`college`). */
export async function listPartiesForUnit(college: string | null): Promise<PartySummary[]> {
  let query = db().from("parties")
    .select("*, contact:party_members!parties_contact_member_fk(first_name, middle_name, last_name, email), party_members!party_members_party_id_fkey(status), party_submissions(requirement, status, updated_at), candidacies(status, endorsement)")
    .order("created_at", { ascending: false }).limit(1000);
  if (college !== null) query = query.eq("college", college);
  const { data, error } = await query;
  fail("load the parties", error);
  return (data ?? []).map((row) => {
    const members = (row.party_members ?? []) as Array<{ status: string }>;
    const submissions = (row.party_submissions ?? []) as Array<{ requirement: string; status: DocumentStatus; updated_at: string }>;
    const candidacies = ((row.candidacies ?? []) as Array<{ status: string; endorsement: string }>).filter((item) => item.status !== "withdrawn");
    const contact = (Array.isArray(row.contact) ? row.contact[0] : row.contact) as Person | null;
    const party = toParty(row);
    return {
      ...party,
      contact: contact ? { name: fullName({ firstName: contact.first_name, middleName: contact.middle_name, lastName: contact.last_name }), email: contact.email } : null,
      members: members.filter((item) => item.status === "active").length,
      requests: members.filter((item) => item.status === "requested").length,
      documents: submissions.map((item) => ({ requirement: item.requirement, status: item.status })),
      candidates: candidacies.length,
      endorsed: candidacies.filter((item) => item.endorsement === "endorsed").length,
      qualified: candidacies.filter((item) => item.status === "qualified").length,
      lastActivity: [party.updatedAt, ...submissions.map((item) => item.updated_at)].filter(Boolean).sort().at(-1) ?? party.createdAt,
    };
  });
}

/** Every requirement's review across a unit's parties still registering or accredited, for Requirements. */
export async function listSubmissionStatuses(college: string | null): Promise<Array<{ requirement: string; status: DocumentStatus }>> {
  let query = db().from("party_submissions").select("requirement, status, party:parties!inner(college, status)").in("party.status", ["pending", "accredited"]).limit(20000);
  if (college !== null) query = query.eq("party.college", college);
  const { data, error } = await query;
  fail("load the documents", error);
  return (data ?? []).map((row) => ({ requirement: str(row.requirement), status: str(row.status) as DocumentStatus }));
}

/** Everything the party has been told, newest first: the contact person's notices too. The unit's record of what happened. */
export const listPartyActivity = (partyId: string, limit = 200) => listNotices({ partyId, role: "contact" }, limit);
