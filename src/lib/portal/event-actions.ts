"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocal, requirePortalUser, type PortalUser } from "@/lib/auth/session";
import { store } from "@/lib/data/store";
import { sendEmail } from "@/lib/email/send";
import { canManageEvent, canRequestChanges } from "@/lib/events/access";
import { changeRequestEmail } from "@/lib/events/emails";
import { registrationStatuses, venueModes, type CommissionEvent, type RegistrationStatus, type VenueMode } from "@/lib/events/options";
import { getEvent, setChangeRequest } from "@/lib/events/queries";
import { deleteRegistration, getRegistration } from "@/lib/events/registrations";
import { text, toFormState, type FormState } from "./form";

// Events, as the portal's Events tab manages them. Each unit manages its own: Central accounts the
// Central Comelec's events, a Local account its own college's (src/lib/events/access.ts). The
// organizer is set from the account that adds the event and never changes.

const time = (message: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, message);
const optionalTime = z.union([z.literal(""), time("Use a time like 1:00 PM.")]);

const eventSchema = z
  .object({
    name: z.string().trim().min(3, "Add the event’s name.").max(140, "Keep the name under 140 characters."),
    summary: z.string().trim().min(10, "Add a short description (at least 10 characters).").max(300, "Keep the short description under 300 characters."),
    background: z.string().trim().max(10000, "The background is too long."),
    eventDate: z.iso.date("Pick the event’s date."),
    ingressTime: optionalTime,
    startsTime: time("Set when the activity starts."),
    endsTime: time("Set when the activity ends."),
    egressTime: optionalTime,
    venueMode: z.enum(Object.keys(venueModes) as [VenueMode, ...VenueMode[]], "Pick on-site or online."),
    venueDetails: z.string().trim().min(2, "Add where it’s held.").max(300, "Keep the venue under 300 characters."),
    openToStudents: z.boolean(),
    openToExternals: z.boolean(),
    openToAdmins: z.boolean(),
    registrationStatus: z.enum(Object.keys(registrationStatuses) as [RegistrationStatus, ...RegistrationStatus[]], "Pick a registration status."),
  })
  .superRefine((value, context) => {
    // "HH:MM" compares correctly as text.
    if (value.startsTime >= value.endsTime) context.addIssue({ code: "custom", path: ["endsTime"], message: "The activity has to end after it starts." });
    if (value.ingressTime && value.ingressTime > value.startsTime) context.addIssue({ code: "custom", path: ["ingressTime"], message: "Ingress can’t be after the activity starts." });
    if (value.egressTime && value.egressTime < value.endsTime) context.addIssue({ code: "custom", path: ["egressTime"], message: "Egress can’t be before the activity ends." });
    if (!value.openToStudents && !value.openToExternals && !value.openToAdmins) context.addIssue({ code: "custom", path: ["participants"], message: "Tick at least one." });
  });

function parse(formData: FormData) {
  return eventSchema.safeParse({
    name: text(formData, "name"),
    summary: text(formData, "summary"),
    background: text(formData, "background"),
    eventDate: text(formData, "eventDate"),
    ingressTime: text(formData, "ingressTime"),
    startsTime: text(formData, "startsTime"),
    endsTime: text(formData, "endsTime"),
    egressTime: text(formData, "egressTime"),
    venueMode: text(formData, "venueMode"),
    venueDetails: text(formData, "venueDetails"),
    openToStudents: formData.get("openToStudents") === "on",
    openToExternals: formData.get("openToExternals") === "on",
    openToAdmins: formData.get("openToAdmins") === "on",
    registrationStatus: text(formData, "registrationStatus"),
  });
}

/** The form's values as the event's fields: an empty optional time is saved as none. */
const toFields = ({ ingressTime, egressTime, ...rest }: z.infer<typeof eventSchema>) => ({ ...rest, ingressTime: ingressTime || null, egressTime: egressTime || null });

/** The unit an account adds events for. Null for a Local account with no college set. */
function unitOf(user: PortalUser): Pick<CommissionEvent, "organizer" | "college"> | null {
  if (!isLocal(user)) return { organizer: "central", college: null };
  return user.college ? { organizer: "local", college: user.college } : null;
}

