"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireEditor } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { emailDomainProblem } from "@/lib/forms/email-domain";
import { sendAutomatic } from "@/lib/notifications/notify";
import { canManageEvent } from "./access";
import { isRequestKind, requestDecisionStatus, type RequestKind, type RequestStatus, type CommissionEvent } from "./options";
import { getEvent } from "./queries";
import { acknowledgementOf, validateEditorAnswers, type FormAnswers } from "./form-editor";
import { editedRsvpAnswers, isRsvpReviewStep, rsvpReviewModel, rsvpLogisticalRequests } from "./rsvp-review";
import { isLegacyRsvp, rsvpAcknowledgement, rsvpRespondent, rsvpResponseFacts, type RsvpResponse } from "./rsvp";
import { requestDecisionsEmail } from "./emails";
import { acknowledgementEmail } from "./rsvp-emails";

export type RsvpResponseResult = { saved?: RsvpResponse; removed?: boolean; sent?: boolean; conflict?: RsvpResponse; error?: string; message?: string };
const answerSchema = z.record(z.string().max(80), z.union([z.string().max(4000), z.array(z.string().max(200)).max(30)]));
async function authorized(eventId: string, id: string) {
  const user = await requireEditor("events");
  const event = await getEvent(eventId);
  if (!event || !canManageEvent(user, event)) throw new Error("You don’t have permission to manage RSVPs for this event.");
  const { data, error } = await createAdminClient().from("event_rsvp_responses").select("id,reference_code,answers,created_at,updated_at,logistics_decisions").eq("event_id", eventId).eq("id", id).maybeSingle();
  if (error) throw new Error("Couldn’t load the RSVP. Apply migrations 0081_rsvp_response_edit_guard.sql and 0082_rsvp_logistics_decisions.sql and reload.");
  if (!data) throw new Error("This RSVP no longer exists. Reload the list.");
  return { event, response: data as RsvpResponse };
}
async function receipt(event: CommissionEvent, response: RsvpResponse) {
  const person = rsvpRespondent(response.answers);
  if (!person.email) return false;
  const acknowledgement = isLegacyRsvp(response.answers) ? rsvpAcknowledgement : acknowledgementOf(response.answers.definition) ?? rsvpAcknowledgement;
  return await sendAutomatic("event-rsvp", () => acknowledgementEmail(person.email, { ...acknowledgement, subject: acknowledgement.subject || rsvpAcknowledgement.subject, body: acknowledgement.body || rsvpAcknowledgement.body }, event, person.firstName, "Collaborator RSVP", response.reference_code, rsvpResponseFacts(response.answers))) === "sent";
}

