"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocal, requireEditor, type PortalUser } from "@/lib/auth/session";
import { store } from "@/lib/data/store";
import { sendAutomatic } from "@/lib/notifications/notify";
import { canManageEvent, canRequestChanges, unitOfAccount } from "@/lib/events/access";
import { checkDetails, detailFields, readDetails, toDetails } from "@/lib/events/details";
import { changeRequestEmail, registrationEmail, requestDecisionsEmail } from "@/lib/events/emails";
import { formatTime } from "@/lib/events/format";
import { requestDecisionStatus, isRequestKind, registrationStatuses, type DecisionsResult, type RegistrationStatus, type RequestKind } from "@/lib/events/options";
import { getEvent, setChangeRequest } from "@/lib/events/queries";
import { deleteRegistration, getRegistration, setRequestStatuses } from "@/lib/events/registrations";
import { text, toFormState, type FormState } from "./form";

// Events, as the portal's Events tab manages them. Each unit manages its own: Central accounts the
// Central Comelec's events, a Local account its own college's (src/lib/events/access.ts). The
// organizer is set from the account that adds the event and never changes.

const eventSchema = z.object({ ...detailFields, requireGoogle: z.boolean(), registrationStatus: z.enum(Object.keys(registrationStatuses) as [RegistrationStatus, ...RegistrationStatus[]], "Pick a registration status.") }).superRefine(checkDetails);

const parse = (formData: FormData) => eventSchema.safeParse({ ...readDetails(formData), requireGoogle: formData.get("requireGoogle") === "on", registrationStatus: text(formData, "registrationStatus") });

/** Why saving failed, in words a commissioner can act on. */
function saveError(error: unknown): FormState {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Couldn’t save the event:", message);
  if (message.includes("require_google")) return { error: "Events can’t switch Google verification in the database yet. Run supabase/migrations/0029_event_registration_form.sql in the Supabase SQL Editor, then save again." };
  if (message.includes("end_date")) return { error: "Events can’t have an end date in the database yet. Run supabase/migrations/0028_event_end_dates.sql in the Supabase SQL Editor, then save again." };
  if (message.includes("'public.events'") || message.includes("schema cache")) return { error: "Events aren’t set up in the database yet. Run supabase/migrations/0019_events.sql in the Supabase SQL Editor, then save again." };
  return { error: "Something went wrong saving the event. Please try again." };
}

/** The website's Events page and the event's own page, and the portal's copies. */
function refresh(id: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/portal/events");
  revalidatePath(`/portal/events/${id}`);
  revalidatePath(`/portal/events/${id}/registrants`);
  revalidatePath(`/portal/events/${id}/analytics`);
}

const notYours = (user: PortalUser): FormState => ({ error: isLocal(user) ? `You can only manage ${user.college ?? "your college"}’s events.` : "Local units manage their own events. You can ask the unit for changes instead." });

export async function createEvent(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("events");
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);
  const unit = unitOfAccount(user);
  if (!unit) return { error: "Your account has no college set, so there’s no unit to add this event for. Ask the Central Executive Board to set it under Accounts." };

  // The id is made from the name. One named just "New" would take the address of this very page.
  const idHint = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === "new" ? `${parsed.data.name} event` : parsed.data.name;
  let id: string;
  try {
    ({ id } = await store.create("events", { ...toDetails(parsed.data), ...unit, createdBy: user.email, changeRequest: null, changeRequestedBy: null, changeRequestedAt: null }, user.email, idHint));
  } catch (error) {
    return saveError(error);
  }
  refresh(id);
  redirect(`/portal/events/${id}?notice=event-created`);
}

export async function updateEvent(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("events");
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  // Ticked on the form: this edit makes the changes the Central Comelec asked for.
  let addressed = false;
  try {
    const existing = await getEvent(id);
    if (!existing) return { error: "This event no longer exists." };
    if (!canManageEvent(user, existing)) return notYours(user);
    addressed = Boolean(existing.changeRequest) && formData.get("requestAddressed") === "on";
    const cleared = addressed ? { changeRequest: null, changeRequestedBy: null, changeRequestedAt: null } : {};
    if (!(await store.update("events", id, { ...toDetails(parsed.data), ...cleared }, user.email))) return { error: "This event no longer exists." };
  } catch (error) {
    return saveError(error);
  }
  refresh(id);
  redirect(`/portal/events/${id}?notice=${addressed ? "event-updated-addressed" : "event-updated"}`);
}

/** Deletes the event and, with it, everyone's registration for it. */
export async function deleteEvent(id: string) {
  const user = await requireEditor("events");
  const event = await getEvent(id);
  if (event && !canManageEvent(user, event)) redirect(`/portal/events/${id}`);
  await store.remove("events", id);
  refresh(id);
  redirect("/portal/events?notice=event-deleted");
}

const requestSchema = z.string().trim().min(10, "Say what should change (at least 10 characters).").max(1000, "Keep the request under 1,000 characters.");

/**
 * The Central Comelec asks a Local unit to change one of its events. The unit sees the request on
 * the event until it marks it addressed, and its commissioners are emailed; the notice says whether
 * that email went.
 */
export async function requestEventChanges(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("events");
  const parsed = requestSchema.safeParse(text(formData, "request"));
  if (!parsed.success) return { error: "Check the highlighted field.", fieldErrors: { request: parsed.error.issues[0].message } };

  const event = await getEvent(id);
  if (!event) return { error: "This event no longer exists." };
  if (!canRequestChanges(user, event)) return { error: "Only the Central Comelec can ask a Local unit for changes to its event." };
  if (!(await setChangeRequest(id, { text: parsed.data, by: user.email }))) return { error: "This event no longer exists." };

  // The unit's active commissioners, or failing that whoever added the event.
  const unit = (await store.list("accounts")).filter((account) => account.active && account.affiliation === "local" && account.college === event.college).map((account) => account.email);
  const recipients = unit.length ? unit : [event.createdBy].filter((email) => email.includes("@"));
  const sent = recipients.length > 0 && (await sendAutomatic("event-changes", () => changeRequestEmail(recipients, event, parsed.data, user))) === "sent";

  refresh(id);
  redirect(`/portal/events/${id}?notice=${sent ? "event-changes-requested" : "event-changes-requested-no-email"}`);
}

