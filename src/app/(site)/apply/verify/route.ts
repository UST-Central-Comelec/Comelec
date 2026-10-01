import type { NextRequest } from "next/server";
import { createPass, PASS_COOKIE, passCookieOptions } from "@/lib/applications/verification";
import { verificationFinishPage } from "@/lib/applications/verification-page";
import { checkAccess } from "@/lib/auth/session";
import { finishEventVerification } from "@/lib/events/callback";
import { takeEventFlow } from "@/lib/events/verification";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { createAdminClient, createAuthClient } from "@/lib/supabase/server";

// Google sends applicants back here after they pick an account. Exchange the code, check it's a
// UST account, end the Google session straight away, and hand the form a signed pass instead
// (src/lib/applications/verification.ts). Nobody stays signed in on the public site. The reply is
// a small page that reports back to the form and closes the popup (verification-page.ts).
// Sign-ins started from an event's Register button come back here too, and are handed over to
// finishEventVerification.

type Metadata = { full_name?: string; name?: string; given_name?: string; family_name?: string };

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const eventId = await takeEventFlow();
  if (eventId) return finishEventVerification(request, code, eventId);

  if (!code) return verificationFinishPage("failed");

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data?.user?.email?.trim().toLowerCase();
  // Only the verified email and name are needed; the session itself ends here either way.
  const metadata = { ...(data?.user?.identities?.[0]?.identity_data ?? {}), ...(data?.user?.user_metadata ?? {}) } as Metadata;
  await supabase.auth.signOut({ scope: "local" });

  // Don't keep a sign-in record for applicants: delete the Supabase user now that it's served its
  // purpose. Commissioners' records stay, since they sign in to the portal with the same accounts.
  if (data?.user && (!email || !("user" in (await checkAccess(email))))) {
    const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(data.user.id);
    if (deleteError) console.error("Couldn’t delete the applicant’s sign-in record:", deleteError.message);
  }

  if (error || !email) return verificationFinishPage("failed");
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return verificationFinishPage("not-ust");

  const profile = { email, firstName: metadata.given_name?.trim() ?? "", lastName: metadata.family_name?.trim() ?? "" };
  const response = verificationFinishPage("ok", profile);
  response.cookies.set(PASS_COOKIE, await createPass({ ...profile, consentAt: Date.now() }), passCookieOptions);
  return response;
}
