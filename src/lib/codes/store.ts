import "server-only";

import { toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import { cscConstitution } from "@/lib/elections-code/csc-constitution";
import { usec2011, type CodeArticle } from "@/lib/elections-code/usec-2011";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { noChanges, type ChangeStats } from "./diff";
import { approverRoleOf, canEditCodes, isCodeKey, type ApproverRole, type CodeKey, type CodeRevision, type PublishedCode, type RevisionPerson, type RevisionStatus, type RevisionSummary } from "./options";

// The revisions of the Constitution and the Elections Code: public.code_revisions
// (supabase/migrations/0025). The website shows the latest approved revision of each text, and the
// text as it was signed until there is one.

const TABLE = "code_revisions";

/** Each text as it was signed: what the website shows until a revision is approved, and what the first revision starts from. */
const signed: Record<CodeKey, CodeArticle[]> = { constitution: cscConstitution, "elections-code": usec2011 };

/** Everything but the two texts, which a list has no use for. */
const SUMMARY = "id, code, status, summary, stats, author_email, author_name, author_role, submitted, approvals, returned, events, base_version, version, edits, created_at, updated_at, updated_by, decided_at";

type Row = Record<string, unknown>;

const toStats = (value: unknown): ChangeStats => ({ ...noChanges, ...(value && typeof value === "object" ? (value as Partial<ChangeStats>) : {}) });

const toRevisionSummary = (row: Row): RevisionSummary => ({
  id: row.id as string,
  code: row.code as CodeKey,
  status: row.status as RevisionStatus,
  summary: (row.summary as string | null) ?? "",
  stats: toStats(row.stats),
  author: { name: row.author_name as string, email: row.author_email as string, role: (row.author_role as string | null) ?? "" },
  submitted: (row.submitted as RevisionSummary["submitted"]) ?? null,
  approvals: (row.approvals as RevisionSummary["approvals"] | null) ?? {},
  returned: (row.returned as RevisionSummary["returned"]) ?? null,
  events: (row.events as RevisionSummary["events"] | null) ?? [],
  baseVersion: row.base_version as number,
  version: (row.version as number | null) ?? null,
  edits: row.edits as number,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  updatedBy: row.updated_by as string,
  decidedAt: (row.decided_at as string | null) ?? null,
});

const toRevision = (row: Row): CodeRevision => ({ ...toRevisionSummary(row), articles: row.articles as CodeArticle[], baseArticles: row.base_articles as CodeArticle[] });

/** True when the table isn't there yet: 0025 hasn't been run. */
export const isCodesMissing = (message: string) => message.includes(TABLE) || message.includes("schema cache");

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

/** The text as it was signed, as the published text: version 0. */
const asSigned = (code: CodeKey): PublishedCode => ({ code, articles: signed[code], version: 0, publishedAt: null, revisionId: null });

let warned = false;

/**
 * The text the website shows: the latest approved revision, or the text as signed. Never throws:
 * before the migration is run, and whenever the revisions can't be read, it's the text as signed
 * rather than a broken page.
 */
export async function getPublishedCode(code: CodeKey): Promise<PublishedCode> {
  if (!isSupabaseConfigured()) return asSigned(code);
  const { data, error } = await createAdminClient().from(TABLE).select("id, articles, version, decided_at").eq("code", code).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    // Said once, not on every request.
    if (!warned) console.error(`Couldn’t load the published ${code}: ${error.message}`);
    warned = true;
    return asSigned(code);
  }
  if (!data) return asSigned(code);
  return { code, articles: data.articles as CodeArticle[], version: data.version as number, publishedAt: (data.decided_at as string | null) ?? null, revisionId: data.id as string };
}

/** The revision being written or waiting to be signed, if there is one. There's never more than one for a text. */
export async function getOpenRevision(code: CodeKey): Promise<CodeRevision | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createAdminClient().from(TABLE).select("*").eq("code", code).in("status", ["draft", "pending"]).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRevision(data) : null;
}

export async function getRevision(id: string): Promise<CodeRevision | null> {
  if (!isSupabaseConfigured() || !isUuid(id)) return null;
  const { data, error } = await createAdminClient().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data && isCodeKey(data.code) ? toRevision(data) : null;
}

