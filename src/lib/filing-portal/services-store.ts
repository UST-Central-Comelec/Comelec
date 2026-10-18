import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { toAccount } from "./accounts";
import type { FilingRequest, OnBehalf, Petition, PetitionStatus, PetitionType, RequestKind, RequestMode, RequestStatus } from "./services";
import type { FilingFile, PublicAccount } from "./types";

// The filing portal's Services records: public.filing_requests (consultations and commissioner
// requests) and public.petitions. Callers have checked who's asking first: the filing portal's
// session, or a commission portal tab. Every change is filtered on the state it starts from, so two
// people acting at once can't both win.

type Row = Record<string, unknown>;
const db = () => createAdminClient();
const str = (value: unknown) => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown) => (typeof value === "string" ? value : null);
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Couldn’t ${what}: ${error.message}`);
}

/** Whether the tables are there yet: 20261018200000_filing_services_campaign.sql. */
export const isServicesMissing = (message: string) => /filing_requests|petitions|campaign_materials|campaign_activities|schema cache|does not exist/i.test(message);

const REQUEST = "*, party:parties(name)";

export const toRequest = (row: Row): FilingRequest => ({
  id: str(row.id), reference: str(row.reference), accountId: str(row.account_id), kind: str(row.kind) as RequestKind, college: str(row.college),
  onBehalf: str(row.on_behalf) as OnBehalf, partyId: strOrNull(row.party_id), partyName: strOrNull(one(row.party as Row | Row[] | null)?.name),
  topic: str(row.topic), subject: str(row.subject), details: str(row.details), mode: str(row.mode) as RequestMode, venue: str(row.venue),
  startsAt: str(row.starts_at), endsAt: str(row.ends_at), status: str(row.status) as RequestStatus,
  confirmedStart: strOrNull(row.confirmed_start), confirmedEnd: strOrNull(row.confirmed_end), location: str(row.location), assigned: str(row.assigned), response: str(row.response),
  handledBy: strOrNull(row.handled_by), handledAt: strOrNull(row.handled_at), cancelledAt: strOrNull(row.cancelled_at), createdAt: str(row.created_at), updatedAt: str(row.updated_at),
});

const toFiles = (value: unknown): FilingFile[] => (Array.isArray(value) ? value : []).filter((file): file is FilingFile => Boolean(file) && typeof file === "object" && typeof (file as FilingFile).path === "string");

export const toPetition = (row: Row): Petition => ({
  id: str(row.id), reference: str(row.reference), accountId: str(row.account_id), college: str(row.college), type: str(row.type) as PetitionType,
  subject: str(row.subject), respondent: str(row.respondent), occurredOn: str(row.occurred_on), statement: str(row.statement), relief: str(row.relief),
  files: toFiles(row.files), status: str(row.status) as PetitionStatus, remarks: str(row.remarks),
  docketedBy: strOrNull(row.docketed_by), docketedAt: strOrNull(row.docketed_at), decidedBy: strOrNull(row.decided_by), decidedAt: strOrNull(row.decided_at),
  withdrawnAt: strOrNull(row.withdrawn_at), createdAt: str(row.created_at), updatedAt: str(row.updated_at),
});

/* Requests */

export type NewRequest = Pick<FilingRequest, "accountId" | "kind" | "college" | "onBehalf" | "partyId" | "topic" | "subject" | "details" | "mode" | "venue" | "startsAt" | "endsAt">;

export async function createRequest(request: NewRequest): Promise<FilingRequest> {
  const { data, error } = await db().from("filing_requests").insert({
    account_id: request.accountId, kind: request.kind, college: request.college, on_behalf: request.onBehalf, party_id: request.partyId,
    topic: request.topic, subject: request.subject, details: request.details, mode: request.mode, venue: request.venue, starts_at: request.startsAt, ends_at: request.endsAt,
  }).select(REQUEST).single();
  fail("save the request", error);
  return toRequest(data!);
}

export async function getRequest(id: string): Promise<FilingRequest | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("filing_requests").select(REQUEST).eq("id", id).maybeSingle();
  fail("load the request", error);
  return data ? toRequest(data) : null;
}

/** The account's requests, newest first. */
export async function listAccountRequests(accountId: string, kind?: RequestKind): Promise<FilingRequest[]> {
  let query = db().from("filing_requests").select(REQUEST).eq("account_id", accountId).order("created_at", { ascending: false }).limit(200);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  fail("load the requests", error);
  return (data ?? []).map(toRequest);
}

/** The filer cancels one that's waiting, or confirmed and not started. Null when it moved on. */
export async function cancelRequest(id: string, accountId: string): Promise<FilingRequest | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("filing_requests").update({ status: "cancelled", cancelled_at: now, updated_at: now })
    .eq("id", id).eq("account_id", accountId).in("status", ["requested", "confirmed"]).select(REQUEST).maybeSingle();
  fail("cancel the request", error);
  return data ? toRequest(data) : null;
}

export type RequestRow = FilingRequest & { account: PublicAccount };

/** A unit's requests, newest first: every unit's for the Central Comelec (`college` null), its own for a Local unit. */
export async function listRequestsForUnit(college: string | null): Promise<RequestRow[]> {
  let query = db().from("filing_requests").select(`${REQUEST}, account:public_accounts(*)`).order("created_at", { ascending: false }).limit(2000);
  if (college !== null) query = query.eq("college", college);
  const { data, error } = await query;
  fail("load the requests", error);
  return (data ?? []).map((row) => ({ ...toRequest(row), account: toAccount(one(row.account as Row | Row[]) as Row) }));
}

export type RequestAnswer =
  | { status: "confirmed"; start: string; end: string; location: string; assigned: string; response: string }
  | { status: "declined"; response: string }
  | { status: "done"; response: string };

/** The unit answers: confirms or declines one that's waiting (or changes a confirmed one), or marks a confirmed one done. Only over the version it opened (`seen`). */
export async function answerRequest(id: string, answer: RequestAnswer, by: string, seen: string): Promise<FilingRequest | null> {
  const now = new Date().toISOString();
  const from = answer.status === "done" ? ["confirmed"] : ["requested", "confirmed"];
  const changes = answer.status === "confirmed"
    ? { status: "confirmed", confirmed_start: answer.start, confirmed_end: answer.end, location: answer.location, assigned: answer.assigned, response: answer.response }
    : { status: answer.status, response: answer.response };
  const { data, error } = await db().from("filing_requests").update({ ...changes, handled_by: by, handled_at: now, updated_at: now })
    .eq("id", id).eq("updated_at", seen).in("status", from).select(REQUEST).maybeSingle();
  fail("save the answer", error);
  return data ? toRequest(data) : null;
}

/* Petitions */

export type NewPetition = Pick<Petition, "accountId" | "college" | "type" | "subject" | "respondent" | "occurredOn" | "statement" | "relief" | "files">;

export async function createPetition(petition: NewPetition): Promise<Petition> {
  const { data, error } = await db().from("petitions").insert({
    account_id: petition.accountId, college: petition.college, type: petition.type, subject: petition.subject, respondent: petition.respondent,
    occurred_on: petition.occurredOn || null, statement: petition.statement, relief: petition.relief, files: petition.files,
  }).select("*").single();
  fail("file the petition", error);
  return toPetition(data!);
}

export async function getPetition(id: string): Promise<Petition | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("petitions").select("*").eq("id", id).maybeSingle();
  fail("load the petition", error);
  return data ? toPetition(data) : null;
}

export async function listAccountPetitions(accountId: string): Promise<Petition[]> {
  const { data, error } = await db().from("petitions").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(200);
  fail("load the petitions", error);
  return (data ?? []).map(toPetition);
}

/** The filer withdraws one that isn't decided yet. */
export async function withdrawPetition(id: string, accountId: string): Promise<Petition | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("petitions").update({ status: "withdrawn", withdrawn_at: now, updated_at: now })
    .eq("id", id).eq("account_id", accountId).in("status", ["filed", "docketed"]).select("*").maybeSingle();
  fail("withdraw the petition", error);
  return data ? toPetition(data) : null;
}

export type PetitionRow = Petition & { account: PublicAccount };

export async function listPetitionsForUnit(college: string | null): Promise<PetitionRow[]> {
  let query = db().from("petitions").select("*, account:public_accounts(*)").order("created_at", { ascending: false }).limit(2000);
  if (college !== null) query = query.eq("college", college);
  const { data, error } = await query;
  fail("load the petitions", error);
  return (data ?? []).map((row) => ({ ...toPetition(row), account: toAccount(one(row.account as Row | Row[]) as Row) }));
}

/**
 * The unit moves a petition on: dockets one that's filed, or resolves or dismisses one that's filed
 * or docketed, or reopens a decided one for hearing. Only over the version it opened (`seen`).
 */
export async function movePetition(id: string, status: Exclude<PetitionStatus, "filed" | "withdrawn">, remarks: string, by: string, seen: string): Promise<Petition | null> {
  const now = new Date().toISOString();
  const from = status === "docketed" ? ["filed", "resolved", "dismissed"] : ["filed", "docketed"];
  const stamp = status === "docketed" ? { docketed_by: by, docketed_at: now, decided_by: null, decided_at: null } : { decided_by: by, decided_at: now };
  const { data, error } = await db().from("petitions").update({ status, remarks, ...stamp, updated_at: now })
    .eq("id", id).eq("updated_at", seen).in("status", from).select("*").maybeSingle();
  fail("save the petition", error);
  return data ? toPetition(data) : null;
}
