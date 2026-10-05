"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { containsEmoji, personNamePattern } from "@/lib/forms/input";
import { requireEditor } from "@/lib/auth/session";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { canManageEvent } from "./access";
import { getEvent, getEventForSite } from "./queries";
import { findEventRegistrationByReference, getRegistration, listRegistrations } from "./registrations";
import { getEvaluationSettings, hasEvaluationResponse } from "./evaluation-store";
import { applyEvaluationRequirements, maxEvaluationQuestions, normalizeName, type EvaluationSettings } from "./evaluation";

import { affiliationDetails, participationDetails, type RegistrationDetailGroup } from "./registration-details";

export type EvaluationState = { error?: string; success?: boolean; alreadySubmitted?: boolean };
export type EvaluationProfileState = { error?: string; alreadySubmitted?: boolean };
const alreadyAnswered = "You’ve already answered this evaluation. Your response has been recorded. Thank you for your feedback.";
const settingsSchema = z.object({ enabled: z.boolean(), allowAnonymous: z.boolean(), questions: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), section: z.union([z.literal(1), z.literal(2), z.literal(3)]), label: z.string().trim().min(1).max(200), prompt: z.string().trim().min(1).max(1000), kind: z.enum(["rating", "text"]), required: z.boolean() })).max(maxEvaluationQuestions) });
async function manager(eventId: string) {
  const user = await requireEditor("events");
  const event = await getEvent(eventId);
  if (!event || !canManageEvent(user, event)) throw new Error("You don’t have permission to manage this event.");
}
function refreshEvent(id: string) {
  revalidatePath(`/portal/events/${id}`, "layout");
  revalidatePath(`/events/${id}/evaluate`);
}
export async function saveEvaluationForm(eventId: string, settings: EvaluationSettings): Promise<EvaluationState> {
  await manager(eventId);
  const parsed = settingsSchema.safeParse(settings);
  if (!parsed.success || new Set(settings.questions.map(q => q.id)).size !== settings.questions.length) return { error: "Check the questions. Labels and prompts are required, with unique question IDs." };
  if (parsed.data.enabled && parsed.data.questions.length === 0) return { error: "Add at least one question before opening the evaluation form." };
  const settingsToSave = applyEvaluationRequirements(parsed.data);
  const { error } = await createAdminClient().from("event_evaluation_forms").upsert({ event_id: eventId, enabled: settingsToSave.enabled, allow_anonymous: settingsToSave.allowAnonymous, questions: settingsToSave.questions, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn’t save the form. Check migration 0031 and try again." };
  refreshEvent(eventId);
  return { success: true };
}

/** Used at Continue and again at submission; no participant details are returned to the browser. */
async function resolveEvaluationProfile(eventId: string, form: FormData): Promise<{ registrationId: string } | { error: string }> {
  const names = ["lastName", "firstName", "middleName"].map(key => normalizeName(String(form.get(key) ?? "")));
  const reference = String(form.get("referenceCode") ?? "").trim().toUpperCase();
  if (names.some(name => name.length > 80)) return { error: "Keep each name under 80 characters." };
  if (names.some(name => name && !personNamePattern.test(name))) return { error: "Use letters and spaces only in names." };
  if (reference && !/^[A-Z0-9]{5}$/.test(reference)) return { error: "Enter the five-character reference code from your confirmation email." };

  if (reference && names.every(name => !name)) {
    const registration = await findEventRegistrationByReference(eventId, reference);
    return registration ? { registrationId: registration.id } : { error: "No confirmed registration for this event matches that reference code. Check your confirmation email and try again." };
  }

  if (names.some(name => !name)) return { error: "Enter your last name, first name, and middle name exactly as they appear on your registration, or use your reference code." };
  const matches = (await listRegistrations(eventId)).filter(registration => registration.status === "registered" && [registration.lastName, registration.firstName, registration.middleName].every((name, index) => normalizeName(name) === names[index]));
  if (!matches.length) return { error: "No confirmed registration matches all three name fields. Check your registration details or use your reference code." };
  const registration = reference ? matches.find(match => match.referenceCode === reference) : matches.length === 1 ? matches[0] : undefined;
  if (!registration) return { error: reference ? "The reference code does not match this name. Check your confirmation email and try again." : "More than one registrant has this name. Enter your reference code to identify your registration." };
  return { registrationId: registration.id };
}

export async function checkEvaluationProfile(eventId: string, form: FormData): Promise<EvaluationProfileState> {
  if (!rateLimit(`event-evaluation-profile:${clientIp(await headers())}`, limits.eventRegister.limit, limits.eventRegister.windowMs).ok) return { error: "Too many checks. Please wait a few minutes and try again." };
  try {
    if (!await getEventForSite(eventId)) return { error: "This event is no longer available." };
    if (!(await getEvaluationSettings(eventId)).enabled) return { error: "This evaluation form is closed." };
    const profile = await resolveEvaluationProfile(eventId, form);
    if ("error" in profile) return profile;
    return { alreadySubmitted: await hasEvaluationResponse(eventId, profile.registrationId) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Couldn’t check your registration. Please try again before continuing." };
  }
}

export async function submitEvaluation(eventId: string, _state: EvaluationState, form: FormData): Promise<EvaluationState> {
  if (!rateLimit(`event-evaluation:${clientIp(await headers())}`, limits.eventRegister.limit, limits.eventRegister.windowMs).ok) return { error: "Too many submissions. Please wait a few minutes and try again." };
  try {
    const event = await getEventForSite(eventId);
    if (!event) return { error: "This event is no longer available." };
    const settings = await getEvaluationSettings(eventId);
    if (!settings.enabled) return { error: "This evaluation form is closed." };
    const anonymous = form.get("anonymous") === "on";
    if (anonymous && !settings.allowAnonymous) return { error: "Anonymous responses are not enabled for this event." };
    const answers: Record<string, string | number> = {};
    for (const question of settings.questions) {
      const value = String(form.get(question.id) ?? "").trim();
      if (containsEmoji(value)) return { error: "Emoji aren’t allowed in evaluation answers." };
      if (question.required && !value) return { error: `Please answer: ${question.label}.` };
      if (!value) continue;
      if (question.kind === "rating") {
        if (!/^[1-5]$/.test(value)) return { error: `Choose a rating from 1 to 5 for ${question.label}.` };
        answers[question.id] = Number(value);
      } else {
        if (value.length > 4000) return { error: "Keep each written answer under 4,000 characters." };
        answers[question.id] = value;
      }
    }
    let registrationId: string | null = null;
    if (!anonymous) {
      const profile = await resolveEvaluationProfile(eventId, form);
      if ("error" in profile) return profile;
      registrationId = profile.registrationId;
      if (await hasEvaluationResponse(eventId, registrationId)) return { error: alreadyAnswered, alreadySubmitted: true };
    }
    const { error } = await createAdminClient().from("event_evaluation_responses").insert({ event_id: eventId, registration_id: registrationId, anonymous, answers, questions: settings.questions });
    if (error?.code === "23505") return { error: alreadyAnswered, alreadySubmitted: true };
    if (error) throw error;
    refreshEvent(eventId);
    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Couldn’t submit the evaluation. Please try again." };
  }
}
export type AttendancePerson = { id: string; referenceCode: string; name: string; studentNumber: string | null; college: string | null; affiliation: RegistrationDetailGroup; participation: RegistrationDetailGroup; confirmedAt: string | null };
export type AttendanceResult = { error?: string; notFound?: boolean; people?: AttendancePerson[] };
export async function lookupAttendance(eventId: string, form: FormData): Promise<AttendanceResult> {
  await manager(eventId);
  const mode = String(form.get("mode"));
  const query = String(form.get("query") ?? "").trim();
  const names = ["lastName", "firstName", "middleName"].map(k => normalizeName(String(form.get(k) ?? "")));
  if (mode === "name" ? !names[0] || !names[1] : !query) return { error: "Enter a reference code, student number, or complete name." };
  if (query.length > 80 || names.some(n => n.length > 80)) return { error: "Keep lookup fields under 80 characters." };
  try {
    const people = (await listRegistrations(eventId)).filter(r => r.status === "registered" && (mode === "name" ? [r.lastName, r.firstName, r.middleName].every((n,i) => normalizeName(n) === names[i]) : mode === "student" ? r.studentNumber === query : r.referenceCode === query.toUpperCase())).map(r => ({ id: r.id, referenceCode: r.referenceCode, name: r.name, studentNumber: r.studentNumber, college: r.college, affiliation: affiliationDetails(r), participation: participationDetails(r), confirmedAt: r.attendanceConfirmedAt }));
    return people.length ? { people } : { notFound: true };
  } catch { return { error: "Couldn’t look up attendance. Please try again." }; }
}
export async function confirmAttendance(eventId: string, registrationId: string): Promise<{ error?: string; confirmedAt?: string }> {
  await manager(eventId);
  const person = await getRegistration(registrationId);
  if (!person || person.eventId !== eventId || person.status !== "registered") return { error: "This person does not have a confirmed registration for this event." };
  if (person.attendanceConfirmedAt) return { confirmedAt: person.attendanceConfirmedAt };
  const time = new Date().toISOString();
  const { error } = await createAdminClient().from("event_registrations").update({ attendance_confirmed_at: time }).eq("event_id", eventId).eq("id", person.id).eq("status", "registered").is("attendance_confirmed_at", null);
  if (error) return { error: "Couldn’t record attendance. Please try again." };
  const updated = await getRegistration(person.id);
  if (!updated?.attendanceConfirmedAt) return { error: "Registration changed. Look up the participant again." };
  refreshEvent(eventId);
  return { confirmedAt: updated.attendanceConfirmedAt };
}