/** The Central Comelec takes its request back. */
export async function withdrawEventChanges(id: string) {
  const user = await requireEditor("events");
  const event = await getEvent(id);
  if (!event || !canRequestChanges(user, event)) redirect("/portal/events");
  await setChangeRequest(id, null);
  refresh(id);
  redirect(`/portal/events/${id}?notice=event-changes-withdrawn`);
}

/** The unit says it has made the changes it was asked for (or settled them another way). */
export async function markEventChangesAddressed(id: string) {
  const user = await requireEditor("events");
  const event = await getEvent(id);
  if (!event || !canManageEvent(user, event)) redirect("/portal/events");
  await setChangeRequest(id, null);
  refresh(id);
  redirect(`/portal/events/${id}?notice=event-changes-addressed`);
}

/** Manually resends the receipt to the saved address, using the current registration status. */
export async function resendAcknowledgement(eventId: string, registrationId: string): Promise<{ sent: boolean; message: string }> {
  const user = await requireEditor("events");
  try {
    const event = await getEvent(eventId);
    if (!event || !canManageEvent(user, event)) return { sent: false, message: "You don’t have permission to resend acknowledgements for this event." };
    const registration = await getRegistration(registrationId);
    if (!registration || registration.eventId !== event.id) return { sent: false, message: "This registration no longer exists for this event. Reload the page." };

    const result = await sendAutomatic(registration.status === "registered" ? "event-registered" : "event-waitlisted", () => registrationEmail(registration, event, registration.status));
    return result === "sent"
      ? { sent: true, message: `Acknowledgement sent to ${registration.email}.` }
      : { sent: false, message: "Couldn’t send the acknowledgement. Check the email configuration and try again." };
  } catch (error) {
    console.error("Couldn’t resend event acknowledgement:", error instanceof Error ? error.message : error);
    return { sent: false, message: "Couldn’t resend the acknowledgement. Please try again." };
  }
}

/** Removes one person's registration: a duplicate, a mistake, or someone who asked for their details to be deleted. */
export async function removeRegistration(eventId: string, registrationId: string) {
  const user = await requireEditor("events");
  const [event, registration] = await Promise.all([getEvent(eventId), getRegistration(registrationId)]);
  if (!event || !canManageEvent(user, event)) redirect("/portal/events");
  if (registration && registration.eventId === event.id) await deleteRegistration(registration.id);
  revalidatePath(`/portal/events/${eventId}`);
  revalidatePath(`/portal/events/${eventId}/registrants`);
  revalidatePath(`/portal/events/${eventId}/analytics`);
  revalidatePath("/portal/events");
  redirect(`/portal/events/${eventId}/registrants?notice=registration-removed`);
}

/**
 * The organizing unit saves its answers to what one registrant asked for under Logistics: each
 * approved, or not available. Only the answers that changed are saved, and the registrant gets one
 * email listing them, unless that email is switched off.
 */
export async function saveRequestDecisions(eventId: string, registrationId: string, decisions: Record<string, boolean>): Promise<DecisionsResult> {
  const user = await requireEditor("events");
  const [event, registration] = await Promise.all([getEvent(eventId), getRegistration(registrationId)]);
  if (!event || !canManageEvent(user, event)) redirect("/portal/events");
  if (!registration || registration.eventId !== event.id) return { error: "This registration isn’t there any more. Reload the page." };

  const changes = Object.entries(decisions)
    .filter((entry): entry is [RequestKind, boolean] => isRequestKind(entry[0]) && typeof entry[1] === "boolean")
    .filter(([kind, approved]) => registration.requests[kind] && registration.requests[kind]!.status !== requestDecisionStatus(registration.requests[kind]!.status, approved));
  if (changes.length === 0) return { saved: 0 };

  try {
    if (!(await setRequestStatuses(registration, Object.fromEntries(changes.map(([kind, approved]) => [kind, requestDecisionStatus(registration.requests[kind]!.status, approved)]))))) return { error: "This registration isn’t there any more. Reload the page." };
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return { error: "Couldn’t save the answers. Try again." };
  }
  revalidatePath(`/portal/events/${eventId}`);
  revalidatePath(`/portal/events/${eventId}/registrants`);
  revalidatePath(`/portal/events/${eventId}/analytics`);

  // Still waiting for an answer once these are saved: the email says the rest will follow.
  const waiting = (Object.keys(registration.requests) as RequestKind[]).filter((kind) => registration.requests[kind]!.status === "pending" && !changes.some(([changed]) => changed === kind)).length;
  const answered = changes.map(([kind, approved]) => {
    const entry = registration.requests[kind]!;
    const detail = kind === "parking" ? [entry.plate, [entry.color, entry.model].filter(Boolean).join(" "), entry.arrival && `arriving ${formatTime(entry.arrival)}`].filter(Boolean).join(" · ") : kind === "dietary" ? (entry.allergens ?? "") : "";
    return { kind, approved, revoked: requestDecisionStatus(entry.status, approved) === "revoked", detail };
  });
  const email = await sendAutomatic("event-request", () => requestDecisionsEmail({ email: registration.email, firstName: registration.firstName }, event, answered, waiting));
  return { saved: changes.length, email, to: registration.email };
}
