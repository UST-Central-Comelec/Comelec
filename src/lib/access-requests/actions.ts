"use server";

import { ensureReferenceData } from "@/lib/reference/store";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { newReferenceCode } from "@/lib/applications/reference";
import { checkAccess } from "@/lib/auth/session";
import { facebookHref, fullName } from "@/lib/data/accounts";
import { accountPositions, describeAffiliation, type AccountPosition, type Affiliation } from "@/lib/data/types";
import { type Declaration } from "@/lib/onboarding/documents";
import { getOnboardingDocuments } from "@/lib/onboarding/store";
import { concernOf } from "@/lib/notifications/concern";
import { emailUnit, sendAutomatic } from "@/lib/notifications/notify";
import { text, type FormState } from "@/lib/portal/form";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { addRequestedAccount } from "./approve";
import type { JoinProfile } from "./channel";
import { accessDecisionEmail, accessReceivedEmail, accessRequestNoticeEmail } from "./emails";
import { findJoinProfile } from "./join";
import { checkAccessRequest, describeAccessRequest, readAccessRequest, type AccessRequestSection } from "./schema";
import { clearAccessVerification, readAccessPass } from "./verification";
import { CONFIRM_PHRASE } from "./channel";

/** What the receipt shows once a request is saved. `approved` when it came from Join the Commission and the account is ready. */
export type SubmittedAccessRequest = { referenceCode: string; name: string; email: string; submittedAt: string; answers: AccessRequestSection[]; approved?: boolean };

/** `verification` says which Google step has to be done again: all of it, or just the confirmation. */
export type AccessRequestState = (FormState & { submitted?: boolean; result?: SubmittedAccessRequest; verification?: "expired" | "unconfirmed" }) | undefined;

const failed = "Something went wrong saving your request. Please try again, or email comelec@ust.edu.ph.";

/** Who approved a Join the Commission request, as Accounts and the logs show it. */
const JOINED = "Join the Commission";

/** How far back a tick in the form can be: a long read, a pause, and the Google steps. */
const ACCEPTANCE_WINDOW_MS = 12 * 60 * 60_000;

/**
 * The documents the requester ticked, from the form's `declaration.<key>` fields ("version|time").
 * Null if any is missing. Each keeps the version they were shown and the time they ticked it; a
 * time from outside the last few hours, or in the future, is replaced by the time it was sent.
 */
async function readDeclarations(formData: FormData): Promise<Declaration[] | null> {
  const documents = await getOnboardingDocuments();
  const now = Date.now();
  const declarations: Declaration[] = [];
  for (const document of documents) {
    const key = document.key;
    const [versionText = "", time = ""] = text(formData, `declaration.${key}`).split("|");
    const version = Number(versionText);
    if (!Number.isInteger(version) || version < 1 || version > document.version) return null;
    const at = Date.parse(time);
    const acceptedAt = Number.isNaN(at) || at > now + 60_000 || at < now - ACCEPTANCE_WINDOW_MS ? new Date(now).toISOString() : new Date(at).toISOString();
    declarations.push({ key, title: document.title, version, acceptedAt });
  }
  return declarations;
}

