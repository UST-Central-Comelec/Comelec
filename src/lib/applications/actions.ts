"use server";

import { ensureReferenceData } from "@/lib/reference/store";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { personNamePattern } from "@/lib/forms/input";
import { after } from "next/server";
import { getEvent } from "@/lib/events/queries";
import { pendingSubmissionEditRequest, type SubmissionEditRequest } from "./edit-requests";
import { editLinkPath, hasOpenEditLink, openEventEditRequest, type EventEditRequest } from "@/lib/events/edit-requests";
import { findRsvpByReference } from "@/lib/events/rsvp-store";
import { isLegacyRsvp, rsvpRespondent } from "@/lib/events/rsvp";
import { findRegistrationByReference } from "@/lib/events/registrations";
import { formatEventDates } from "@/lib/events/format";
import { requestKinds, requestStatuses, type RegistrationKind } from "@/lib/events/options";
import { findAccessRequest, type AccessRequestStatus } from "@/lib/access-requests/admin";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { concernOf } from "@/lib/notifications/concern";
import { emailUnit } from "@/lib/notifications/notify";
import { text, type FormState } from "@/lib/portal/form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listUnitPeriods } from "@/lib/periods/store";
import { openBodies } from "@/lib/periods/summary";
import { createAdminClient } from "@/lib/supabase/server";
import { describeAnswers, interviewLater, type AnswerSection } from "./answers";
import { clearApplyPageCache } from "./apply-cache";
import { applicationNoticeEmail, confirmationEmail, offerDeclinedEmail } from "./emails";
import { isOfferResponse, offerStateOf, type OfferState } from "./offer";
import { declineOffer } from "./offer-store";
import { joinCommissionUrl } from "./onboarding";
import { sendApplicationEmail } from "./email-log";
import { describeSlot, type InterviewMode } from "./interview-format";
import { applicantName, isMiddleNameColumnMissing } from "./name";
import { getOpenSlots } from "./interviews";
import { currentPositionLabel, positionsForUnit, preferredBodies, retentionCutoff, yearLevels } from "./options";
import { newReferenceCode, parseReferenceCode } from "./reference";
import { applicationFields, checkFields, closedBodyError, declaredConflicts, readApplication, type ApplicationField } from "./schema";
import { getSlots } from "./slots";
import { existingCommissionAccount, hasUnitAccount } from "./account-eligibility";
import { getCommissionAccounts } from "./account-lookup";
import { clearPass, readPass } from "./verification";

/** What the Receipt step shows once an application is saved. */
export type SubmittedApplication = { referenceCode: string; name: string; division: string; position: string; interview: string | null; submittedAt: string; answers: AnswerSection[] };

export type ApplicationState = (FormState & { submitted?: boolean; result?: SubmittedApplication; verificationExpired?: boolean }) | undefined;

const closedMessage = "Applications are closed, so this application wasn’t submitted. Watch the commission’s announcements for the next recruitment period.";

const allFields = Object.keys(applicationFields.shape) as ApplicationField[];

type TrackedApplicationRow = {
  id: string;
  reference_code: string;
  first_name: string;
  middle_name?: string | null;
  middle_initial: string;
  last_name: string;
  status: string;
  created_at: string;
  preferred_body: string;
  division: string;
  position: string;
  position_id: string | null;
  college: string;
  program: string;
  year_level: string;
  interview_slots: unknown;
  email: string;
  student_number: string;
  offer_response?: string | null;
  offer_expires_at?: string | null;
  offer_responded_at?: string | null;
};

