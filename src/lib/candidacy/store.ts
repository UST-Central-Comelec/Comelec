import "server-only";

import { toAccount } from "@/lib/filing-portal/accounts";
import type { FilingFile, PublicAccount } from "@/lib/filing-portal/types";
import { createAdminClient } from "@/lib/supabase/server";
import type { Candidacy, CandidacyDocument, CandidacyStatus } from "./types";

// Filing of Candidacy's records: public.candidacies, public.candidacy_submissions. Callers have
// checked who's asking first: the filing portal's session, or a commission portal tab.

type Row = Record<string, unknown>;
const db = () => createAdminClient();
const str = (value: unknown) => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown) => (typeof value === "string" ? value : null);
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Couldn’t ${what}: ${error.message}`);
}

const SELECT = "*, party:parties(name, status, sanction)";

export function toCandidacy(row: Row): Candidacy {
  const party = one(row.party as Row | Row[] | null);
  return {
    id: str(row.id), reference: str(row.reference), accountId: str(row.account_id), college: str(row.college), position: str(row.position),
    partyId: strOrNull(row.party_id), partyName: strOrNull(party?.name),
    partyStatus: party ? (str(party.status) as Candidacy["partyStatus"]) : null, partySanction: party?.sanction === "suspended" || party?.sanction === "blacklisted" ? (party.sanction as Candidacy["partySanction"]) : null,
    endorsement: str(row.endorsement) as Candidacy["endorsement"], endorsedBy: strOrNull(row.endorsed_by), endorsedAt: strOrNull(row.endorsed_at),
    dateOfBirth: str(row.date_of_birth), residence: str(row.residence), status: str(row.status) as CandidacyStatus,
    decisionRemarks: str(row.decision_remarks), decidedBy: strOrNull(row.decided_by), decidedAt: strOrNull(row.decided_at), decisionOverride: row.decision_override === true,
    withdrawnBy: strOrNull(row.withdrawn_by), withdrawnAt: strOrNull(row.withdrawn_at), withdrawalReason: str(row.withdrawal_reason),
    createdAt: str(row.created_at), updatedAt: str(row.updated_at),
  };
}

const toFiles = (value: unknown): FilingFile[] => (Array.isArray(value) ? value : []).filter((file): file is FilingFile => Boolean(file) && typeof file === "object" && typeof (file as FilingFile).path === "string");

export const toCandidacyDocument = (row: Row): CandidacyDocument => ({
  id: str(row.id), candidacyId: str(row.candidacy_id), requirement: str(row.requirement), files: toFiles(row.files), status: str(row.status) as CandidacyDocument["status"],
  submittedBy: strOrNull(row.submitted_by), submittedAt: strOrNull(row.submitted_at), feedback: str(row.feedback),
  reviewedBy: strOrNull(row.reviewed_by), reviewedAt: strOrNull(row.reviewed_at), updatedAt: str(row.updated_at),
});

export async function getCandidacy(id: string): Promise<Candidacy | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("candidacies").select(SELECT).eq("id", id).maybeSingle();
  fail("load the candidacy", error);
  return data ? toCandidacy(data) : null;
}

/** The account's candidacy, if it has one that isn't withdrawn. */
export async function candidacyOfAccount(accountId: string): Promise<Candidacy | null> {
  const { data, error } = await db().from("candidacies").select(SELECT).eq("account_id", accountId).neq("status", "withdrawn").limit(1).maybeSingle();
  fail("load the candidacy", error);
  return data ? toCandidacy(data) : null;
}

export type NewCandidacy = { accountId: string; college: string; position: string; partyId: string | null; dateOfBirth: string; residence: string };

/** Files the candidacy. One running under a party waits for the party's endorsement. */
export async function createCandidacy(candidacy: NewCandidacy): Promise<Candidacy | "closed" | "taken"> {
  const { data, error } = await db().from("candidacies").insert({
    account_id: candidacy.accountId, college: candidacy.college, position: candidacy.position, party_id: candidacy.partyId,
    endorsement: candidacy.partyId ? "waiting" : "none", date_of_birth: candidacy.dateOfBirth, residence: candidacy.residence,
  }).select(SELECT).single();
  if (error?.message.includes("candidacy_closed")) return "closed";
  if (error?.code === "23505") return "taken";
  fail("file the candidacy", error);
  return toCandidacy(data!);
}

/** The party's contact person endorses a candidate running under it, or declines to. Only a waiting one changes. */
export async function decideEndorsement(id: string, partyId: string, endorse: boolean, by: string): Promise<Candidacy | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacies").update({ endorsement: endorse ? "endorsed" : "declined", endorsed_by: by, endorsed_at: now, updated_at: now })
    .eq("id", id).eq("party_id", partyId).eq("endorsement", "waiting").select(SELECT).maybeSingle();
  fail("save the endorsement", error);
  return data ? toCandidacy(data) : null;
}

/** The candidate withdraws their filing while it's still pending, so they can file again. */
export async function withdrawCandidacy(id: string, accountId: string, by: string): Promise<Candidacy | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacies").update({ status: "withdrawn", withdrawn_by: by, withdrawn_at: now, updated_at: now }).eq("id", id).eq("account_id", accountId).eq("status", "pending").select(SELECT).maybeSingle();
  fail("withdraw the candidacy", error);
  return data ? toCandidacy(data) : null;
}

/** The unit records a withdrawal, on the candidate's sworn declaration: from any state but withdrawn. */
export async function withdrawCandidacyByUnit(id: string, by: string, reason: string): Promise<Candidacy | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacies").update({ status: "withdrawn", withdrawn_by: by, withdrawn_at: now, withdrawal_reason: reason, updated_at: now }).eq("id", id).neq("status", "withdrawn").select(SELECT).maybeSingle();
  fail("withdraw the candidacy", error);
  return data ? toCandidacy(data) : null;
}

/** Every candidacy the account has filed, newest first, withdrawn ones too. */
export async function listAccountCandidacies(accountId: string): Promise<Candidacy[]> {
  const { data, error } = await db().from("candidacies").select(SELECT).eq("account_id", accountId).order("created_at", { ascending: false });
  fail("load the candidacies", error);
  return (data ?? []).map(toCandidacy);
}

export type CandidateRow = Candidacy & { account: PublicAccount };

/** Candidates asking a party for its endorsement, and those it has endorsed, with who they are. */
export async function listPartyCandidates(partyId: string): Promise<CandidateRow[]> {
  const { data, error } = await db().from("candidacies").select(`${SELECT}, account:public_accounts(*)`).eq("party_id", partyId).neq("status", "withdrawn").order("created_at");
  fail("load the party’s candidates", error);
  return (data ?? []).map((row) => ({ ...toCandidacy(row), account: toAccount(one(row.account as Row | Row[]) as Row) }));
}

export type FilingSummary = CandidateRow & {
  documents: Array<{ requirement: string; status: CandidacyDocument["status"] }>;
  /** The last thing anyone did: the filing's own change, or a document's. */
  lastActivity: string;
};

/** A unit's filings, newest first, withdrawn ones too: all of them for the Central Comelec, its own for a Local unit (`college`). */
export async function listCandidaciesForUnit(college: string | null): Promise<FilingSummary[]> {
  let query = db().from("candidacies").select(`${SELECT}, account:public_accounts(*), candidacy_submissions(requirement, status, updated_at)`).order("created_at", { ascending: false }).limit(2000);
  if (college !== null) query = query.eq("college", college);
  const { data, error } = await query;
  fail("load the filings", error);
  return (data ?? []).map((row) => {
    const documents = (row.candidacy_submissions ?? []) as Array<{ requirement: string; status: CandidacyDocument["status"]; updated_at: string }>;
    const candidacy = toCandidacy(row);
    return {
      ...candidacy,
      account: toAccount(one(row.account as Row | Row[]) as Row),
      documents: documents.map((item) => ({ requirement: item.requirement, status: item.status })),
      lastActivity: [candidacy.updatedAt, ...documents.map((item) => item.updated_at)].filter(Boolean).sort().at(-1) ?? candidacy.createdAt,
    };
  });
}

/** Every requirement's review across a unit's filings still in play, for Requirements. */
export async function listCandidacyDocumentStatuses(college: string | null): Promise<Array<{ requirement: string; status: CandidacyDocument["status"] }>> {
  let query = db().from("candidacy_submissions").select("requirement, status, candidacy:candidacies!inner(college, status)").in("candidacy.status", ["pending", "qualified"]).limit(20000);
  if (college !== null) query = query.eq("candidacy.college", college);
  const { data, error } = await query;
  fail("load the documents", error);
  return (data ?? []).map((row) => ({ requirement: str(row.requirement), status: str(row.status) as CandidacyDocument["status"] }));
}

/** Decides on a candidacy: never one that's withdrawn. `override`: qualified with documents outstanding. */
export async function decideCandidacy(id: string, status: "pending" | "qualified" | "disqualified", remarks: string, by: string, override = false): Promise<Candidacy | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacies").update({ status, decision_remarks: remarks, decided_by: by, decided_at: now, decision_override: override, updated_at: now }).eq("id", id).neq("status", "withdrawn").select(SELECT).maybeSingle();
  fail("save the decision", error);
  return data ? toCandidacy(data) : null;
}

/* Documents */

export async function listCandidacyDocuments(candidacyId: string): Promise<CandidacyDocument[]> {
  const { data, error } = await db().from("candidacy_submissions").select("*").eq("candidacy_id", candidacyId);
  fail("load the documents", error);
  return (data ?? []).map(toCandidacyDocument);
}

export async function getCandidacyDocument(candidacyId: string, requirement: string): Promise<CandidacyDocument | null> {
  const { data, error } = await db().from("candidacy_submissions").select("*").eq("candidacy_id", candidacyId).eq("requirement", requirement).maybeSingle();
  fail("load the document", error);
  return data ? toCandidacyDocument(data) : null;
}

export async function getCandidacyDocumentById(id: string): Promise<CandidacyDocument | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("candidacy_submissions").select("*").eq("id", id).maybeSingle();
  fail("load the document", error);
  return data ? toCandidacyDocument(data) : null;
}

export async function addCandidacyFiles(candidacyId: string, requirement: string, files: FilingFile[]): Promise<CandidacyDocument | "locked"> {
  const { data, error } = await db().rpc("candidacy_submission_add_files", { p_candidacy: candidacyId, p_requirement: requirement, p_files: files });
  if (error?.message.includes("candidacy_submission_locked")) return "locked";
  fail("save the files", error);
  return toCandidacyDocument(data as Row);
}

export async function removeCandidacyFile(candidacyId: string, requirement: string, path: string): Promise<"removed" | "locked"> {
  const { error } = await db().rpc("candidacy_submission_remove_file", { p_candidacy: candidacyId, p_requirement: requirement, p_path: path });
  if (error?.message.includes("candidacy_submission_locked")) return "locked";
  fail("remove the file", error);
  return "removed";
}

export async function sendCandidacyDocument(candidacyId: string, requirement: string, by: string): Promise<CandidacyDocument | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacy_submissions").update({ status: "submitted", submitted_by: by, submitted_at: now, updated_at: now })
    .eq("candidacy_id", candidacyId).eq("requirement", requirement).in("status", ["draft", "changes"]).select("*").maybeSingle();
  fail("send the document", error);
  return data ? toCandidacyDocument(data) : null;
}

export async function takeBackCandidacyDocument(candidacyId: string, requirement: string): Promise<CandidacyDocument | null> {
  const { data, error } = await db().from("candidacy_submissions").update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("candidacy_id", candidacyId).eq("requirement", requirement).eq("status", "submitted").select("*").maybeSingle();
  fail("take the document back", error);
  return data ? toCandidacyDocument(data) : null;
}

/** As for a party's: only a sent document, and only over the version the reviewer opened (`seen`). Null when it moved on. */
export async function reviewCandidacyDocument(id: string, status: "approved" | "changes", feedback: string, by: string, seen: string): Promise<CandidacyDocument | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacy_submissions").update({ status, feedback, reviewed_by: by, reviewed_at: now, updated_at: now })
    .eq("id", id).eq("updated_at", seen).in("status", ["submitted", "approved", "changes"]).select("*").maybeSingle();
  fail("save the review", error);
  return data ? toCandidacyDocument(data) : null;
}

export async function candidacyBytes(candidacyId: string) {
  return (await listCandidacyDocuments(candidacyId)).reduce((sum, item) => sum + item.files.reduce((size, file) => size + (Number(file.size) || 0), 0), 0);
}
