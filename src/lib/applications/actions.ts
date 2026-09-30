"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { findAccessRequest, type AccessRequestStatus } from "@/lib/access-requests/admin";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { text, type FormState } from "@/lib/portal/form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { describeAnswers, interviewLater, type AnswerSection } from "./answers";
import { clearApplyPageCache } from "./apply-cache";
import { confirmationEmail } from "./emails";
import { describeSlot, type InterviewMode } from "./interview-format";
import { getOpenSlots } from "./interviews";
import { divisions, preferredBodies, retentionCutoff, yearLevels, type DivisionId } from "./options";
import { isAccepting } from "./period";
import { getApplicationPeriod } from "./period-store";
import { newReferenceCode, parseReferenceCode } from "./reference";
import { applicationFields, checkFields, declaredConflicts, needsPortfolio, readApplication, type ApplicationField } from "./schema";
import { getSlots } from "./slots";
import { clearPass, readPass } from "./verification";

/** What the Receipt step shows once an application is saved. */
export type SubmittedApplication = { referenceCode: string; name: string; division: string; position: string; interview: string | null; submittedAt: string; answers: AnswerSection[] };

export type ApplicationState = (FormState & { submitted?: boolean; result?: SubmittedApplication; verificationExpired?: boolean }) | undefined;

const closedMessage = "Applications are closed, so this application wasn’t submitted. Watch the commission’s announcements for the next recruitment period.";

const allFields = Object.keys(applicationFields.shape) as ApplicationField[];

