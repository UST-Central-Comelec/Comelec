import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { ACTIVITY_COOKIE, activityCookieOptions, decodeActivity, encodeActivity, timeoutReason } from "@/lib/security/portal-session";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";

// Runs on portal requests. It:
//   • caps how many requests one address can make (a ceiling against floods and scripts),
//   • refreshes the Supabase session cookie and sends visitors who aren't signed in to the login page,
//   • ends sessions after 30 minutes idle or 8 hours total (src/lib/security/portal-session.ts),
//   • stops browsers from caching portal pages, so Back can't show them after signing out.
// It can't tell whether an account was revoked, so pages and Server Actions still check access
// themselves via `requirePortalUser`.

const openPaths = new Set(["/portal/login", "/portal/auth/callback"]);

/** Link prefetches aren't the person doing anything, so they don't count as activity. */
const isPrefetch = (request: NextRequest) => request.headers.has("next-router-prefetch") || request.headers.get("sec-purpose")?.includes("prefetch") || request.headers.get("purpose") === "prefetch";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request.headers);

  const flood = rateLimit(`portal:${ip}`, limits.portal.limit, limits.portal.windowMs);
  const login = pathname === "/portal/auth/callback" ? rateLimit(`login:${ip}`, limits.login.limit, limits.login.windowMs) : { ok: true, retryAfter: 0 };
  if (!flood.ok || !login.ok) {
    return new NextResponse("Too many requests. Please wait a moment and try again.", {
      status: 429,
      headers: { "Retry-After": String(Math.max(flood.retryAfter, login.retryAfter)), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const isOpen = openPaths.has(pathname);
  if (!isSupabaseConfigured()) return noStore(isOpen ? NextResponse.next() : NextResponse.redirect(new URL("/portal/login", request.nextUrl)));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  /** Redirects to `path`, keeping any cookies Supabase just set or cleared. */
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.nextUrl));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  const { data } = await supabase.auth.getClaims();
  const sessionId = typeof data?.claims.session_id === "string" ? data.claims.session_id : null;

  if (!data?.claims || !sessionId) {
    if (isOpen) return noStore(response);
    return noStore(redirectTo("/portal/login"));
  }

  // Signed in: check the session hasn't timed out. A session with no valid activity record
  // (started before timeouts existed, or the cookie was tampered with) is treated as expired.
  const record = await decodeActivity(request.cookies.get(ACTIVITY_COOKIE)?.value, sessionId);
  const reason = record ? timeoutReason(record) : "expired";
  if (reason) {
    // Revokes this session's refresh token with Supabase, not just the cookie.
    await supabase.auth.signOut({ scope: "local" });
    const redirect = redirectTo(`/portal/login?reason=${reason}`);
    redirect.cookies.delete({ name: ACTIVITY_COOKIE, path: activityCookieOptions.path });
    return noStore(redirect);
  }

  if (!isPrefetch(request)) {
    response.cookies.set(ACTIVITY_COOKIE, await encodeActivity({ ...record!, lastActiveAt: Date.now() }), activityCookieOptions);
  }
  return noStore(response);
}

export const config = {
  matcher: ["/portal", "/portal/:path*"],
};