/** Why saving failed, in words a commissioner can act on. */
function saveError(error: unknown): FormState {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Couldn’t save the event:", message);
  if (message.includes("'public.events'") || message.includes("schema cache")) return { error: "Events aren’t set up in the database yet. Run supabase/migrations/0019_events.sql in the Supabase SQL Editor, then save again." };
  return { error: "Something went wrong saving the event. Please try again." };
}

/** The website's Events page and the event's own page, and the portal's copies. */
function refresh(id: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/portal/events");
  revalidatePath(`/portal/events/${id}`);
}

const notYours = (user: PortalUser): FormState => ({ error: isLocal(user) ? `You can only manage ${user.college ?? "your college"}’s events.` : "Local units manage their own events. You can ask the unit for changes instead." });

export async function createEvent(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePortalUser();
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);
  const unit = unitOf(user);
  if (!unit) return { error: "Your account has no college set, so there’s no unit to add this event for. Ask a Central Comelec executive to set it under Accounts." };

  // The id is made from the name. One named just "New" would take the address of this very page.
  const idHint = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === "new" ? `${parsed.data.name} event` : parsed.data.name;
  let id: string;
  try {
    ({ id } = await store.create("events", { ...toFields(parsed.data), ...unit, createdBy: user.email, changeRequest: null, changeRequestedBy: null, changeRequestedAt: null }, user.email, idHint));
  } catch (error) {
    return saveError(error);
  }
  refresh(id);
  redirect(`/portal/events/${id}?notice=event-created`);
}

export async function updateEvent(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePortalUser();
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
    if (!(await store.update("events", id, { ...toFields(parsed.data), ...cleared }, user.email))) return { error: "This event no longer exists." };
  } catch (error) {
    return saveError(error);
  }
  refresh(id);
  redirect(`/portal/events/${id}?notice=${addressed ? "event-updated-addressed" : "event-updated"}`);
}

/** Deletes the event and, with it, everyone's registration for it. */
export async function deleteEvent(id: string) {
  const user = await requirePortalUser();
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
  const user = await requirePortalUser();
  const parsed = requestSchema.safeParse(text(formData, "request"));
  if (!parsed.success) return { error: "Check the highlighted field.", fieldErrors: { request: parsed.error.issues[0].message } };

  const event = await getEvent(id);
  if (!event) return { error: "This event no longer exists." };
  if (!canRequestChanges(user, event)) return { error: "Only the Central Comelec can ask a Local unit for changes to its event." };
  if (!(await setChangeRequest(id, { text: parsed.data, by: user.email }))) return { error: "This event no longer exists." };

  // The unit's active commissioners, or failing that whoever added the event.
  const unit = (await store.list("accounts")).filter((account) => account.active && account.affiliation === "local" && account.college === event.college).map((account) => account.email);
  const recipients = unit.length ? unit : [event.createdBy].filter((email) => email.includes("@"));
  const sent = recipients.length > 0 && (await sendEmail(changeRequestEmail(recipients, event, parsed.data, user)));

  refresh(id);
  redirect(`/portal/events/${id}?notice=${sent ? "event-changes-requested" : "event-changes-requested-no-email"}`);
}

/** The Central Comelec takes its request back. */
export async function withdrawEventChanges(id: string) {
  const user = await requirePortalUser();
  const event = await getEvent(id);
  if (!event || !canRequestChanges(user, event)) redirect("/portal/events");
  await setChangeRequest(id, null);
  refresh(id);
  redirect(`/portal/events/${id}?notice=event-changes-withdrawn`);
}

/** The unit says it has made the changes it was asked for (or settled them another way). */
export async function markEventChangesAddressed(id: string) {
  const user = await requirePortalUser();
  const event = await getEvent(id);
  if (!event || !canManageEvent(user, event)) redirect("/portal/events");
  await setChangeRequest(id, null);
  refresh(id);
  redirect(`/portal/events/${id}?notice=event-changes-addressed`);
}

/** Removes one person's registration: a duplicate, a mistake, or someone who asked for their details to be deleted. */
export async function removeRegistration(eventId: string, registrationId: string) {
  const user = await requirePortalUser();
  const [event, registration] = await Promise.all([getEvent(eventId), getRegistration(registrationId)]);
  if (!event || !canManageEvent(user, event)) redirect("/portal/events");
  if (registration && registration.eventId === event.id) await deleteRegistration(registration.id);
  revalidatePath(`/portal/events/${eventId}`);
  revalidatePath("/portal/events");
  redirect(`/portal/events/${eventId}?notice=registration-removed#registrants`);
}
