"use server";
import { readEventPass } from "./verification";
import { acknowledgementOf, identityAnswer, keptAnswers, respondentEmail, validateEditorAnswers } from "./form-editor";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { sendAutomatic } from "@/lib/notifications/notify";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/email/template";
import { canManageEvent } from "./access";
import { getEvent } from "./queries";
import { getRsvpSettings, validRsvpToken } from "./rsvp-store";
import { normalizeRsvpDefinition, rsvpFormPath, committeeLimitSchema, type RsvpAnswers } from "./rsvp";
import { acknowledgementEmail } from "./rsvp-emails";
import { containsEmoji } from "@/lib/forms/input";
import { z } from "zod";
export type RsvpState = { error?: string; success?: boolean; registrationUrl?: string; emailSent?: boolean; name?: string; fieldErrors?: Record<string, string> };

export async function saveRsvpSettings(eventId: string, _state: RsvpState, form: FormData): Promise<RsvpState> {
  const user = await requireEditor("events");
  const event = await getEvent(eventId);
  if (!event || !canManageEvent(user, event)) return { error: "You don’t have permission to manage this event’s RSVP form." };
  const limit = committeeLimitSchema.safeParse(form.get("committeeLimit"));
  if (!limit.success) return { error: "Choose a committee preference limit from 1 to 8." };
  const client = createAdminClient();
  const changes = { enabled: form.get("enabled") === "on", committee_limit: limit.data, updated_at: new Date().toISOString() };
  let error;
  try {
    const existing = await getRsvpSettings(eventId);
    const result = existing
      ? await client.from("event_rsvp_forms").update(changes).eq("event_id", eventId)
      : await client.from("event_rsvp_forms").insert({ event_id: eventId, ...changes });
    error = result.error;
    // Concurrent first saves must keep the original invitation token.
    if (error?.code === "23505") ({ error } = await client.from("event_rsvp_forms").update(changes).eq("event_id", eventId));
  } catch (cause) {
    unstable_rethrow(cause);
    return { error: "Couldn’t save RSVP settings. Apply migrations 0055_event_rsvp.sql and 0056_event_rsvp_committees.sql and try again." };
  }
  if (error) return { error: "Couldn’t save RSVP settings. Apply migrations 0055_event_rsvp.sql and 0056_event_rsvp_committees.sql and try again." };
  revalidatePath(`/portal/events/${eventId}`, "layout");
  revalidatePath(`/portal/events/${eventId}/rsvp`);
  revalidatePath(rsvpFormPath(eventId));
  return { success: true };
}

const answersSchema = z.record(z.string().max(80), z.union([z.string().max(4000), z.array(z.string().max(200)).max(30)]));

/**
 * Saves a collaborator's RSVP. The answers are checked against the form as it's set up (what shows,
 * what's required, each question's rules), questions they weren't shown are dropped, and Email
 * questions that ask for UST Google verification must match the account they verified.
 */
export async function submitRsvp(eventId: string, token: string, _state: RsvpState, form: FormData): Promise<RsvpState> {
  if (form.get("website")) return { success: true };
  if (!rateLimit(`event-rsvp:${clientIp(await headers())}`, limits.eventRegister.limit, limits.eventRegister.windowMs).ok) return { error: "Too many submissions. Please try again shortly." };
  if (!validRsvpToken(token)) return { error: "This collaborator RSVP link is invalid." };
  try {
    const [event, settings] = await Promise.all([getEvent(eventId), getRsvpSettings(eventId)]);
    if (!event || !settings || settings.invitation_token !== token) return { error: "This collaborator RSVP link is invalid." };
    if (!settings.enabled) return { error: "This RSVP form is closed." };
    const raw = form.get("answers");
    if (typeof raw !== "string" || raw.length > 100000) return { error: "Check your answers and try again." };
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return { error: "Check your answers and try again." }; }
    const parsed = answersSchema.safeParse(payload);
    if (!parsed.success) return { error: "Check your answers and try again." };
    const definition = normalizeRsvpDefinition(settings.definition);
    const problem = validateEditorAnswers(definition, parsed.data);
    if (problem) return { error: problem };
    const values = keptAnswers(definition, parsed.data);
    for (const value of Object.values(values)) if ((Array.isArray(value) ? value : [value]).some(containsEmoji)) return { error: "Emoji aren’t allowed in RSVP answers." };

    // UST accounts: a verified Email question always; with the form's Google setting on, any UST address given.
    const emails = definition.steps.flatMap(step => step.fields).filter(field => field.kind === "email" && typeof values[field.id] === "string");
    const needsPass = emails.filter(field => field.verifyUst || (settings.require_google && String(values[field.id]).endsWith("@ust.edu.ph")));
    if (needsPass.length) {
      const pass = await readEventPass(eventId);
      if (!pass || needsPass.some(field => values[field.id] !== pass.email)) return { error: "Verify your UST Google account before submitting. The email must match the verified account." };
    }

    const email = respondentEmail(definition, values);
    const name = identityAnswer(definition, values, "firstName");
    const answers: RsvpAnswers = { version: 2, values, definition };
    // The table keeps one RSVP per email; a form that asks for none can't tell respondents apart.
    const { error } = await createAdminClient().from("event_rsvp_responses").insert({ event_id: eventId, email: email || `response:${crypto.randomUUID()}`, answers });
    if (error?.code === "23505") return { error: "An RSVP has already been submitted with this email. Contact the event organizers to change your response." };
    if (error) return { error: "Couldn’t save your RSVP. Please try again." };
    revalidatePath(`/portal/events/${eventId}/rsvp`);
    const acknowledgement = acknowledgementOf(definition);
    const delivery = acknowledgement?.email && email ? await sendAutomatic("event-rsvp", () => acknowledgementEmail(email, acknowledgement, event, name, "Collaborator RSVP")) : undefined;
    return { success: true, registrationUrl: `${siteUrl()}/events/${eventId}/register`, emailSent: delivery === undefined ? undefined : delivery === "sent", name };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "RSVP is unavailable right now. Please try again later." };
  }
}
