"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { fromManilaInput } from "@/lib/applications/period";
import { requireEditor, type PortalUser } from "@/lib/auth/session";
import { properName, toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import { accountAffiliations } from "@/lib/data/types";
import { audienceRoles, audienceSchema, describeAudience, fixedUnit, isAudienceUnit, recipientsOf, type Audience } from "@/lib/email/audience";
import { bodyLength, bodySchema, isEmptyBody, messageHtml, messageText, type Body, type Sender } from "@/lib/email/body";
import { bringForward, canSeeEmail, cancelEmail, deliver, getOutboxEmail, isOutboxMissing, queueEmail } from "@/lib/email/outbox";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { comelecUnit } from "@/lib/events/options";
import { publishMessage } from "@/lib/notifications/inbox-store";
import { text, type FormState } from "./form";

// Apps → Email Sender: writing an email to a group of the portal's accounts, and sending it now or
// at a set time. Advisers and Admins, who only read, are refused here whatever the page shows.

const TAB = "apps/email";
const OUTBOX = "/portal/apps/email/outbox";

/** `sent` is the good news to show in place: a test went out. */
export type EmailFormState = (NonNullable<FormState> & { sent?: string }) | undefined;

const MAX_BODY = 20_000;
/** How far ahead an email can be scheduled. */
const MAX_AHEAD_MS = 366 * 24 * 60 * 60_000;

const messageSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject.").max(150, "Keep the subject under 150 characters."),
  title: z.string().trim().max(120, "Keep the title under 120 characters."),
});

/** The sender's unit, as the email names it: "Central Comelec", "College of Science Comelec Unit", "Office for Student Affairs". */
const unitOf = (user: PortalUser) => (user.affiliation === "osa" ? accountAffiliations.osa : comelecUnit(user.affiliation, user.college));

const senderOf = (user: PortalUser): Sender => ({ name: properName(user.name), email: user.email, unit: unitOf(user) });

function json(formData: FormData, name: string): unknown {
  try {
    return JSON.parse(text(formData, name));
  } catch {
    return null;
  }
}

type Content = { subject: string; title: string; body: Body };

/** The subject, title and message the form holds, checked, with the errors to show for what's wrong. */
function readContent(formData: FormData): { content: Content | null; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const parsed = messageSchema.safeParse({ subject: text(formData, "subject"), title: text(formData, "title") });
  if (!parsed.success) for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;

  const body = bodySchema.safeParse(json(formData, "body"));
  if (!body.success) fieldErrors.body = "The message couldn’t be read. Check its links, then try again.";
  else if (isEmptyBody(body.data)) fieldErrors.body = "Write the message.";
  else if (bodyLength(body.data) > MAX_BODY) fieldErrors.body = "The message is too long.";

  return { content: parsed.success && body.success && !fieldErrors.body ? { ...parsed.data, body: body.data } : null, fieldErrors };
}

/** Who it's for, checked. A Local account's audience is held to its own college whatever was sent. Null when it isn't a filter the form offers. */
function readAudience(formData: FormData, user: PortalUser): Audience | null {
  const parsed = audienceSchema.safeParse(json(formData, "audience"));
  if (!parsed.success) return null;
  const locked = fixedUnit(user);
  const audience = { ...parsed.data, units: locked ? [locked] : parsed.data.units };
  const { board, offices } = audienceRoles(audience.groups);
  const allowed = [...board, ...offices];
  return audience.units.every(isAudienceUnit) && audience.roles.every((role) => allowed.includes(role)) ? audience : null;
}

async function countRecipients(audience: Audience, user: PortalUser) {
  const people = (await store.list("accounts")).map(toSummary).filter((account) => account.active);
  return recipientsOf(audience, people, user).length;
}

