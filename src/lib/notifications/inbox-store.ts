import "server-only";

import type { PortalUser } from "@/lib/auth/session";
import { BUILT_IN_ID } from "@/lib/auth/session";
import { toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import type { Email } from "@/lib/email/send";
import type { InboxMessage } from "./inbox-rules";
import type { Concern } from "./concern";

const migrationError = "Inbox is unavailable. Apply supabase/migrations/0043_portal_inbox.sql and try again.";

export async function publishMessage(message: Omit<InboxMessage, "id" | "createdAt" | "readAt">, recipientIds: string[]) {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured to send announcements.");
  if (!recipientIds.length) throw new Error("There are no active recipients for this announcement.");
  const { error } = await createAdminClient().from("portal_messages").insert({
    kind: message.kind, title: message.title, body: message.body, sender_name: message.senderName,
    audience_label: message.audienceLabel, recipient_ids: [...new Set(recipientIds)],
  });
  if (error) throw new Error(migrationError);
}

export async function getInbox(user: PortalUser, kind?: InboxMessage["kind"], page = 0): Promise<InboxMessage[]> {
  if (!isSupabaseConfigured()) return [];
  const client = createAdminClient();
  let query = client.from("portal_messages").select("id,kind,title,body,sender_name,audience_label,created_at")
    .contains("recipient_ids", [user.id]).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.range(page * 30, page * 30 + 29);
  if (error) throw new Error(migrationError);
  if (!data.length) return [];
  const { data: reads, error: readError } = await client.from("portal_message_reads").select("message_id,read_at")
    .eq("account_id", user.id).in("message_id", data.map((row) => row.id));
  if (readError) throw new Error(migrationError);
  const readMap = new Map(reads.map((row) => [row.message_id, row.read_at]));
  return data.map((row) => ({ id: row.id, kind: row.kind, title: row.title, body: row.body, senderName: row.sender_name,
    audienceLabel: row.audience_label, createdAt: row.created_at, readAt: readMap.get(row.id) ?? null }));
}

export async function markMessageRead(user: PortalUser, id: string) {
  const client = createAdminClient();
  const { data, error } = await client.from("portal_messages").select("id").eq("id", id).contains("recipient_ids", [user.id]).maybeSingle();
  if (error) throw new Error(migrationError);
  if (!data) throw new Error("This notification is unavailable.");
  const { error: writeError } = await client.from("portal_message_reads").upsert({ message_id: id, account_id: user.id }, { onConflict: "message_id,account_id", ignoreDuplicates: true });
  if (writeError) throw new Error(migrationError);
}

/** Keep a short activity notice for existing email recipients, without copying private email bodies. */
export async function recordActivity(email: Email, concern?: Concern) {
  try {
    if (!isSupabaseConfigured()) return;
    const addresses = new Set(email.to.split(",").map((address) => address.trim().toLowerCase()));
    const accounts = (await store.list("accounts")).map(toSummary);
    const ids = accounts.filter((account) => account.active && addresses.has(account.email.trim().toLowerCase())
      && (!concern || (account.affiliation === concern.unit && (concern.unit !== "local" || account.college === concern.college)))).map((account) => account.id);
    const builtIn = process.env.PORTAL_EXECUTIVE_EMAIL?.trim().toLowerCase();
    if (builtIn && addresses.has(builtIn) && concern?.unit !== "local" && !accounts.some((account) => account.active && account.affiliation === "central" && account.email.trim().toLowerCase() === builtIn)) ids.push(BUILT_IN_ID);
    if (ids.length) await publishMessage({ kind: "activity", title: email.subject, body: "A new activity concerns your account or unit. Check the related portal section for details.", senderName: "Central Comelec COMET", audienceLabel: "Account activity" }, ids);
  } catch (error) {
    // Notifications must never prevent the original action or its email from completing.
    console.error("Couldn’t record portal activity:", error instanceof Error ? error.message : error);
  }
}