export async function submitApplication(_state: ApplicationState, formData: FormData): Promise<ApplicationState> {
  await ensureReferenceData();
  // Hidden field that people never see. Bots that fill it get a normal-looking success.
  if (text(formData, "website")) return { submitted: true };

  if (!isSupabaseConfigured()) return { error: "Applications aren’t being accepted online right now. Please email comelec@ust.edu.ph." };

  const limited = rateLimit(`apply:${clientIp(await headers())}`, limits.apply.limit, limits.apply.windowMs);
  if (!limited.ok) return { error: `Too many submissions from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.` };

  // Fresh, not the Apply page's cache: a unit may have closed while the form was open. If the
  // settings can't be read, the database check on insert still has the final say.
  const bodies = await listUnitPeriods("recruitment").then((periods) => openBodies(periods), () => null);
  if (bodies && !bodies.central && !bodies.colleges.length) return { error: closedMessage };

  // Only a verified UST account can apply, and the email saved is the verified one, whatever the form says.
  const pass = await readPass();
  if (!pass) {
    return { error: "Your UST account verification expired. Verify again on step 1, then submit.", fieldErrors: { consent: "Verify with your UST Google account again." }, verificationExpired: true };
  }

  const values = { ...readApplication(formData), email: pass.email };
  try {
    const accountError = existingCommissionAccount(await getCommissionAccounts(pass.email), values.preferredBody, values.college);
    if (accountError) return { error: "Check the highlighted fields.", fieldErrors: { preferredBody: accountError } };
  } catch (lookupError) {
    console.error("Couldn’t check commission accounts:", lookupError);
    return { error: "We couldn’t check your commission accounts. Please try again." };
  }
  const [positionSlots, openInterviews] = await Promise.all([getSlots(values.preferredBody === "local" ? values.college : ""), getOpenSlots().catch(() => [])]);
  // Only the selected unit's interview times count.
  const unitInterviews = openInterviews.filter((slot) => (slot.college ?? "") === (values.preferredBody === "local" ? values.college : ""));
  // Every unit recruits on its own: the one this application is for has to be taking them.
  const fieldErrors = checkFields(values, allFields, positionSlots, unitInterviews.map((slot) => slot.id), bodies ?? undefined);
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
  const interview = unitInterviews.find((slot) => slot.id === values.interviewSlot);
  const interviewText = interview ? describeSlot(interview) : null;

  const data = applicationFields.parse(values);
  const position = positionsForUnit(data.preferredBody === "local" ? data.college : "").find((position) => position.id === data.position)!;
  const facebookUrl = /^https?:\/\//i.test(data.facebookUrl) ? data.facebookUrl : `https://${data.facebookUrl}`;

  const row = {
    last_name: data.lastName.toUpperCase(),
    first_name: data.firstName.toUpperCase(),
    middle_name: data.middleName.toUpperCase(),
    middle_initial: Array.from(data.middleName.toUpperCase())[0],
    student_number: data.studentNumber,
    contact_number: data.contactNumber.replace(/[\s-]/g, "") || null,
    email: data.email,
    facebook_url: facebookUrl,
    college: data.college,
    program: data.program,
    year_level: data.yearLevel,
    preferred_body: data.preferredBody,
    division: "",
    position: position.label,
    position_id: data.position,
    cv_url: data.cvUrl,
    registration_form_url: data.registrationFormUrl,
    letter_of_intent_url: data.letterOfIntentUrl,
    endorsement_url: data.endorsementUrl || null,
    portfolio_url: data.portfolioUrl || null,
    grades_url: data.gradesUrl || null,
    consent: data.consent,
    // Only the conflicts answered "yes"; an empty list means none. Submitting one means pledging to resolve it.
    conflicts: declaredConflicts(values),
    interview_slot_id: interview?.id ?? null,
  };

  // A new code on the rare chance one is already taken; any other duplicate is the same email this year.
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceCode = newReferenceCode();
    const { data: saved, error } = await createAdminClient().from("applications").insert({ ...row, reference_code: referenceCode }).select("id, created_at").single();

    if (error?.code === "23505" && error.message.includes("reference_code")) continue;
    // The database's own check of the same thing, for a unit that closed in the moment between.
    if (error?.message.includes("applications_closed")) return { error: "Check the highlighted fields.", fieldErrors: { preferredBody: closedBodyError(values.preferredBody, values.college) } };
    // Someone else took the slot's last place between the check above and this insert.
    if (error?.message.includes("interview_slot_full")) {
      return { error: "Check the highlighted fields.", fieldErrors: { interviewSlot: "That time just filled up. Pick another." } };
    }
    // The database's check of a declined or lapsed offer's 60-day wait (0088).
    if (error?.message.includes("application_hold")) {
      return { error: "Check the highlighted fields.", fieldErrors: { preferredBody: "You declined this unit’s offer, or let it lapse, less than 60 days ago. Contact the commission to be considered sooner." } };
    }
    if (error?.message.includes("commission_account_exists")) {
      return { error: "Check the highlighted fields.", fieldErrors: { preferredBody: values.preferredBody === "central" ? "You already have a Central Commission Account." : `You already have a Local Commission Account in ${values.college}.` } };
    }
    if (error?.code === "23505") {
      return { error: "We already have an application from this email for this Comelec unit and election year.", fieldErrors: { email: "This email has already applied to this Comelec unit this year." } };
    }
    if (error) {
      console.error("Couldn’t save application:", error.message);
      return { error: "Something went wrong saving your application. Please try again, or email comelec@ust.edu.ph." };
    }

    // One application per verification. Its interview booking changes the open slots.
    await clearPass();
    clearApplyPageCache();

    const submittedAt = saved.created_at as string;
    const answers = describeAnswers({ ...values, facebookUrl }, interview ?? interviewLater);

    // The receipt, after the response, so a slow or failing mail server never holds up the applicant.
    // It's the Central Comelec's application or their college's Local Comelec's, by where they asked to serve.
    const applicant = { email: row.email, firstName: row.first_name, referenceCode, position: row.position, division: row.division, concern: concernOf(row.preferred_body, row.college) };
    const name = applicantName(row);
    after(() => sendApplicationEmail(saved.id as string, "acknowledgement", () => confirmationEmail(applicant, { interview: interview ?? null, answers: answers.filter((section) => section.id !== "interview"), submittedAt })));
    // The unit it's for is told too, where that's switched on under Email Sender → Automatic: its official account and its Executive Board.
    after(() => emailUnit("application-notice", applicant.concern, (to) => applicationNoticeEmail(to, { ...applicant, id: saved.id as string, name, college: row.college, program: row.program }, interview ?? null)));

    return {
      submitted: true,
      result: {
        referenceCode,
        name,
        division: row.division,
        position: row.position,
        interview: interviewText,
        submittedAt,
        answers,
      },
    };
  }

  console.error("Couldn’t save application: no free reference code after 3 tries.");
  return { error: "Something went wrong saving your application. Please try again, or email comelec@ust.edu.ph." };
}

