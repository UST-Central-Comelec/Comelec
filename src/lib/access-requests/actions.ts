"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { newReferenceCode } from "@/lib/applications/reference";
import { checkAccess } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { text, type FormState } from "@/lib/portal/form";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { accessReceivedEmail } from "./emails";
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
  if (access.denied === "revoked") return { error: "This account’s portal access was revoked. Contact a Central Comelec executive." };

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
    position: values.position.trim(),
    affiliation: values.affiliation,
    college: values.college,
    program: values.program,
    year_level: values.yearLevel,
  };

  // A new code on the rare chance one is already taken; any other duplicate is an open request from this email.
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceCode = newReferenceCode("PA");
    const { data: saved, error } = await createAdminClient().from("access_requests").insert({ ...row, reference_code: referenceCode }).select("created_at").single();

    if (error?.code === "23505" && error.message.includes("reference_code")) continue;
    if (error?.code === "23505") return { error: "You already have a request waiting for review. Track it with the reference code from your receipt or confirmation email." };
    if (error) {
      console.error("Couldn’t save access request:", error.message);
      return { error: failed };
    }

    // One request per verification.
    await clearAccessVerification();

    // After the response, so a slow or failing mail server never holds up the requester.
    after(() => sendEmail(accessReceivedEmail({ email: row.email, firstName: row.first_name, referenceCode })));

    return {
      submitted: true,
      result: {
        referenceCode,
        name: `${row.first_name} ${row.middle_initial}. ${row.last_name}`,
        email: row.email,
        submittedAt: saved.created_at as string,
        answers: describeAccessRequest(values),
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
