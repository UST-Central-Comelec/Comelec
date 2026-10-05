"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { newReferenceCode } from "@/lib/applications/reference";
import { checkAccess } from "@/lib/auth/session";
import { facebookHref } from "@/lib/data/accounts";
import { accountPositions, describeAffiliation, type AccountPosition, type Affiliation } from "@/lib/data/types";
import { concernOf } from "@/lib/notifications/concern";
import { emailUnit, sendAutomatic } from "@/lib/notifications/notify";
import { text, type FormState } from "@/lib/portal/form";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { accessReceivedEmail, accessRequestNoticeEmail } from "./emails";
import { checkAccessRequest, describeAccessRequest, readAccessRequest, type AccessRequestSection } from "./schema";
import { clearAccessVerification, isConfirmed, readAccessPass } from "./verification";

/** What the receipt shows once a request is saved. */
export type SubmittedAccessRequest = { referenceCode: string; name: string; email: string; submittedAt: string; answers: AccessRequestSection[] };

/** `verification` says which Google step has to be done again: all of it, or just the confirmation. */
export type AccessRequestState = (FormState & { submitted?: boolean; result?: SubmittedAccessRequest; verification?: "expired" | "unconfirmed" }) | undefined;

const failed = "Something went wrong saving your request. Please try again, or email comelec@ust.edu.ph.";

export async function submitAccessRequest(_state: AccessRequestState, formData: FormData): Promise<AccessRequestState> {
  // Hidden field that people never see. Bots that fill it get a normal-looking success.
  if (text(formData, "website")) return { submitted: true };

  if (!isSupabaseConfigured()) return { error: "Requesting access isn’t available right now. Please email comelec@ust.edu.ph." };

  const limited = rateLimit(`access-request:${clientIp(await headers())}`, limits.apply.limit, limits.apply.windowMs);
  if (!limited.ok) return { error: `Too many requests from this network. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.` };

  // The email saved is the Google-verified one, whatever the form says, and only after it was
  // confirmed with Google again just now.
  const pass = await readAccessPass();
  if (!pass) return { error: "Your UST account verification expired. Verify again, then submit.", verification: "expired" };
  if (!(await isConfirmed(pass))) return { error: "Confirm with your UST Google account to submit your request.", verification: "unconfirmed" };

  const access = await checkAccess(pass.email);
  if ("user" in access) return { error: "This account already has portal access. Go back and sign in with Google." };
  if (access.denied === "revoked") return { error: "This account’s portal access was revoked. Contact your Executive Board." };

  const values = { ...readAccessRequest(formData), email: pass.email };
  const fieldErrors = checkAccessRequest(values);
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const row = {
    last_name: values.lastName.trim().toUpperCase(),
    first_name: values.firstName.trim().toUpperCase(),
    middle_initial: values.middleInitial.trim().toUpperCase(),
    student_number: values.studentNumber.trim(),
    contact_number: values.contactNumber.replace(/[\s-]/g, "") || null,
    email: pass.email,
    // `position` holds the role in words, as it always has; the position itself is `account_position`.
    position: values.role.trim(),
    affiliation: values.affiliation,
    college: values.college,
    program: values.program,
    year_level: values.yearLevel,
  };
  const added = { account_position: values.position, facebook_url: values.facebookUrl ? facebookHref(values.facebookUrl) : null };
  const insert = (fields: object) => createAdminClient().from("access_requests").insert(fields).select("created_at").single();

  // A new code on the rare chance one is already taken; any other duplicate is an open request from this email.
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceCode = newReferenceCode("PA");
    let { data: saved, error } = await insert({ ...row, ...added, reference_code: referenceCode });
    // Before supabase/migrations/0021 the table has no place for the last two; the request still goes in.
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
    const answers = describeAccessRequest(values);

    // The receipt, after the response, so a slow or failing mail server never holds up the requester.
    // The request is the Central Comelec's or their college's Local Comelec's, by where they said they serve.
    const requester = { email: row.email, firstName: row.first_name, referenceCode, concern: concernOf(row.affiliation, row.college) };
    after(() => sendAutomatic("access-received", () => accessReceivedEmail(requester, { answers, submittedAt })));
    // The unit it's for is told too, where that's switched on under Email Sender → Automatic: its official account and its Executive Board.
    const name = `${row.first_name} ${row.middle_initial}. ${row.last_name}`;
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

    return {
      submitted: true,
      result: {
        referenceCode,
        name,
        email: row.email,
        submittedAt,
        answers,
      },
    };
  }

  console.error("Couldn’t save access request: no free reference code after 3 tries.");
  return { error: failed };
}

/** "Use a different account": forgets the verified account so another can be verified. */
export async function forgetAccessVerification() {
  await clearAccessVerification();
}