export async function submitApplication(_state: ApplicationState, formData: FormData): Promise<ApplicationState> {
  // Hidden field that people never see. Bots that fill it get a normal-looking success.
  if (text(formData, "website")) return { submitted: true };

  if (!isSupabaseConfigured()) return { error: "Applications aren’t being accepted online right now. Please email comelec@ust.edu.ph." };

  const limited = rateLimit(`apply:${clientIp(await headers())}`, limits.apply.limit, limits.apply.windowMs);
  if (!limited.ok) return { error: `Too many submissions from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.` };

  // Fresh, not the Apply page's cache: the period may have closed while the form was open. If the
  // setting can't be read, the database check on insert still has the final say.
  const period = await getApplicationPeriod().catch(() => null);
  if (period && !isAccepting(period)) return { error: closedMessage };

  // Only a verified UST account can apply, and the email saved is the verified one, whatever the form says.
  const pass = await readPass();
  if (!pass) {
    return { error: "Your UST account verification expired. Verify again on step 1, then submit.", fieldErrors: { consent: "Verify with your UST Google account again." }, verificationExpired: true };
  }

  const values = { ...readApplication(formData), email: pass.email };
  const [positionSlots, openInterviews] = await Promise.all([getSlots(), getOpenSlots().catch(() => [])]);
  // Only the chosen division's interview times count.
  const divisionInterviews = openInterviews.filter((slot) => slot.division === values.division);
  const fieldErrors = checkFields(values, allFields, positionSlots, divisionInterviews.map((slot) => slot.id));
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
  const interview = divisionInterviews.find((slot) => slot.id === values.interviewSlot);
  const interviewText = interview ? describeSlot(interview) : null;

  const data = applicationFields.parse(values);
  const division = divisions[data.division as DivisionId];
  const facebookUrl = /^https?:\/\//i.test(data.facebookUrl) ? data.facebookUrl : `https://${data.facebookUrl}`;

  const row = {
    last_name: data.lastName.toUpperCase(),
    first_name: data.firstName.toUpperCase(),
    middle_initial: data.middleInitial.toUpperCase(),
    student_number: data.studentNumber,
    contact_number: data.contactNumber.replace(/[\s-]/g, "") || null,
    email: data.email,
    facebook_url: facebookUrl,
    college: data.college,
    program: data.program,
    year_level: data.yearLevel,
    preferred_body: data.preferredBody,
    division: division.label,
    position: (division.positions as Record<string, string>)[data.position],
    position_id: data.position,
    cv_url: data.cvUrl,
    endorsement_url: data.endorsementUrl || null,
    portfolio_url: needsPortfolio(data.division) ? data.portfolioUrl : null,
    consent: data.consent,
    // Only the conflicts answered "yes"; an empty list means none. Submitting one means pledging to resolve it.
    conflicts: declaredConflicts(values),
    interview_slot_id: interview?.id ?? null,
  };

  // A new code on the rare chance one is already taken; any other duplicate is the same email this year.
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceCode = newReferenceCode();
    const { data: saved, error } = await createAdminClient().from("applications").insert({ ...row, reference_code: referenceCode }).select("created_at").single();

    if (error?.code === "23505" && error.message.includes("reference_code")) continue;
    if (error?.message.includes("applications_closed")) return { error: closedMessage };
    // Someone else took the slot's last place between the check above and this insert.
    if (error?.message.includes("interview_slot_full")) {
      return { error: "Check the highlighted fields.", fieldErrors: { interviewSlot: "That time just filled up. Pick another." } };
    }
    if (error?.code === "23505") {
      return { error: "We already have an application from this email for this election year.", fieldErrors: { email: "This email has already applied this year." } };
    }
    if (error) {
      console.error("Couldn’t save application:", error.message);
      return { error: "Something went wrong saving your application. Please try again, or email comelec@ust.edu.ph." };
    }

    // One application per verification. Its interview booking changes the open slots.
    await clearPass();
    clearApplyPageCache();

    // After the response, so a slow or failing mail server never holds up the applicant.
    after(() => sendEmail(confirmationEmail({ email: row.email, firstName: row.first_name, referenceCode, position: row.position, division: row.division }, interviewText)));

    return {
      submitted: true,
      result: {
        referenceCode,
        name: `${row.first_name} ${row.middle_initial}. ${row.last_name}`,
        division: row.division,
        position: row.position,
        interview: interviewText,
        submittedAt: saved.created_at as string,
        answers: describeAnswers({ ...values, facebookUrl }, interviewText ?? interviewLater),
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
};

/** A portal access request (PA- code), as its requester sees it when tracking. */
export type TrackedAccessRequest = {
  referenceCode: string;
  name: string;
  email: string;
  status: AccessRequestStatus;
  submittedAt: string;
  position: string;
  college: string;
  program: string;
  yearLevel: string;
};

/** `entered` is what the applicant typed, so a failed lookup doesn't clear the form. */
export type TrackState = { error?: string; fieldErrors?: Record<string, string>; application?: TrackedApplication; accessRequest?: TrackedAccessRequest; entered?: { reference: string; studentNumber: string } } | undefined;

export async function trackApplication(_state: TrackState, formData: FormData): Promise<TrackState> {
  const entered = { reference: text(formData, "reference"), studentNumber: text(formData, "studentNumber") };
  // CC- codes are applications; PA- codes are portal access requests (src/lib/access-requests).
  const parsed = parseReferenceCode(entered.reference);
  const studentNumber = entered.studentNumber.replace(/\s+/g, "");

  const fieldErrors: Record<string, string> = {};
  if (!parsed) fieldErrors.reference = "Use the code from your confirmation, like CC-7K3M-9QXA or PA-7K3M-9QXA.";
  if (!/^\d{10}$/.test(studentNumber)) fieldErrors.studentNumber = "Use the 10-digit student number you gave when you submitted.";
  if (!parsed || Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors, entered };
  const referenceCode = parsed.code;

  // Also what makes guessing reference codes impractical.
  const limited = rateLimit(`track:${clientIp(await headers())}`, limits.track.limit, limits.track.windowMs);
  if (!limited.ok) return { error: `Too many lookups from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.`, entered };

  if (!isSupabaseConfigured()) return { error: "Tracking isn’t available right now. Please email comelec@ust.edu.ph.", entered };

  if (parsed.prefix === "PA") {
    const request = await findAccessRequest(referenceCode, studentNumber).catch((lookupError: Error) => {
      console.error("Couldn’t look up access request:", lookupError.message);
      return undefined;
    });
    if (request === undefined) return { error: "Something went wrong looking up your request. Please try again.", entered };
    if (!request) return { error: "We couldn’t find a request with that reference code and student number. Check both and try again.", entered };
    const { referenceCode: code, name, email, status, submittedAt, position, college, program, yearLevel } = request;
    return { entered, accessRequest: { referenceCode: code, name, email, status, submittedAt, position, college, program, yearLevel } };
  }

  const { data, error } = await createAdminClient()
    .from("applications")
    .select("reference_code, first_name, middle_initial, last_name, status, created_at, preferred_body, division, position, college, program, year_level, interview_slots(starts_at, duration_minutes, mode, location)")
    .eq("reference_code", referenceCode)
    .eq("student_number", studentNumber)
    .gte("created_at", retentionCutoff())
    .maybeSingle();

  if (error) {
    console.error("Couldn’t look up application:", error.message);
    return { error: "Something went wrong looking up your application. Please try again.", entered };
  }
  // Same message either way, so the form doesn't reveal which half was wrong.
  if (!data) return { error: "We couldn’t find an application with that reference code and student number. Check both and try again.", entered };

  return {
    entered,
    application: {
      referenceCode: data.reference_code,
      name: `${data.first_name} ${data.middle_initial}. ${data.last_name}`,
      status: data.status as ApplicationStatus,
      submittedAt: data.created_at,
      preferredBody: preferredBodies[data.preferred_body as keyof typeof preferredBodies] ?? data.preferred_body,
      division: data.division,
      position: data.position,
      college: data.college,
      program: data.program,
      yearLevel: yearLevels[data.year_level as keyof typeof yearLevels] ?? data.year_level,
      interview: interviewOf(data.interview_slots),
    },
  };
}