/** The booked slot, as embedded by Supabase through interview_slot_id, in words. */
function interviewOf(slot: unknown) {
  const row = (Array.isArray(slot) ? slot[0] : slot) as { starts_at: string; duration_minutes: number; mode: InterviewMode; location: string | null } | null | undefined;
  return row ? describeSlot({ startsAt: row.starts_at, durationMinutes: row.duration_minutes, mode: row.mode, location: row.location }) : null;
}

export type ApplicationStatus = "pending" | "reviewing" | "accepted" | "declined";

/** What an applicant sees when they track their application. Contact details and links stay private. */
export type TrackedApplication = {
  editRequest?: SubmissionEditRequest | null;
  referenceCode: string;
  name: string;
  status: ApplicationStatus;
  submittedAt: string;
  preferredBody: string;
  division: string;
  position: string;
  college: string;
  program: string;
  yearLevel: string;
  interview: string | null;
  /** The acceptance offer: open until `expiresAt` (none for acceptances sent before offers had a deadline), or how it was answered. */
  offer: TrackedOffer;
};

export type TrackedOffer = { state: OfferState; expiresAt: string | null; respondedAt: string | null; joinUrl: string | null };

/** A portal access request (PA- code), as its requester sees it when tracking. */
export type TrackedAccessRequest = {
  editRequest?: SubmissionEditRequest | null;
  referenceCode: string;
  name: string;
  email: string;
  status: AccessRequestStatus;
  submittedAt: string;
  role: string;
  college: string;
  program: string;
  yearLevel: string;
};

/** `entered` is what the applicant typed, so a failed lookup doesn't clear the form. */
export type TrackedRegistration = {
  editRequest?: EventEditRequest | null;
  /** The edit link, once the organizers accept an edit request, until it's used. */
  editUrl?: string | null;
  referenceCode: string;
  name: string;
  status: RegistrationKind;
  submittedAt: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  requests: Array<{ label: string; status: string }>;
};

