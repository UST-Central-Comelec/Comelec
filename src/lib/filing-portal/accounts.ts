import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { Notice, PublicAccount } from "./types";

// The filing portal's accounts (public.public_accounts) and their own notifications
// (public.account_notices): supabase/migrations/20261017210000_candidacy_filing.sql. Callers have
// checked who's asking first.

type Row = Record<string, unknown>;
const db = () => createAdminClient();
const str = (value: unknown) => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown) => (typeof value === "string" ? value : null);
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Couldn’t ${what}: ${error.message}`);
}

export const toAccount = (row: Row): PublicAccount => ({
  id: str(row.id), email: str(row.email), lastName: str(row.last_name), firstName: str(row.first_name), middleName: str(row.middle_name),
  studentNumber: str(row.student_number), mobileNumber: str(row.mobile_number), facebookUrl: str(row.facebook_url),
  college: str(row.college), program: str(row.program), yearLevel: str(row.year_level), noticesReadAt: strOrNull(row.notices_read_at), createdAt: str(row.created_at),
});

export const toNotice = (row: Row): Notice => ({ id: str(row.id), kind: str(row.kind), title: str(row.title), body: str(row.body), href: strOrNull(row.href), actor: str(row.actor), createdAt: str(row.created_at) });

export async function getAccount(id: string): Promise<PublicAccount | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("public_accounts").select("*").eq("id", id).maybeSingle();
  fail("load the account", error);
  return data ? toAccount(data) : null;
}

export async function findAccountByEmail(email: string): Promise<PublicAccount | null> {
  const { data, error } = await db().from("public_accounts").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
  fail("look up the account", error);
  return data ? toAccount(data) : null;
}

export type NewAccount = Omit<PublicAccount, "id" | "noticesReadAt" | "createdAt">;

/** Makes the account, or returns the one this email already has (two tabs signing up at once). */
export async function createAccount(account: NewAccount): Promise<PublicAccount> {
  const { data, error } = await db().from("public_accounts").insert({
    email: account.email.trim().toLowerCase(), last_name: account.lastName, first_name: account.firstName, middle_name: account.middleName,
    student_number: account.studentNumber, mobile_number: account.mobileNumber, facebook_url: account.facebookUrl,
    college: account.college, program: account.program, year_level: account.yearLevel,
  }).select("*").single();
  if (error?.code === "23505") {
    const existing = await findAccountByEmail(account.email);
    if (existing) return existing;
  }
  fail("make the account", error);
  return toAccount(data!);
}

export async function markNoticesRead(accountId: string) {
  const { error } = await db().from("public_accounts").update({ notices_read_at: new Date().toISOString() }).eq("id", accountId);
  fail("mark the notifications read", error);
}

/** One of the account's own notifications (its candidacy's). Never fails what it's about. */
export async function addAccountNotice(notice: { accountId: string; kind: string; title: string; body?: string; href?: string; actor?: string }) {
  const { error } = await db().from("account_notices").insert({ account_id: notice.accountId, kind: notice.kind, title: notice.title, body: notice.body ?? "", href: notice.href ?? null, actor: notice.actor ?? "" });
  if (error) console.error("Couldn’t add an account notice:", error.message);
}

export async function listAccountNotices(accountId: string, limit = 100): Promise<Notice[]> {
  const { data, error } = await db().from("account_notices").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(limit);
  fail("load the notifications", error);
  return (data ?? []).map(toNotice);
}

export async function countAccountNotices(accountId: string, since: string | null) {
  let query = db().from("account_notices").select("id", { count: "exact", head: true }).eq("account_id", accountId);
  if (since) query = query.gt("created_at", since);
  const { count, error } = await query;
  return error ? 0 : count ?? 0;
}
