import "server-only";

import { toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { audienceMention, inboxRecipientsOf, recipientsOf, toAudience, type Audience, type Reach } from "./audience";
import { messageHtml, messageText, messageInboxBody, type MessageBody } from "./body";
import { isEmailConfigured, sendEmail } from "./send";
import { publishMessage } from "@/lib/notifications/inbox-store";

// The Email Sender's outbox: public.portal_emails (supabase/migrations/0024). An email is saved
// here first, whether it goes now or later, and sent from here: `deliver` takes one that's due,
// works out who it's for, and sends each person their own copy, so nobody sees anyone else's
// address. What starts it is in ./dispatch.ts.

export type OutboxStatus = "scheduled" | "sending" | "sent" | "failed" | "cancelled";

/** One recipient, and whether their copy went. */
export type Delivery = { email: string; name: string; sent: boolean; emailSent?: boolean; inboxSent?: boolean };

export type OutboxEmail = {
  id: string;
  subject: string;
  title: string;
  body: MessageBody;
  audience: Audience;
  audienceLabel: string;
  status: OutboxStatus;
  /** A later time was picked, rather than "Send now". */
  scheduled: boolean;
  sendToEmail: boolean;
  sendToInbox: boolean;
  sendAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  recipientCount: number;
  sentCount: number;
  deliveries: Delivery[];
  error: string | null;
  senderEmail: string;
  senderName: string;
  senderUnit: string;
  senderAffiliation: Reach["affiliation"];
  senderCollege: string | null;
  createdAt: string;
};

const TABLE = "portal_emails";

type Row = Record<string, unknown>;

const toEmail = (row: Row): OutboxEmail => ({
  id: row.id as string,
  subject: row.subject as string,
  title: row.title as string,
  body: row.body as MessageBody,
  audience: toAudience(row.audience),
  audienceLabel: row.audience_label as string,
  status: row.status as OutboxStatus,
  scheduled: row.scheduled as boolean,
  sendToEmail: (row.send_to_email as boolean | undefined) ?? true,
  sendToInbox: (row.send_to_inbox as boolean | undefined) ?? false,
  sendAt: row.send_at as string,
  startedAt: (row.started_at as string | null) ?? null,
  finishedAt: (row.finished_at as string | null) ?? null,
  recipientCount: row.recipient_count as number,
  sentCount: row.sent_count as number,
  deliveries: (row.deliveries as Delivery[] | null) ?? [],
  error: (row.error as string | null) ?? null,
  senderEmail: row.sender_email as string,
  senderName: row.sender_name as string,
  senderUnit: row.sender_unit as string,
  senderAffiliation: row.sender_affiliation as Reach["affiliation"],
  senderCollege: (row.sender_college as string | null) ?? null,
  createdAt: row.created_at as string,
});

/** True when the outbox table isn't there yet: 0024 hasn't been run. */
export const isOutboxMissing = (message: string) => message.includes(TABLE) || message.includes("schema cache");

/** A sending that started this long ago and never finished was cut off: the server stopped partway. */
const STALLED_MS = 30 * 60_000;

export const isStalled = (email: Pick<OutboxEmail, "status" | "startedAt">, now = Date.now()) => email.status === "sending" && email.startedAt !== null && now - Date.parse(email.startedAt) > STALLED_MS;

/** A Local account sees its own college's emails; anyone else sees them all. */
export const canSeeEmail = (viewer: Reach, email: Pick<OutboxEmail, "senderAffiliation" | "senderCollege">) =>
  viewer.affiliation !== "local" || (email.senderAffiliation === "local" && viewer.college !== null && email.senderCollege === viewer.college);

export type NewOutboxEmail = Pick<OutboxEmail, "subject" | "title" | "body" | "audience" | "audienceLabel" | "scheduled" | "sendToEmail" | "sendToInbox" | "sendAt" | "senderEmail" | "senderName" | "senderUnit" | "senderAffiliation" | "senderCollege">;

/** Saves an email to go out at `sendAt`. Returns its id. */
export async function queueEmail(email: NewOutboxEmail) {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .insert({
      subject: email.subject,
      title: email.title,
      body: email.body,
      audience: email.audience,
      audience_label: email.audienceLabel,
      scheduled: email.scheduled,
      send_to_email: email.sendToEmail,
      send_to_inbox: email.sendToInbox,
      send_at: email.sendAt,
      sender_email: email.senderEmail,
      sender_name: email.senderName,
      sender_unit: email.senderUnit,
      sender_affiliation: email.senderAffiliation,
      sender_college: email.senderCollege,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** The latest emails `viewer` may see, newest first. */
export async function listOutbox(viewer: Reach): Promise<OutboxEmail[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient().from(TABLE).select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return data.map(toEmail).filter((email) => canSeeEmail(viewer, email));
}

export async function getOutboxEmail(id: string): Promise<OutboxEmail | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createAdminClient().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toEmail(data) : null;
}

/** Calls off an email that hasn't started sending. False when it already has, or is gone. */
export async function cancelEmail(id: string) {
  const { data, error } = await createAdminClient().from(TABLE).update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", id).eq("status", "scheduled").select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}

/** Brings a scheduled email forward to this moment. False when it's no longer waiting. */
export async function bringForward(id: string) {
  const { data, error } = await createAdminClient().from(TABLE).update({ send_at: new Date().toISOString() }).eq("id", id).eq("status", "scheduled").select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}

/** How many copies are on their way at once. Gmail turns away a flood. */
const LANES = 2;
/** The outbox row is brought up to date this often while sending, so the page can show progress. */
const PROGRESS_EVERY = 5;

/**
 * Sends one email that's due. It's claimed first (scheduled → sending), so when two things start it
 * at once, only one sends. Never throws: whatever goes wrong is written on the row.
 */
export async function deliver(id: string) {
  const client = createAdminClient();
  const { data: claimed, error: claimError } = await client.from(TABLE).update({ status: "sending", started_at: new Date().toISOString(), error: null }).eq("id", id).eq("status", "scheduled").select("*").maybeSingle();
  if (claimError) return console.error("Couldn’t start sending an email:", claimError.message);
  if (!claimed) return;
  const email = toEmail(claimed);

  const save = async (fields: Row) => {
    const { error } = await client.from(TABLE).update(fields).eq("id", id);
    if (error) console.error("Couldn’t update the outbox:", error.message);
  };
  const fail = (reason: string) => save({ status: "failed", error: reason, finished_at: new Date().toISOString() });

  try {
    if (!email.sendToEmail && !email.sendToInbox) return await fail("No delivery channel was selected.");

    const people = (await store.list("accounts")).map(toSummary).filter((account) => account.active);
    const recipients = recipientsOf(email.audience, people, { affiliation: email.senderAffiliation, college: email.senderCollege });
    const inboxRecipients = inboxRecipientsOf(email.audience, people, { affiliation: email.senderAffiliation, college: email.senderCollege });
    if (!recipients.length) return await fail("Nobody matched the recipients when this was due to go out.");
    await save({ recipient_count: recipients.length });

    const sender = { name: email.senderName, email: email.senderEmail, unit: email.senderUnit };
    const html = messageHtml(email, sender);
    const text = messageText(email);
    const problems: string[] = [];
    let inboxSent = false;
    if (email.sendToInbox) {
      try {
        await publishMessage({ kind: "announcement", title: email.subject, body: messageInboxBody(email),
          senderName: `${email.senderName} · ${email.senderUnit}`, audienceLabel: email.audienceLabel,
          senderAffiliation: email.senderAffiliation, senderCollege: email.senderCollege, recipientMention: audienceMention(email.audience),
        }, inboxRecipients.map((person) => person.id));
        inboxSent = true;
      } catch (error) {
        problems.push(error instanceof Error ? error.message : "Portal inbox delivery failed.");
      }
    }
    const emailReady = email.sendToEmail && isEmailConfigured();
    if (email.sendToEmail && !emailReady) problems.push("Email delivery failed: SMTP_USER and SMTP_PASSWORD are missing.");

    const deliveries: Delivery[] = [];
    let next = 0;
    const lane = async () => {
      while (next < recipients.length) {
        const { name, email: address } = recipients[next++];
        const emailSent = emailReady ? await sendEmail({ to: address, subject: email.subject, text, html, replyTo: { name: email.senderName, address: email.senderEmail } }) : false;
        const sent = emailSent || inboxSent;
        deliveries.push({ email: address, name, sent, ...(email.sendToEmail ? { emailSent } : {}), ...(email.sendToInbox ? { inboxSent } : {}) });
        if (deliveries.length % PROGRESS_EVERY === 0) await save({ sent_count: deliveries.filter((delivery) => delivery.sent).length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(LANES, recipients.length) }, lane));

    const sent = deliveries.filter((delivery) => delivery.sent).length;
    const missed = email.sendToEmail ? deliveries.filter((delivery) => !delivery.emailSent).length : 0;
    if (missed && emailReady) problems.push(`${missed} of ${deliveries.length} email copies couldn’t be sent.`);
    await save({
      status: sent ? "sent" : "failed",
      sent_count: sent,
      deliveries: deliveries.sort((a, b) => a.name.localeCompare(b.name)),
      error: problems.length ? problems.join(" ") : null,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Sending an email failed:", message);
    await fail("Something went wrong while sending, and it stopped partway.");
  }
}

/** The scheduled emails whose time has come, oldest first. */
export async function dueEmailIds(limit = 10): Promise<string[]> {
  const { data, error } = await createAdminClient().from(TABLE).select("id").eq("status", "scheduled").lte("send_at", new Date().toISOString()).order("send_at").limit(limit);
  if (error) throw new Error(error.message);
  return data.map((row) => row.id as string);
}
