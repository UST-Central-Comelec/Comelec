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

const SELECT = "*, party:parties(name)";

export const toCandidacy = (row: Row): Candidacy => ({
  id: str(row.id), accountId: str(row.account_id), college: str(row.college), position: str(row.position),
  partyId: strOrNull(row.party_id), partyName: strOrNull(one(row.party as Row | Row[] | null)?.name),
  endorsement: str(row.endorsement) as Candidacy["endorsement"], endorsedBy: strOrNull(row.endorsed_by), endorsedAt: strOrNull(row.endorsed_at),
  dateOfBirth: str(row.date_of_birth), residence: str(row.residence), status: str(row.status) as CandidacyStatus,
  decisionRemarks: str(row.decision_remarks), decidedBy: strOrNull(row.decided_by), decidedAt: strOrNull(row.decided_at), createdAt: str(row.created_at),
});

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
export async function withdrawCandidacy(id: string, accountId: string): Promise<Candidacy | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacies").update({ status: "withdrawn", updated_at: now }).eq("id", id).eq("account_id", accountId).eq("status", "pending").select(SELECT).maybeSingle();
  fail("withdraw the candidacy", error);
  return data ? toCandidacy(data) : null;
}

export type CandidateRow = Candidacy & { account: PublicAccount };

/** Candidates asking a party for its endorsement, and those it has endorsed, with who they are. */
export async function listPartyCandidates(partyId: string): Promise<CandidateRow[]> {
  const { data, error } = await db().from("candidacies").select(`${SELECT}, account:public_accounts(*)`).eq("party_id", partyId).neq("status", "withdrawn").order("created_at");
  fail("load the party’s candidates", error);
  return (data ?? []).map((row) => ({ ...toCandidacy(row), account: toAccount(one(row.account as Row | Row[]) as Row) }));
}

/** A unit's filings, newest first: all of them for the Central Comelec, its own for a Local unit (`college`). */
export async function listCandidaciesForUnit(college: string | null): Promise<Array<CandidateRow & { approved: number; waiting: number }>> {
  let query = db().from("candidacies").select(`${SELECT}, account:public_accounts(*), candidacy_submissions(status)`).neq("status", "withdrawn").order("created_at", { ascending: false }).limit(500);
  if (college !== null) query = query.eq("college", college);
  const { data, error } = await query;
  fail("load the filings", error);
  return (data ?? []).map((row) => {
    const documents = (row.candidacy_submissions ?? []) as Array<{ status: string }>;
    return {
      ...toCandidacy(row),
      account: toAccount(one(row.account as Row | Row[]) as Row),
      approved: documents.filter((item) => item.status === "approved").length,
      waiting: documents.filter((item) => item.status === "submitted").length,
    };
  });
}

export async function decideCandidacy(id: string, status: "pending" | "qualified" | "disqualified", remarks: string, by: string): Promise<Candidacy | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacies").update({ status, decision_remarks: remarks, decided_by: by, decided_at: now, updated_at: now }).eq("id", id).select(SELECT).maybeSingle();
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

export async function reviewCandidacyDocument(id: string, status: "approved" | "changes", feedback: string, by: string): Promise<CandidacyDocument | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("candidacy_submissions").update({ status, feedback, reviewed_by: by, reviewed_at: now, updated_at: now }).eq("id", id).select("*").maybeSingle();
  fail("save the review", error);
  return data ? toCandidacyDocument(data) : null;
}

export async function candidacyBytes(candidacyId: string) {
  return (await listCandidacyDocuments(candidacyId)).reduce((sum, item) => sum + item.files.reduce((size, file) => size + (Number(file.size) || 0), 0), 0);
}
