"use server";

import { ensureReferenceData } from "@/lib/reference/store";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { personName, studentNumber } from "@/lib/forms/fields";
import { findAccessRequest } from "@/lib/access-requests/admin";
import { findTrackedApplicationId, pendingSubmissionEditRequest, type SubmissionEditRequest } from "@/lib/applications/edit-requests";
import { parseReferenceCode } from "@/lib/applications/reference";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { requireEditor } from "@/lib/auth/session";
import { findRegistrationByReference, getRegistration } from "./registrations";
import { findRsvpByReference } from "./rsvp-store";
import { editLinkPath, pendingEventEditRequest, type EventEditRequest } from "./edit-requests";
import { sendAutomatic } from "@/lib/notifications/notify";
import { siteUrl } from "@/lib/email/template";
import { emailPattern } from "@/lib/forms/input";
import { editLinkEmail } from "./emails";
import { rsvpRespondent, type RsvpResponse } from "./rsvp";
import { getEvent } from "./queries";
import { canManageEvent } from "./access";

export type EditRequestState = { request?: EventEditRequest | SubmissionEditRequest; error?: string; fieldErrors?: Record<string, string> };
const changes = z.string().trim().min(1, "Describe what you want to change.").max(4000, "Keep your request under 4,000 characters.");

export async function requestResponseEdit(_state: EditRequestState, form: FormData): Promise<EditRequestState> {
  await ensureReferenceData();
  const number = studentNumber().safeParse(String(form.get("identity") ?? "").replace(/\s+/g, ""));
  const surname = personName("Enter the last name you submitted with.").safeParse(form.get("identity"));
  const reference = String(form.get("reference") ?? "").trim().toUpperCase();
  const parsed = parseReferenceCode(reference);
  const registrationCode = /^[A-Z0-9]{5}$/.test(reference);
  const requested = changes.safeParse(form.get("changes"));
  if (!requested.success) return { fieldErrors: { changes: requested.error.issues[0].message } };
  const otherSubmission = parsed?.prefix === "CC" || parsed?.prefix === "PA";
  if ((!surname.success && !(otherSubmission && number.success)) || (!registrationCode && !parsed)) return { error: "Track your submission again before requesting an edit." };
  if (!rateLimit(`event-response-edit:${clientIp(await headers())}`, limits.track.limit, limits.track.windowMs).ok) return { error: "Request Blocked by Security Protection - Unusual Traffic Detected. Please try again shortly." };
  try {
    if (otherSubmission) {
      const identity = number.success ? number.data : surname.data!;
      const kind = parsed!.prefix === "PA" ? "access" : "application";
      const access = kind === "access" ? await findAccessRequest(parsed!.code, identity, number.success) : null;
      const id = kind === "access" ? access?.id : await findTrackedApplicationId(parsed!.code, identity, number.success);
      if (!id) return { error: "We couldn’t match that reference and identity. Track your submission again." };
      const existing = await pendingSubmissionEditRequest(kind, id);
      if (existing) return { request: existing };
      const { data, error } = await createAdminClient().from("submission_edit_requests").insert({ application_id: kind === "application" ? id : null, access_request_id: kind === "access" ? id : null, requested_changes: requested.data }).select("*").single();
      if (error?.code === "23505") {
        const concurrent = await pendingSubmissionEditRequest(kind, id);
        if (concurrent) return { request: concurrent };
      }
      if (error) return { error: "Couldn’t send your edit request. Please try again." };
      revalidatePath(kind === "application" ? "/portal/recruitment/applications" : "/portal/accounts");
      return { request: data as SubmissionEditRequest };
    }
    const registration = registrationCode ? await findRegistrationByReference(reference, surname.data!) : null;
    const rsvp = !registrationCode ? await findRsvpByReference(parsed!.code, surname.data!) : null;
    const record = registration ?? rsvp;
    if (!record) return { error: "We couldn’t match that reference and last name. Track your submission again." };
    const kind = registration ? "registration" : "rsvp";
    const eventId = registration ? registration.eventId : rsvp!.event_id;
    const existing = await pendingEventEditRequest(kind, record.id);
    if (existing) return { request: existing };
    const { data, error } = await createAdminClient().from("event_response_edit_requests").insert({ event_id: eventId, registration_id: registration?.id ?? null, rsvp_response_id: rsvp?.id ?? null, requested_changes: requested.data }).select("*").single();
    if (error?.code === "23505") {
      const concurrent = await pendingEventEditRequest(kind, record.id);
      if (concurrent) return { request: concurrent };
    }
    if (error) return { error: "Couldn’t send your edit request. Please try again." };
    revalidatePath(`/portal/events/${eventId}/responses`);
    return { request: data as EventEditRequest };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Couldn’t send your edit request. Please try again." };
  }
}

export type AddressEditResult = { error?: string; saved?: boolean; email?: "sent" | "failed" | "off" | "none"; to?: string };

/**
 * Accepts or declines a request. Accepting gives the request a private link to the response,
 * prefilled under the same reference, and emails it to the person who submitted; tracking shows it too.
 */
export async function addressResponseEdit(eventId: string, requestId: string, decision: "addressed" | "accepted" | "declined" = "addressed"): Promise<AddressEditResult> {
  const user = await requireEditor("events");
  const event = await getEvent(eventId);
  if (!event || !canManageEvent(user, event)) return { error: "You don’t have permission to address this event’s edit requests." };
  if (!["addressed", "accepted", "declined"].includes(decision)) return { error: "Choose Accept or Decline and try again." };
  try {
    const accepted = decision === "accepted";
    const { data, error } = await createAdminClient().from("event_response_edit_requests")
      .update({ status: decision, addressed_at: new Date().toISOString(), addressed_by: user.email, ...(accepted ? { edit_token: crypto.randomUUID(), edited_at: null } : {}) })
      .eq("event_id", eventId).eq("id", requestId).eq("status", "pending").select("*");
    if (error || !data?.length) return { error: "Couldn’t address this request. Reload the list and try again." };
    revalidatePath(`/portal/events/${eventId}/responses`);
    if (!accepted) return { saved: true };
    const request = data[0] as EventEditRequest;
    const person = await editLinkRecipient(request);
    if (!person) return { saved: true, email: "none" };
    const email = await sendAutomatic("event-edit-link", () => editLinkEmail(person, event, `${siteUrl()}${editLinkPath(request)}`, request.requested_changes));
    return { saved: true, email, to: person.email };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Couldn’t address this request. Try again." };
  }
}

/** Who submitted the response a request is about, and where to email them. Null when there's no address. */
async function editLinkRecipient(request: EventEditRequest) {
  if (request.registration_id) {
    const registration = await getRegistration(request.registration_id);
    return registration?.email ? { email: registration.email, firstName: registration.firstName, referenceCode: registration.referenceCode, form: "registration" as const } : null;
  }
  const { data } = await createAdminClient().from("event_rsvp_responses").select("reference_code,answers").eq("id", request.rsvp_response_id!).maybeSingle();
  if (!data) return null;
  const respondent = rsvpRespondent(data.answers as RsvpResponse["answers"]);
  return respondent.email && emailPattern.test(respondent.email) ? { email: respondent.email, firstName: respondent.firstName, referenceCode: data.reference_code as string, form: "rsvp" as const } : null;
}