export async function updateRsvpResponse(eventId: string, id: string, stamp: string, incoming: FormAnswers): Promise<RsvpResponseResult> {
  try {
    const { event, response } = await authorized(eventId, id);
    if (!response.updated_at || response.updated_at !== stamp) return { conflict: response, error: "Another officer updated this RSVP. Load the latest response before saving." };
    const parsed = answerSchema.safeParse(incoming);
    if (!parsed.success) return { error: "Check the response fields and try again." };
    const before = rsvpReviewModel(response.answers);
    const proposed = { ...before.values };
    for (const step of before.definition.steps.filter(isRsvpReviewStep)) for (const field of step.fields) proposed[field.id] = parsed.data[field.id] ?? (field.kind === "checkbox" ? [] : "");
    const rawProblem = validateEditorAnswers(before.definition, proposed);
    if (rawProblem) return { error: rawProblem };
    const answers = editedRsvpAnswers(response.answers, parsed.data);
    const model = rsvpReviewModel(answers);
    const problem = validateEditorAnswers(model.definition, model.values);
    if (problem) return { error: problem };
    for (const field of model.definition.steps.flatMap(step => step.fields)) {
      const value = model.values[field.id];
      if (field.verifyUst && value !== undefined && value !== before.values[field.id]) return { error: "A verified UST email cannot be changed here." };
      if (field.kind === "email" && typeof value === "string" && value) {
        const issue = await emailDomainProblem(value);
        if (issue) return { error: `${field.label}: ${issue}` };
      }
    }
    const person = rsvpRespondent(answers);
    const previousRequests = rsvpLogisticalRequests(before.values);
    const logistics_decisions = Object.fromEntries(rsvpLogisticalRequests(model.values).map(request => [request.kind, JSON.stringify(previousRequests.find(previous => previous.kind === request.kind)?.facts) === JSON.stringify(request.facts) ? response.logistics_decisions?.[request.kind] ?? "pending" : "pending"]));
    const changes = { answers, logistics_decisions, email: person.email || `response:${id}` };
    const { data, error } = await createAdminClient().from("event_rsvp_responses").update(changes).eq("event_id", eventId).eq("id", id).eq("updated_at", stamp).select("id,reference_code,answers,created_at,updated_at,logistics_decisions").maybeSingle();
    if (error?.code === "23505") return { error: "This email already has an RSVP submission for this event." };
    if (error) return { error: "Couldn’t update the RSVP. Try again." };
    if (!data) return { conflict: (await authorized(eventId, id)).response, error: "Another officer updated this RSVP. Load the latest response before saving." };
    const saved = data as RsvpResponse;
    revalidatePath(`/portal/events/${eventId}/registrants`);
    const sent = await receipt(event, saved).catch(() => false);
    return { saved, sent, message: sent ? "RSVP updated, and the acknowledgement was sent." : "RSVP updated, but the acknowledgement couldn’t be sent. Check the email settings and try Resend acknowledgement." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t update the RSVP. Try again." };
  }
}

export async function removeRsvpResponse(eventId: string, id: string, stamp: string): Promise<RsvpResponseResult> {
  try {
    const { response } = await authorized(eventId, id);
    if (!response.updated_at || response.updated_at !== stamp) return { conflict: response, error: "Another officer updated this RSVP. Load the latest response before removing it." };
    const { data, error } = await createAdminClient().from("event_rsvp_responses").delete().eq("event_id", eventId).eq("id", id).eq("updated_at", stamp).select("id");
    if (error) return { error: "Couldn’t remove the RSVP. Try again." };
    if (!data?.length) return { conflict: (await authorized(eventId, id)).response, error: "The RSVP changed. Load the latest response before removing it." };
    revalidatePath(`/portal/events/${eventId}/registrants`);
    return { removed: true, message: "RSVP registration removed." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t remove the RSVP. Try again." };
  }
}

export async function resendRsvpAcknowledgement(eventId: string, id: string): Promise<RsvpResponseResult> {
  try {
    const { event, response } = await authorized(eventId, id);
    const email = rsvpRespondent(response.answers).email;
    if (!email) return { error: "This RSVP has no email address. Update the response before resending." };
    const issue = await emailDomainProblem(email);
    if (issue) return { error: issue };
    const sent = await receipt(event, response);
    return { sent, message: sent ? `Acknowledgement sent to ${email}.` : "Couldn’t send the acknowledgement. Check the email settings and try again." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t resend the acknowledgement. Try again." };
  }
}

/** Stage approvals in the modal, then save once and email only the decisions that changed. */
export async function saveRsvpRequestDecisions(eventId: string, id: string, stamp: string, incoming: Partial<Record<RequestKind, boolean>>): Promise<RsvpResponseResult> {
  try {
    const { event, response } = await authorized(eventId, id);
    if (!response.updated_at || response.updated_at !== stamp) return { conflict: response, error: "Another officer updated this RSVP. Load the latest response before saving." };
    const parsed = z.record(z.string(), z.boolean()).safeParse(incoming);
    if (!parsed.success || Object.keys(parsed.data).some(kind => !isRequestKind(kind))) return { error: "Check the logistical decisions and try again." };
    const requests = rsvpLogisticalRequests(rsvpReviewModel(response.answers).values);
    if (Object.keys(parsed.data).some(kind => !requests.some(request => request.kind === kind))) return { error: "Only logistical requests selected in this RSVP can be answered. Reload the response." };
    const decisions: Partial<Record<RequestKind, RequestStatus>> = { ...response.logistics_decisions };
    const changed = requests.filter(request => {
      const approved = parsed.data[request.kind];
      if (approved === undefined) return false;
      const current = decisions[request.kind] ?? "pending";
      const next = requestDecisionStatus(current, approved);
      if (next === current) return false;
      decisions[request.kind] = next;
      return true;
    });
    if (!changed.length) return { saved: response, message: "No logistical decisions changed." };
    const { data, error } = await createAdminClient().from("event_rsvp_responses").update({ logistics_decisions: decisions }).eq("event_id", eventId).eq("id", id).eq("updated_at", stamp).select("id,reference_code,answers,created_at,updated_at,logistics_decisions").maybeSingle();
    if (error) return { error: "Couldn’t save the logistical decisions. Try again." };
    if (!data) return { conflict: (await authorized(eventId, id)).response, error: "Another officer updated this RSVP. Load the latest response before saving." };
    const saved = data as RsvpResponse;
    revalidatePath(`/portal/events/${eventId}/registrants`);
    const person = rsvpRespondent(response.answers);
    const waiting = requests.filter(request => (decisions[request.kind] ?? "pending") === "pending").length;
    const answered = changed.map(request => ({ kind: request.kind, approved: decisions[request.kind] === "approved", revoked: decisions[request.kind] === "revoked", detail: request.facts.map(([, value]) => value).join(" · ") }));
    const sent = !!person.email && await sendAutomatic("event-request", () => requestDecisionsEmail(person, event, answered, waiting)).catch(() => "failed") === "sent";
    return { saved, sent, message: sent ? "Logistical decisions saved, and the RSVP respondent was emailed." : "Logistical decisions saved, but the email wasn’t sent. Check the automatic Logistics email settings." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t save the logistical decisions. Try again." };
  }
}
