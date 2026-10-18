import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { PortalUser } from "@/lib/auth/session";
import type { CommissionRequest, CommissionRequestType } from "./commission-requests";

const db = () => createAdminClient();
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
export const commissionRequestsMissing = (error: string) => /commission_request|schema cache|does not exist/i.test(error);
export async function listCommissionRequestTypes() {
  const { data, error } = await db().from("commission_request_types").select("*").order("created_at").order("id");
  fail(error); return (data ?? []) as CommissionRequestType[];
}
export async function listCommissionRequests(user: Pick<PortalUser, "affiliation" | "college" | "email">, sent = false) {
  let query = db().from("commission_requests").select("*").order("created_at", { ascending: false }).limit(2000);
  if (sent) query = query.eq("sender_email", user.email);
  else if (user.affiliation === "local") query = query.eq("college", user.college ?? "");
  const { data, error } = await query;
  fail(error); return (data ?? []) as CommissionRequest[];
}
export async function getCommissionRequest(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("commission_requests").select("*").eq("id", id).maybeSingle();
  fail(error); return data as CommissionRequest | null;
}
export async function writeCommissionRequests(rows: Array<Omit<CommissionRequest, "id" | "reference" | "status" | "response" | "handled_by" | "handled_at" | "created_at" | "updated_at">>) {
  // A single insert creates every recipient together; the batch key prevents duplicate sends.
  const { data, error } = await db().from("commission_requests").insert(rows).select("*");
  if (error?.code === "23505") return { duplicate: true as const };
  fail(error); return { requests: (data ?? []) as CommissionRequest[] };
}
export async function writeCommissionRequestType(id: string | null, seen: string, value: Pick<CommissionRequestType, "name" | "description" | "enabled">, by: string) {
  const changes = { ...value, updated_by: by, updated_at: new Date().toISOString() };
  const result = id ? await db().from("commission_request_types").update(changes).eq("id", id).eq("updated_at", seen).select("id") : await db().from("commission_request_types").insert(changes).select("id");
  if (result.error?.code === "23505") throw new Error("A request type already uses that name. Choose another name.");
  fail(result.error); return Boolean(result.data?.length);
}
export async function answerCommissionRequest(id: string, seen: string, status: "confirmed" | "declined" | "done", response: string, by: string) {
  const now = new Date().toISOString();
  const { data, error } = await db().from("commission_requests").update({ status, response, handled_by: by, handled_at: now, updated_at: now }).eq("id", id).eq("updated_at", seen).in("status", status === "done" ? ["confirmed"] : ["requested"]).select("*").maybeSingle();
  fail(error); return data as CommissionRequest | null;
}