export async function submitAccessRequest(_state: AccessRequestState, formData: FormData): Promise<AccessRequestState> {
  await ensureReferenceData();
  // Hidden field that people never see. Bots that fill it get a normal-looking success.
  if (text(formData, "website")) return { submitted: true };

  if (!isSupabaseConfigured()) return { error: "Requesting access isn’t available right now. Please email comelec@ust.edu.ph." };

  const limited = rateLimit(`access-request:${clientIp(await headers())}`, limits.apply.limit, limits.apply.windowMs);
  if (!limited.ok) return { error: `Request Blocked by Security Protection - Unusual Traffic Detected. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.` };

  // The email saved is the Google-verified one, whatever the form says. The requester confirms by
  // typing the phrase on the last step.
  const pass = await readAccessPass();
  if (!pass) return { error: "Your UST account verification expired. Verify again, then submit.", verification: "expired" };
  if (text(formData, "confirmation").trim() !== CONFIRM_PHRASE) return { error: `Type “${CONFIRM_PHRASE}” to submit your request.` };

  const access = await checkAccess(pass.email);
  if ("user" in access) return { error: "This account already has portal access. Go back and sign in with Google." };
  if (access.denied === "revoked") return { error: "This account’s portal access was revoked. Contact your Executive Board." };

  const declarations = await readDeclarations(formData);
  if (!declarations) return { error: "Agree to the privacy notice and every onboarding document before you submit." };

  // From an acceptance email: the application decides where they serve, whatever the form says.
  const joinRef = text(formData, "join").trim();
  const joining = joinRef ? await findJoinProfile(joinRef, pass.email) : null;
  const values = { ...readAccessRequest(formData), email: pass.email, ...(joining ? { affiliation: joining.affiliation, position: joining.position, role: joining.role, college: joining.college } : {}) };
  const fieldErrors = checkAccessRequest(values);
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const row = {
    last_name: values.lastName.trim().toUpperCase(),
    first_name: values.firstName.trim().toUpperCase(),
    middle_initial: Array.from(values.middleName.trim().toUpperCase())[0],
    middle_name: values.middleName.trim().toUpperCase(),
    student_number: values.studentNumber.trim(),
    contact_number: values.contactNumber.replace(/[\s-]/g, "") || null,
    email: pass.email,
    // `position` holds the role in words, as it always has; the position itself is `account_position`.
    position: values.role.trim(),
    affiliation: values.affiliation,
    college: values.college,
    program: values.program,
    year_level: values.yearLevel,
    ...(joining ? { status: "approved", decided_at: new Date().toISOString(), decided_by: JOINED } : {}),
  };
  const added = { account_position: values.position, facebook_url: values.facebookUrl ? facebookHref(values.facebookUrl) : null };
  const onboarding = { declarations, application_reference: joining?.referenceCode ?? null };
  const insert = (fields: object) => createAdminClient().from("access_requests").insert(fields).select("id, created_at").single();

  // A new code on the rare chance one is already taken; any other duplicate is an open request from this email.
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceCode = newReferenceCode("PA");
    let { data: saved, error } = await insert({ ...row, ...added, ...onboarding, reference_code: referenceCode });
    if (error?.code === "PGRST204" && /middle_name/i.test(error.message)) {
      console.error("Access requests need supabase/migrations/0075_access_request_middle_name.sql.");
      return { error: "Requesting access needs an update. Please email comelec@ust.edu.ph so we can help." };
    }
    // Before supabase/migrations/0074 there's no place for the declarations, and before 0021 none
    // for the position and Facebook link either; the request still goes in.
    if (error?.code === "PGRST204") ({ data: saved, error } = await insert({ ...row, ...added, reference_code: referenceCode }));
    if (error?.code === "PGRST204") ({ data: saved, error } = await insert({ ...row, reference_code: referenceCode }));

    if (error?.code === "23505" && error.message.includes("reference_code")) continue;
    if (error?.code === "23505") return { error: "You already have a request waiting for review. Track it with the reference code from your receipt or confirmation email." };
    if (error || !saved) {
      console.error("Couldn’t save access request:", error?.message);
      return { error: failed };
    }

    // One request per verification.
    await clearAccessVerification();

    const submittedAt = saved.created_at as string;
    const answers = describeAccessRequest(values, declarations);
    const name = fullName({ firstName: row.first_name, middleName: row.middle_name, lastName: row.last_name });
    const requester = { email: row.email, firstName: row.first_name, referenceCode, concern: concernOf(row.affiliation, row.college) };

    if (joining && (await joinCommission(saved.id as string, values, joining, declarations))) {
      // Their account is ready: they're emailed the approval, with the account's details.
      const account: Array<[string, string]> = [
        ["Name", name],
        ["UST email", row.email],
        ["Serves in", describeAffiliation(joining.affiliation, joining.college)],
        ["Position", accountPositions[joining.position]],
        ["Role", joining.role],
        ["Program", row.program],
        ["Student number", row.student_number],
      ];
      after(() => sendAutomatic("access-approved", () => accessDecisionEmail(requester, true, account)));
      return { submitted: true, result: { referenceCode, name, email: row.email, submittedAt, answers, approved: true } };
    }

    // The receipt, after the response, so a slow or failing mail server never holds up the requester.
    // The request is the Central Comelec's or their college's Local Comelec's, by where they said they serve.
    after(() => sendAutomatic("access-received", () => accessReceivedEmail(requester, { answers, submittedAt })));
    // The unit it's for is told too, where that's switched on under Email Sender → Automatic: its official account and its Executive Board.
    after(() =>
      emailUnit("access-notice", requester.concern, (to) =>
        accessRequestNoticeEmail(to, { ...requester, name }, [
          ["Name", name],
          ["UST email", row.email],
          ["Requested for", describeAffiliation(row.affiliation as Affiliation, row.college)],
          ["Position", accountPositions[values.position as AccountPosition] ?? ""],
          ["Role", row.position],
          ["Program", row.program],
          ["Student number", row.student_number],
        ]),
      ),
    );

    return { submitted: true, result: { referenceCode, name, email: row.email, submittedAt, answers } };
  }

  console.error("Couldn’t save access request: no free reference code after 3 tries.");
  return { error: failed };
}

