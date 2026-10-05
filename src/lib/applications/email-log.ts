import "server-only";

import { revalidatePath } from "next/cache";
import type { Email } from "@/lib/email/send";
import { sendAutomatic } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/server";

const emailKeys = {
  acknowledgement: "application-received",
  accepted: "application-accepted",
  rejected: "application-declined",
} as const;

export type ApplicationEmailKind = keyof typeof emailKeys;
export type ApplicationEmailLog = { kind: ApplicationEmailKind; sentAt: string };

/** Email history is optional on databases that have not applied migration 0035 yet. */
export async function getApplicationEmailLogs(ids: string[]): Promise<Map<string, ApplicationEmailLog[]> | null> {
  const logs = new Map<string, ApplicationEmailLog[]>();
  if (!ids.length) return logs;
  // Limit each request's URL length when a recruitment period has many applicants.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await createAdminClient().from("application_email_logs")
      .select("application_id, kind, sent_at").in("application_id", ids.slice(offset, offset + 100)).order("sent_at");
    if (error) {
      if (error.message.includes("application_email_logs") && (error.code === "PGRST205" || error.code === "42P01")) return null;
      throw new Error(`Couldn’t load application email history: ${error.message}`);
    }
    for (const row of data ?? []) {
      if (!(row.kind in emailKeys)) continue;
      const history = logs.get(row.application_id) ?? [];
      history.push({ kind: row.kind as ApplicationEmailKind, sentAt: row.sent_at });
      logs.set(row.application_id, history);
    }
  }
  return logs;
}

/** Record each successful send, including subsequent result emails, after SMTP accepts it. */
export async function sendApplicationEmail(id: string, kind: ApplicationEmailKind, build: () => Email | Promise<Email>) {
  const sent = await sendAutomatic(emailKeys[kind], build);
  if (sent !== "sent") return sent;

  const sentAt = new Date().toISOString();
  try {
    const { error } = await createAdminClient().from("application_email_logs").insert({ application_id: id, kind, sent_at: sentAt });
    if (error) throw new Error(error.message);
    revalidatePath("/portal/recruitment/applications");
  } catch (error) {
    // The email has already gone; a logging failure must not claim the send failed.
    console.error("Email sent, but couldn’t save the application email log:", error instanceof Error ? error.message : error);
  }
  return sent;
}
