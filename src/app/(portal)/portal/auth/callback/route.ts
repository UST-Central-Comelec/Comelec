import { NextResponse, type NextRequest } from "next/server";
import { checkAccess } from "@/lib/auth/session";
import { ACTIVITY_COOKIE, activityCookieOptions, encodeActivity } from "@/lib/security/portal-session";
import { createAuthClient } from "@/lib/supabase/server";

// Google sends people back here after they pick an account. Exchange the code for a Supabase
// session, then make sure the email is allowed — if not, sign them straight back out. Allowed
// sessions start their timeout clock here (see src/lib/security/portal-session.ts). The proxy
// rate-limits this route.

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/portal/login?error=${error}`, request.nextUrl));
  if (!code) return toLogin("failed");

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user.email) return toLogin("failed");

  const access = await checkAccess(data.user.email);
  if ("denied" in access) {
    await supabase.auth.signOut({ scope: "local" });
    return toLogin(access.denied);
  }

  const { data: claims } = await supabase.auth.getClaims();
  const sessionId = claims?.claims.session_id;
  if (typeof sessionId !== "string") {
    await supabase.auth.signOut({ scope: "local" });
    return toLogin("failed");
  }

  const now = Date.now();
  const response = NextResponse.redirect(new URL("/portal", request.nextUrl));
  response.cookies.set(ACTIVITY_COOKIE, await encodeActivity({ sessionId, startedAt: now, lastActiveAt: now }), activityCookieOptions);
  return response;
}