/**
 * Adds the account for a request sent from Join the Commission, which was saved as approved. If the
 * account can't be added, the request goes back to waiting for review, so it isn't lost.
 */
async function joinCommission(id: string, values: ReturnType<typeof readAccessRequest>, joining: JoinProfile, declarations: Declaration[]) {
  try {
    await addRequestedAccount(
      {
        email: values.email,
        lastName: values.lastName,
        firstName: values.firstName,
        middleInitial: Array.from(values.middleName.trim().toUpperCase())[0],
        middleName: values.middleName.trim().toUpperCase(),
        studentNumber: values.studentNumber.trim(),
        contactNumber: values.contactNumber.replace(/[\s-]/g, "") || null,
        affiliation: joining.affiliation,
        position: joining.position,
        role: joining.role,
        college: joining.college,
        program: values.program,
        yearLevel: values.yearLevel,
        facebookUrl: values.facebookUrl ? facebookHref(values.facebookUrl) : null,
        declarations,
      },
      JOINED,
    );
  } catch (error) {
    console.error("Couldn’t add the account for Join the Commission; the request waits for review:", error instanceof Error ? error.message : error);
    await createAdminClient().from("access_requests").update({ status: "pending", decided_at: null, decided_by: null }).eq("id", id);
    return false;
  }
  // The new account is in the Directory straight away.
  revalidatePath("/about");
  revalidatePath("/");
  revalidatePath("/portal", "layout");
  return true;
}

/** "Use a different account": forgets the verified account so another can be verified. */
export async function forgetAccessVerification() {
  await clearAccessVerification();
}

/**
 * The profile step's details for a Join the Commission link, once the UST account is verified. The
 * application has to be accepted and sent from the verified account; otherwise nothing is shown,
 * and the request goes to the Executive Board like any other.
 */
export async function loadJoinProfile(referenceCode: string): Promise<{ profile: JoinProfile } | { error: string }> {
  await ensureReferenceData();
  const pass = await readAccessPass();
  if (!pass) return { error: "Verify your UST account first." };
  const profile = isSupabaseConfigured() ? await findJoinProfile(referenceCode, pass.email) : null;
  return profile
    ? { profile }
    : { error: `We couldn’t find an open acceptance for ${pass.email}. An offer that was declined, or not answered within 14 days, can’t be used to join. If you applied with another UST account, use that one. Otherwise, fill in your details; your request will go to the Executive Board for review.` };
}