/** Sends the email to its recipients now, or saves it to go out at the time picked. */
export async function sendMessage(_state: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const user = await requireEditor(TAB);
  const sendToEmail = formData.get("sendToEmail") === "on";
  const sendToInbox = formData.get("sendToInbox") === "on";
  if (!sendToEmail && !sendToInbox) return { error: "Choose at least one delivery option.", fieldErrors: { delivery: "Select email address, portal inbox, or both." } };
  const { content: message, fieldErrors } = readContent(formData);
  const audience = readAudience(formData, user);
  if (!audience) fieldErrors.audience = "Pick who it’s for.";
  if (!message || !audience) return { error: "Check the highlighted fields.", fieldErrors };

  const later = text(formData, "when") === "later";
  let sendAt = new Date().toISOString();
  if (later) {
    const picked = fromManilaInput(text(formData, "sendAt").trim());
    if (!picked) return { error: "Check the highlighted fields.", fieldErrors: { sendAt: "Pick the date and time it goes out." } };
    const ahead = Date.parse(picked) - Date.now();
    if (ahead < 60_000) return { error: "Check the highlighted fields.", fieldErrors: { sendAt: "Pick a time at least a minute from now, or choose Send now." } };
    if (ahead > MAX_AHEAD_MS) return { error: "Check the highlighted fields.", fieldErrors: { sendAt: "Pick a time within a year from now." } };
    sendAt = picked;
  } else if (sendToEmail && !sendToInbox && !isEmailConfigured()) {
    return { error: "Email isn’t set up on the server, so nothing was sent. Set SMTP_USER and SMTP_PASSWORD in .env.local, then send again." };
  }

  let id: string;
  try {
    if (!(await countRecipients(audience, user))) return { error: "Check the highlighted fields.", fieldErrors: { audience: "Nobody matches these filters right now." } };
    id = await queueEmail({
      ...message,
      audience,
      audienceLabel: describeAudience(audience),
      scheduled: later,
      sendToEmail,
      sendToInbox,
      sendAt,
      senderEmail: user.email,
      senderName: properName(user.name),
      senderUnit: unitOf(user),
      senderAffiliation: user.affiliation,
      senderCollege: user.college,
    });
  } catch (error) {
    const problem = error instanceof Error ? error.message : String(error);
    console.error("Couldn’t save the email:", problem);
    if (problem.includes("send_to_email") || problem.includes("send_to_inbox")) return { error: "Run supabase/migrations/0044_email_delivery_channels.sql in the Supabase SQL Editor, then send again." };
    if (isOutboxMissing(problem)) return { error: "The database needs an update first. Run supabase/migrations/0024_email_sender.sql and 0044_email_delivery_channels.sql in the Supabase SQL Editor, then send again." };
    return { error: "Something went wrong, and nothing was sent. Please try again." };
  }

  // After the response: a batch takes a while, and the outbox shows how far it's got.
  if (!later) after(() => deliver(id));
  revalidatePath(OUTBOX);
  redirect(`${OUTBOX}?notice=${later ? "email-scheduled" : "email-sending"}`);
}

/** Sends the email as it stands to the person writing it, and nobody else. */
export async function sendTestMessage(_state: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const user = await requireEditor(TAB);
  const sendToEmail = formData.get("sendToEmail") === "on";
  const sendToInbox = formData.get("sendToInbox") === "on";
  if (!sendToEmail && !sendToInbox) return { error: "Choose at least one delivery option." };
  const { content: message, fieldErrors } = readContent(formData);
  if (!message) return { error: "Check the highlighted fields.", fieldErrors };
  const sender = senderOf(user);
  const delivered: string[] = [];
  const problems: string[] = [];
  if (sendToInbox) {
    try {
      await publishMessage({ kind: "announcement", title: `[Test] ${message.subject}`, body: messageText(message), senderName: sender.name, audienceLabel: "Test · Only you" }, [user.id]);
      delivered.push("your portal inbox");
      revalidatePath("/portal", "layout");
    } catch (error) { problems.push(error instanceof Error ? error.message : "Portal inbox test failed."); }
  }
  if (sendToEmail) {
    const sent = await sendEmail({ to: user.email, subject: `[Test] ${message.subject}`, text: messageText(message), html: messageHtml(message, sender), replyTo: { name: sender.name, address: sender.email } });
    if (sent) delivered.push(user.email);
    else problems.push("The email test didn’t send. Check SMTP_USER and SMTP_PASSWORD in .env.local.");
  }
  const notice = delivered.length ? `Test sent to ${delivered.join(" and ")}.` : "";
  return problems.length ? { error: [notice, ...problems].filter(Boolean).join(" ") } : { sent: notice };
}

/** The signed-in account and the email, if it's theirs to act on. */
async function requireEmail(id: string) {
  const user = await requireEditor(TAB);
  const email = await getOutboxEmail(id);
  if (!email || !canSeeEmail(user, email)) redirect(OUTBOX);
  return email;
}

/** Calls off a scheduled email before it goes. */
export async function cancelScheduledEmail(id: string) {
  await requireEmail(id);
  const cancelled = await cancelEmail(id);
  revalidatePath(OUTBOX);
  redirect(`${OUTBOX}/${id}?notice=${cancelled ? "email-cancelled" : "email-too-late"}`);
}

/** Sends a scheduled email straight away instead of at its time. */
export async function sendScheduledEmailNow(id: string) {
  const email = await requireEmail(id);
  if (email.sendToEmail && !email.sendToInbox && !isEmailConfigured()) redirect(`${OUTBOX}/${id}?notice=email-not-configured`);
  const waiting = await bringForward(id);
  if (waiting) after(() => deliver(id));
  revalidatePath(OUTBOX);
  redirect(`${OUTBOX}/${id}?notice=${waiting ? "email-sending" : "email-too-late"}`);
}
