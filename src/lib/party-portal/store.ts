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
  id: str(row.id), name: str(row.name), college: str(row.college), establishedAt: str(row.established_at), headquarters: str(row.headquarters),
  contactMemberId: strOrNull(row.contact_member_id), status: str(row.status) as Party["status"], decisionRemarks: str(row.decision_remarks),
  decidedBy: strOrNull(row.decided_by), decidedAt: strOrNull(row.decided_at), createdAt: str(row.created_at),
});

export const toMember = (row: Row): PartyMember => ({
  id: str(row.id), partyId: str(row.party_id), accountId: strOrNull(row.account_id), email: str(row.email), lastName: str(row.last_name), firstName: str(row.first_name), middleName: str(row.middle_name),
  studentNumber: str(row.student_number), mobileNumber: str(row.mobile_number), facebookUrl: str(row.facebook_url),
  college: str(row.college), program: str(row.program), yearLevel: str(row.year_level),
  role: str(row.role) as PartyMember["role"], status: str(row.status) as PartyMember["status"],
  decidedBy: strOrNull(row.decided_by), decidedAt: strOrNull(row.decided_at), createdAt: str(row.created_at),
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
  const { data, error } = await db().from("parties").select("id, name, college, established_at, headquarters, contact:party_members!parties_contact_member_fk(first_name, middle_name, last_name)").eq("status", status).order("name");
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
  if (!party || party.status !== "pending") return { error: "party-gone" };
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

/** The unit's review of a document: approved, or sent back with what to change. */
export async function reviewSubmission(id: string, status: "approved" | "changes", feedback: string, by: string): Promise<Submission | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("party_submissions").update({ status, feedback, reviewed_by: by, reviewed_at: now, updated_at: now }).eq("id", id).select("*").maybeSingle();
  fail("save the review", error);
  return data ? toSubmission(data) : null;
}

/** Every file a party keeps, in bytes, for its overall limit. */
export async function partyBytes(partyId: string) {
  return (await listSubmissions(partyId)).reduce((sum, submission) => sum + submission.files.reduce((size, file) => size + (Number(file.size) || 0), 0), 0);
}

/* The party's decision */

export async function decideParty(id: string, status: "pending" | "accredited" | "declined", remarks: string, by: string): Promise<Party | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("parties").update({ status, decision_remarks: remarks, decided_by: by, decided_at: now, updated_at: now }).eq("id", id).select("*").maybeSingle();
  fail("save the decision", error);
  return data ? toParty(data) : null;
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

export type PartySummary = Party & { members: number; requests: number; approved: number; waiting: number };

/** Every party a unit may see: all of them for the Central Comelec, its own for a Local unit (`college`). */
export async function listPartiesForUnit(college: string | null): Promise<PartySummary[]> {
  let query = db().from("parties").select("*, party_members!party_members_party_id_fkey(status), party_submissions(status)").neq("status", "withdrawn").order("created_at", { ascending: false }).limit(500);
  if (college !== null) query = query.eq("college", college);
  const { data, error } = await query;
  fail("load the parties", error);
  return (data ?? []).map((row) => {
    const members = (row.party_members ?? []) as Array<{ status: string }>;
    const submissions = (row.party_submissions ?? []) as Array<{ status: string }>;
    return {
      ...toParty(row),
      members: members.filter((item) => item.status === "active").length,
      requests: members.filter((item) => item.status === "requested").length,
      approved: submissions.filter((item) => item.status === "approved").length,
      waiting: submissions.filter((item) => item.status === "submitted").length,
    };
  });
}
