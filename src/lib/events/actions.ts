"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { text, type FormState } from "@/lib/portal/form";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { registrationEmail } from "./emails";
import { isEventId, signUpMode, type CommissionEvent, type RegistrationKind } from "./options";
import { getEvent } from "./queries";
import { findRegistration, fullName } from "./registrations";
import { checkRegistration, readRegistration, registrationFields } from "./schema";
import { clearEventPass, readEventPass } from "./verification";

/** What the form shows once a registration is saved. */
export type SavedRegistration = { kind: RegistrationKind; name: string; email: string };

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

/** Saves a registration for the event, or a place on its waitlist while registration hasn't opened. */
export async function submitRegistration(eventId: string, _state: RegistrationState, formData: FormData): Promise<RegistrationState> {
  // Hidden field that people never see. Bots that fill it get a normal-looking success.
  if (text(formData, "website")) return { submitted: true };

  if (!isEventId(eventId) || !isSupabaseConfigured()) return { error: unavailable };

  const limited = rateLimit(`event-register:${clientIp(await headers())}`, limits.eventRegister.limit, limits.eventRegister.windowMs);
  if (!limited.ok) return { error: `Too many registrations from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.` };

  // Only a verified UST account can register, and the email saved is the verified one.
  const pass = await readEventPass(eventId);
  if (!pass) return { error: "Your UST account verification expired. Verify again, then send your registration.", verificationExpired: true };

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

  const values = readRegistration(formData);
  const fieldErrors = checkRegistration(values);
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
  const data = registrationFields.parse(values);

  const kind: RegistrationKind = mode === "register" ? "registered" : "waitlisted";
  const answers = {
    status: kind,
    last_name: data.lastName.toUpperCase(),
    first_name: data.firstName.toUpperCase(),
    middle_initial: data.middleInitial.toUpperCase(),
    student_number: data.studentNumber,
    sex: data.sex,
    college: data.college,
    program: data.program,
    year_level: data.yearLevel,
    organizations: data.organizations,
    interest: Number(data.interest),
    consent: data.consent,
  };

  const alreadyRegistered = { error: "This UST account is already registered for this event. Check your inbox for the confirmation." };
  const alreadyWaitlisted = { error: "This UST account is already on the waitlist. Come back to register once registration opens." };

  try {
    const existing = await findRegistration(event.id, pass.email);
    if (existing?.status === "registered") return alreadyRegistered;
    if (existing && kind === "waitlisted") return alreadyWaitlisted;

    const table = createAdminClient().from("event_registrations");
    // Someone from the waitlist registering now that it's open keeps their entry, with these answers.
    const { error } = existing
      ? await table.update({ ...answers, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await table.insert({ ...answers, event_id: event.id, email: pass.email });
    // The same account sent the form twice at once; the first one saved it.
    if (error?.code === "23505") return kind === "registered" ? alreadyRegistered : alreadyWaitlisted;
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("Couldn’t save event registration:", error instanceof Error ? error.message : error);
    return { error: failed };
  }

  // One registration per verification.
  await clearEventPass();

  // After the response, so a slow or failing mail server never holds up the student.
  const registrant = { email: pass.email, firstName: answers.first_name };
  after(() => sendEmail(registrationEmail(registrant, event, kind)));

  return { submitted: true, result: { kind, name: fullName(answers.first_name, answers.middle_initial, answers.last_name), email: pass.email } };
}
