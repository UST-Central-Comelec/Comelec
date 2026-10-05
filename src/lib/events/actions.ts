"use server";

import { headers } from "next/headers";
import { sendAutomatic } from "@/lib/notifications/notify";
import { text, type FormState } from "@/lib/portal/form";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { registrationEmail } from "./emails";
import { allowedAffiliations, isEventId, signUpMode, type AffiliationChoice, type CommissionEvent, type RegistrationKind } from "./options";
import { getEvent } from "./queries";
import { findRegistration, fullName } from "./registrations";
import { checkRegistration, needsVerification, readRegistration, toRequests } from "./schema";
import { clearEventPass, readEventPass } from "./verification";

/** What the form shows once a registration is saved. */
export type SavedRegistration = { referenceCode: string; kind: RegistrationKind; name: string; email: string; acknowledgement: "sent" | "failed" };

/**
 * `verificationExpired` sends the student back through Google; `closed` means the event stopped
 * taking sign-ups while the form was open, so there's nothing left to send.
 */
export type RegistrationState = (FormState & { submitted?: boolean; result?: SavedRegistration; verificationExpired?: boolean; closed?: boolean }) | undefined;

const unavailable = "Registration isn’t available right now. Please email comelec@ust.edu.ph.";
const failed = "Something went wrong saving your registration. Please try again, or email comelec@ust.edu.ph.";

/** Why an event isn't taking sign-ups, for someone who had its form open. */
function closedMessage(event: CommissionEvent) {
  if (event.registrationStatus === "cancelled") return "This event was cancelled, so your registration wasn’t sent.";
  if (event.registrationStatus === "rescheduled") return "This event was rescheduled and sign-ups are paused, so your registration wasn’t sent. Check its page for the new date.";
  return "Registration for this event is closed, so yours wasn’t sent.";
}

/**
 * Saves a registration for the event, or a place on its waitlist while registration hasn't opened.
 * At an event that requires it, a UST student or staff member registers under the UST account they
 * verified (the pass from Google sign-in); everyone else under the email they typed.
 */
export async function submitRegistration(eventId: string, _state: RegistrationState, formData: FormData): Promise<RegistrationState> {
  // Hidden field that people never see. Bots that fill it get a normal-looking success.
  if (text(formData, "website")) return { submitted: true };

  if (!isEventId(eventId) || !isSupabaseConfigured()) return { error: unavailable };

  const limited = rateLimit(`event-register:${clientIp(await headers())}`, limits.eventRegister.limit, limits.eventRegister.windowMs);
  if (!limited.ok) return { error: `Too many registrations from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.` };

  // Fresh, not the page's copy: sign-ups may have closed while the form was open.
  let event: CommissionEvent | null;
  try {
    event = await getEvent(eventId);
  } catch (error) {
    console.error(error);
    return { error: failed };
  }
  if (!event) return { error: "This event is no longer listed, so your registration wasn’t sent.", closed: true };
  const mode = signUpMode(event);
  if (!mode) return { error: closedMessage(event), closed: true };

  const pass = await readEventPass(eventId);
  const values = readRegistration(formData);
  const context = { allowed: allowedAffiliations(), requireGoogle: event.requireGoogle, verifiedEmail: pass?.email ?? null };
  const fieldErrors = checkRegistration(values, context);
  if (fieldErrors.verification) return { error: "Your UST account verification expired. Verify again, then send your registration.", fieldErrors, verificationExpired: true };
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  // A verified UST email is the one kept, whatever was typed.
  const verifiedHere = Boolean(pass && needsVerification(values, context));
  const email = verifiedHere ? pass!.email : values.email.trim().toLowerCase();
  const verified = Boolean(pass && pass.email === email);
  const affiliation = values.affiliation as AffiliationChoice;
  const representative = values.attendingAs === "representative";
  const middleName = values.middleName.trim().toUpperCase();

  const kind: RegistrationKind = mode === "register" ? "registered" : "waitlisted";
  const answers = {
    status: kind,
    last_name: values.lastName.trim().toUpperCase(),
    first_name: values.firstName.trim().toUpperCase(),
    middle_name: middleName,
    middle_initial: middleName.charAt(0),
    sex: values.sex,
    age: Number(values.age),
    affiliation,
    college: affiliation === "ust-student" ? values.college : null,
    program: affiliation === "ust-student" ? values.program : null,
    student_number: affiliation === "ust-student" ? values.studentNumber.trim() || null : null,
    year_level: affiliation === "ust-student" ? values.yearLevel : null,
    office: affiliation === "ust-staff" ? values.office.trim() : null,
    institution: affiliation === "other-institution" || affiliation === "independent" ? values.institution.trim() || null : null,
    attending_as: values.attendingAs,
    organization_name: representative ? values.organizationName.trim() : null,
    organization_committee: representative ? values.organizationCommittee.trim() || null : null,
    organization_position: representative ? values.organizationPosition.trim() : null,
    requests: toRequests(values),
    verified,
    consent: values.consent,
  };

  const alreadyRegistered = { error: "This email is already registered for this event. Check your inbox for the confirmation." };
  const alreadyWaitlisted = { error: "This email is already on the waitlist. Come back to register once registration opens." };

  let referenceCode: string;
  try {
    const existing = await findRegistration(event.id, email);
    if (existing?.status === "registered") return alreadyRegistered;
    if (existing && kind === "waitlisted") return alreadyWaitlisted;
    // A place on the waitlist held by a verified UST account is only that account's to take up.
    if (existing?.verified && !verified) return { error: "This email joined the waitlist with a verified UST account. Register as a UST student or staff member, and verify that account, to take up the place." };

    const table = createAdminClient().from("event_registrations");
    // Someone from the waitlist registering now that it's open keeps their entry, with these answers.
    const { data: saved, error } = existing
      ? await table.update({ ...answers, updated_at: new Date().toISOString() }).eq("id", existing.id).select("reference_code").single()
      : await table.insert({ ...answers, event_id: event.id, email }).select("reference_code").single();
    // The same email sent the form twice at once; the first one saved it.
    if (error?.code === "23505") return kind === "registered" ? alreadyRegistered : alreadyWaitlisted;
    if (error?.message.includes("column")) throw new Error(`${error.message} (run supabase/migrations/0029_event_registration_form.sql and 0030_event_registration_references.sql)`);
    if (error) throw new Error(error.message);
    referenceCode = saved!.reference_code;
  } catch (error) {
    console.error("Couldn’t save event registration:", error instanceof Error ? error.message : error);
    return { error: failed };
  }

  // Attempt the mandatory acknowledgement before reporting success, and report failures honestly.
  const registrant = { email, firstName: answers.first_name, referenceCode };
  const delivery = await sendAutomatic(kind === "registered" ? "event-registered" : "event-waitlisted", () => registrationEmail(registrant, event, kind));

  // A cookie cleanup failure must not hide a registration already saved and acknowledged.
  if (pass) {
    try {
      await clearEventPass();
    } catch (error) {
      console.error("Couldn’t clear event verification:", error);
    }
  }

  return { submitted: true, result: { referenceCode, kind, name: fullName(answers.first_name, middleName, answers.last_name), email, acknowledgement: delivery === "sent" ? "sent" : "failed" } };
}