export type TrackedRsvp = {
  editRequest?: EventEditRequest | null;
  /** The edit link, once the organizers accept an edit request, until it's used. */
  editUrl?: string | null;
  referenceCode: string; name: string; submittedAt: string;
  eventId: string; eventName: string; eventDate: string;
  requests: string[];
};
export type TrackState = { lookupStamp?: string; rsvp?: TrackedRsvp; registration?: TrackedRegistration; error?: string; fieldErrors?: Record<string, string>; application?: TrackedApplication; accessRequest?: TrackedAccessRequest; entered?: { reference: string; identity: string } } | undefined;

/** A tracked response's open edit request, with its edit link once accepted. The token stays out of the request itself. */
function trackedEdit(request: EventEditRequest | null) {
  if (!request) return { editRequest: null, editUrl: null };
  return { editRequest: { ...request, edit_token: null }, editUrl: hasOpenEditLink(request) ? editLinkPath(request) : null };
}

export async function trackApplication(_state: TrackState, formData: FormData): Promise<TrackState> {
  const entered = { reference: text(formData, "reference").toUpperCase(), identity: text(formData, "identity").toUpperCase() };
  const registrationCode = /^[A-Z0-9]{5}$/.test(entered.reference.trim()) ? entered.reference.trim() : null;
  const parsed = parseReferenceCode(entered.reference);
  const identity = entered.identity.trim().replace(/\s+/g, " ");
  const studentNumber = identity.replace(/\s+/g, "");
  const isStudentNumber = /^\d{10}$/.test(studentNumber);
  const isLastName = identity.length > 0 && identity.length <= 80 && personNamePattern.test(identity);
  const fieldErrors: Record<string, string> = {};
  if (!parsed && !registrationCode) fieldErrors.reference = "Use your registration code, RS- RSVP code, CC- application code, or PA- access request code.";
  const needsSurname = Boolean(registrationCode || parsed?.prefix === "RS");
  if (needsSurname ? !isLastName : !isStudentNumber && !isLastName) fieldErrors.identity = needsSurname ? "Enter the last name you registered with." : "Enter your 10-digit student number or last name.";
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors, entered };
  const referenceCode = registrationCode ?? parsed!.code;
  // Escape SQL pattern characters so surnames are matched exactly.
  const lastNamePattern = identity.replace(/[\\%_]/g, "\\$&");

  // Also what makes guessing reference codes impractical.
  const limited = rateLimit(`track:${clientIp(await headers())}`, limits.track.limit, limits.track.windowMs);
  if (!limited.ok) return { error: `Too many lookups from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.`, entered };

  if (!isSupabaseConfigured()) return { error: "Tracking isn’t available right now. Please email comelec@ust.edu.ph.", entered };

  if (registrationCode) {
    try {
      const registration = await findRegistrationByReference(registrationCode, lastNamePattern);
      const event = registration ? await getEvent(registration.eventId) : null;
      if (!registration || !event) return { error: "We couldn’t find a registration with that reference code and last name. Check both and try again.", entered };
      return { entered, lookupStamp: crypto.randomUUID(), registration: {
        ...trackedEdit(await openEventEditRequest("registration", registration.id).catch(() => null)),
        referenceCode: registration.referenceCode,
        name: registration.name,
        status: registration.status,
        submittedAt: registration.registeredAt,
        eventId: event.id,
        eventName: event.name,
        eventDate: formatEventDates(event),
        requests: (Object.keys(requestKinds) as Array<keyof typeof requestKinds>).map((kind) => ({
          label: requestKinds[kind].short,
          status: registration.requests[kind] ? requestStatuses[registration.requests[kind]!.status] : "Not requested",
        })),
      } };
    } catch (error) {
      console.error("Couldn’t track registration:", error);
      return { error: "Something went wrong looking up your registration. Please try again.", entered };
    }
  }

  if (parsed!.prefix === "RS") {
    try {
      const response = await findRsvpByReference(referenceCode, identity);
      const event = response ? await getEvent(response.event_id) : null;
      if (!response || !event) return { error: "We couldn’t find an RSVP with that reference code and last name. Check both and try again.", entered };
      const person = rsvpRespondent(response.answers);
      const requests = isLegacyRsvp(response.answers)
        ? (response.answers.logisticalNeeds?.requests ?? []).map(kind => requestKinds[kind].short)
        : Array.isArray(response.answers.values.rsvp_logistics) ? response.answers.values.rsvp_logistics : [];
      return { entered, lookupStamp: crypto.randomUUID(), rsvp: {
        ...trackedEdit(await openEventEditRequest("rsvp", response.id).catch(() => null)),
        referenceCode: response.reference_code, name: person.name, submittedAt: response.created_at,
        eventId: event.id, eventName: event.name, eventDate: formatEventDates(event), requests,
      } };
    } catch (error) {
      console.error("Couldn’t track RSVP:", error);
      return { error: "Something went wrong looking up your RSVP. Please try again.", entered };
    }
  }

  if (parsed!.prefix === "PA") {
    const request = await findAccessRequest(referenceCode, isStudentNumber ? studentNumber : identity, isStudentNumber).catch((lookupError: Error) => {
      console.error("Couldn’t look up access request:", lookupError.message);
      return undefined;
    });
    if (request === undefined) return { error: "Something went wrong looking up your request. Please try again.", entered };
    if (!request) return { error: "We couldn’t find a request with that reference code and student number or last name. Check both and try again.", entered };
    const { referenceCode: code, name, email, status, submittedAt, role, college, program, yearLevel } = request;
    return { entered, lookupStamp: crypto.randomUUID(), accessRequest: { editRequest: await pendingSubmissionEditRequest("access", request.id).catch(() => null), referenceCode: code, name, email, status, submittedAt, role, college, program, yearLevel } };
  }

  try {
    const data = await findTrackedApplication(referenceCode, isStudentNumber ? studentNumber : lastNamePattern, isStudentNumber);
    // Same message either way, so the form doesn't reveal which half was wrong.
    if (!data) return { error: "We couldn’t find an application with that reference code and student number or last name. Check both and try again.", entered };
    return { entered, lookupStamp: crypto.randomUUID(), application: await toTrackedApplication(data) };
  } catch (error) {
    console.error("Couldn’t look up application:", error instanceof Error ? error.message : error);
    return { error: "Something went wrong looking up your application. Please try again.", entered };
  }
}