/** A revision without its texts: enough to decide on, and far lighter to fetch. */
export async function getRevisionSummary(id: string): Promise<RevisionSummary | null> {
  if (!isSupabaseConfigured() || !isUuid(id)) return null;
  const { data, error } = await createAdminClient().from(TABLE).select(SUMMARY).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data && isCodeKey((data as Row).code) ? toRevisionSummary(data as Row) : null;
}

/** The revisions of one text, or of both, newest first, without their texts. */
export async function listRevisions(filter: { code?: CodeKey; status?: RevisionStatus } = {}): Promise<RevisionSummary[]> {
  if (!isSupabaseConfigured()) return [];
  let query = createAdminClient().from(TABLE).select(SUMMARY).order("created_at", { ascending: false }).limit(200);
  if (filter.code) query = query.eq("code", filter.code);
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Row[]).filter((row) => isCodeKey(row.code)).map(toRevisionSummary);
}

/** Thrown when a draft is started while another revision of the same text is open. */
export class RevisionOpenError extends Error {}

export type NewRevision = { code: CodeKey; articles: CodeArticle[]; baseArticles: CodeArticle[]; baseVersion: number; summary: string; stats: ChangeStats; author: RevisionPerson };

/** Starts a draft. Only one revision of a text can be open, which the table itself holds to. */
export async function createRevision(draft: NewRevision): Promise<RevisionSummary> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .insert({
      code: draft.code,
      articles: draft.articles,
      base_articles: draft.baseArticles,
      base_version: draft.baseVersion,
      summary: draft.summary,
      stats: draft.stats,
      author_email: draft.author.email,
      author_name: draft.author.name,
      author_role: draft.author.role,
      updated_by: draft.author.email,
    })
    .select(SUMMARY)
    .single();
  if (error) {
    if (error.code === "23505" || error.message.includes("code_revisions_one_open")) throw new RevisionOpenError(error.message);
    throw new Error(error.message);
  }
  return toRevisionSummary(data as Row);
}

/** The columns a change may set. `updated_by`, `updated_at` and the count of saves are set here. */
type Changes = Partial<{ articles: CodeArticle[]; summary: string; stats: ChangeStats; status: RevisionStatus; submitted: RevisionSummary["submitted"]; approvals: RevisionSummary["approvals"]; returned: RevisionSummary["returned"]; events: RevisionSummary["events"]; version: number; decided_at: string }>;

/**
 * Changes a revision as it was read: only if it's still `from.status` and nobody has saved it since
 * (`from.edits`). Null when someone got in first, so nothing was changed; the caller reads it again.
 */
export async function changeRevision(from: Pick<RevisionSummary, "id" | "status" | "edits">, changes: Changes, by: string): Promise<RevisionSummary | null> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .update({ ...changes, edits: from.edits + 1, updated_at: new Date().toISOString(), updated_by: by })
    .eq("id", from.id)
    .eq("status", from.status)
    .eq("edits", from.edits)
    .select(SUMMARY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRevisionSummary(data as Row) : null;
}

type Listed = { name: string; email: string };

/** The active accounts that sign revisions, each with the signature it holds. */
export async function listApprovers(): Promise<Array<Listed & { role: ApproverRole }>> {
  return (await store.list("accounts"))
    .map(toSummary)
    .filter((account) => account.active)
    .flatMap((account) => {
      const role = approverRoleOf(account);
      return role ? [{ name: account.name, email: account.email, role }] : [];
    });
}

/** Who holds each office that signs, by office: the names a revision that's waiting is waiting on. */
export function holdersOf(approvers: Array<Listed & { role: ApproverRole }>) {
  const holders: Partial<Record<ApproverRole, string[]>> = {};
  for (const { role, name } of approvers) (holders[role] ??= []).push(name);
  return holders;
}

/** The active accounts that write revisions. */
export async function listEditors(): Promise<Listed[]> {
  return (await store.list("accounts")).map(toSummary).filter((account) => account.active && canEditCodes(account)).map(({ name, email }) => ({ name, email }));
}
