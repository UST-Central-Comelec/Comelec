import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { checkAccess } from "@/lib/auth/session";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { createAdminClient, createAuthClient } from "@/lib/supabase/server";
import { createEventPass, EVENT_PASS_COOKIE, eventPassCookieOptions } from "./verification";

type Metadata = { full_name?: string; name?: string; given_name?: string; family_name?: string };

/** Why verification didn't complete, as the registration page's ?verify= reads it. */
export type EventVerifyStatus = "not-ust" | "failed" | "rate-limited" | "unavailable";

/** The event's registration page, saying why verification didn't go through when it didn't. */
export const registrationUrl = (request: NextRequest, eventId: string, status?: EventVerifyStatus) => new URL(`/events/${eventId}/register${status ? `?verify=${status}` : ""}`, request.nextUrl);

/**
 * Google sends people back to the applicant callback; when the sign-in was started from an event's
 * Register button, the callback hands over here. Like applicant verification, the Google session
 * ends straight away and only a signed pass is kept (verification.ts). The student lands on the
 * event's registration form.
 */
export async function finishEventVerification(request: NextRequest, code: string | null, eventId: string) {
  if (!code) return NextResponse.redirect(registrationUrl(request, eventId, "failed"));

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data?.user?.email?.trim().toLowerCase();
  // Only the verified email and name are needed; the session itself ends here either way.
  const metadata = { ...(data?.user?.identities?.[0]?.identity_data ?? {}), ...(data?.user?.user_metadata ?? {}) } as Metadata;
  await supabase.auth.signOut({ scope: "local" });

  // Don't keep a sign-in record for students: delete the Supabase user now that it's served its
  // purpose. Commissioners' records stay, since they sign in to the portal with the same accounts.
  if (data?.user && (!email || !("user" in (await checkAccess(email))))) {
    const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(data.user.id);
    if (deleteError) console.error("Couldn’t delete the registrant’s sign-in record:", deleteError.message);
  }

  if (error || !email) return NextResponse.redirect(registrationUrl(request, eventId, "failed"));
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return NextResponse.redirect(registrationUrl(request, eventId, "not-ust"));

  const response = NextResponse.redirect(registrationUrl(request, eventId));
  response.cookies.set(EVENT_PASS_COOKIE, await createEventPass({ eventId, email, firstName: metadata.given_name?.trim() ?? "", lastName: metadata.family_name?.trim() ?? "" }), eventPassCookieOptions);
  return response;
}