/** A CC- application by its reference code and student number or last name (`identity`, escaped for ilike), within its 60 days. */
async function findTrackedApplication(referenceCode: string, identity: string, isStudentNumber: boolean) {
  // The position is shown as its unit's office is called now (Administrative → Database).
  await ensureReferenceData();
  const read = (withMiddleName: boolean, withOffer: boolean) => {
    const columns = `id, reference_code, first_name, middle_initial, last_name, email, student_number, status, created_at, preferred_body, division, position, position_id, college, program, year_level, ${withOffer ? "offer_response, offer_expires_at, offer_responded_at, " : ""}interview_slots(starts_at, duration_minutes, mode, location)`;
    const query = createAdminClient()
      .from("applications")
      .select<string>(withMiddleName ? `middle_name, ${columns}` : columns)
      .eq("reference_code", referenceCode)
      .gte("created_at", retentionCutoff());
    return (isStudentNumber ? query.eq("student_number", identity) : query.ilike("last_name", identity)).maybeSingle().overrideTypes<TrackedApplicationRow | null, { merge: false }>();
  };
  let withMiddleName = true;
  let withOffer = true;
  let result = await read(withMiddleName, withOffer);
  // Before migrations 0033 and 0088.
  for (let attempt = 0; attempt < 2 && result.error; attempt++) {
    if (isMiddleNameColumnMissing(result.error)) withMiddleName = false;
    else if (result.error.message.includes("offer_")) withOffer = false;
    else break;
    result = await read(withMiddleName, withOffer);
  }
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function toTrackedApplication(data: TrackedApplicationRow): Promise<TrackedApplication> {
  let state = offerStateOf(data.status, isOfferResponse(data.offer_response) ? data.offer_response : null, data.offer_expires_at ?? null);
  // Added under Accounts or onboarded, but not marked yet: their offer was taken.
  if (state === "open" && hasUnitAccount(await getCommissionAccounts(data.email).catch(() => undefined), data.preferred_body, data.college)) state = "joined";
  return {
    editRequest: await pendingSubmissionEditRequest("application", data.id).catch(() => null),
    referenceCode: data.reference_code,
    name: applicantName(data),
    status: data.status as ApplicationStatus,
    submittedAt: data.created_at,
    preferredBody: preferredBodies[data.preferred_body as keyof typeof preferredBodies] ?? data.preferred_body,
    division: data.division,
    position: currentPositionLabel(data.preferred_body, data.college, data.position_id, data.position),
    college: data.college,
    program: data.program,
    yearLevel: yearLevels[data.year_level as keyof typeof yearLevels] ?? data.year_level,
    interview: interviewOf(data.interview_slots),
    offer: { state, expiresAt: data.offer_expires_at ?? null, respondedAt: data.offer_responded_at ?? null, joinUrl: state === "open" ? joinCommissionUrl(data.reference_code) : null },
  };
}

export type DeclineState = { error?: string; application?: TrackedApplication } | undefined;

/**
 * Decline an acceptance offer from the tracker, with the same reference code and student number or
 * last name that found it. The application is no longer accepted, its slot goes back to the unit,
 * and they can apply to that unit again after 60 days, or sooner if the unit accepts them again.
 */
export async function declineAcceptance(_state: DeclineState, formData: FormData): Promise<DeclineState> {
  const reference = parseReferenceCode(text(formData, "reference").toUpperCase());
  const identity = text(formData, "identity").toUpperCase().trim().replace(/\s+/g, " ");
  const studentNumber = identity.replace(/\s+/g, "");
  const isStudentNumber = /^\d{10}$/.test(studentNumber);
  if (!reference || reference.prefix !== "CC" || (!isStudentNumber && !personNamePattern.test(identity))) return { error: "Track your application again before declining." };

  const limited = rateLimit(`decline:${clientIp(await headers())}`, limits.track.limit, limits.track.windowMs);
  if (!limited.ok) return { error: `Too many attempts from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.` };
  if (!isSupabaseConfigured()) return { error: "Declining isn’t available online right now. Reply to your acceptance email, or write to comelec@ust.edu.ph." };

  try {
    const found = await findTrackedApplication(reference.code, isStudentNumber ? studentNumber : identity.replace(/[\\%_]/g, "\\$&"), isStudentNumber);
    if (!found) return { error: "We couldn’t match that reference code and identity. Track your application again." };
    const before = await toTrackedApplication(found);
    if (before.offer.state === "joined") return { error: "You’ve already joined the Commission, so this offer can’t be declined here. To step down, contact the commission.", application: before };
    if (before.offer.state !== "open") return { error: "This offer is no longer open, so there’s nothing to decline.", application: before };

    const result = await declineOffer({ id: found.id, email: found.email, preferredBody: found.preferred_body, college: found.college, referenceCode: found.reference_code });
    if (result === "unavailable") return { error: "Declining isn’t available online yet. Reply to your acceptance email, or write to comelec@ust.edu.ph." };
    const updated = await findTrackedApplication(reference.code, found.student_number, true);
    const application = updated ? await toTrackedApplication(updated) : before;
    if (result === "closed") return { error: "This offer changed while you were deciding. Check where it stands below.", application };

    // Its slot is free again for the unit to fill.
    clearApplyPageCache();
    revalidatePath("/apply");
    revalidatePath("/portal/recruitment/applications");
    revalidatePath("/portal/recruitment/slots");
    const concern = concernOf(found.preferred_body, found.college);
    after(() => emailUnit("offer-declined", concern, (to) => offerDeclinedEmail(to, { id: found.id, name: applicantName(found), firstName: found.first_name, email: found.email, referenceCode: found.reference_code, position: application.position, division: found.division, concern })));
    return { application };
  } catch (error) {
    console.error("Couldn’t decline the offer:", error instanceof Error ? error.message : error);
    return { error: "Couldn’t decline the offer. Try again, or write to comelec@ust.edu.ph." };
  }
}
