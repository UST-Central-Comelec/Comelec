import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { ACTIVITY_COOKIE, activityCookieOptions, decodeActivity, encodeActivity, timeoutReason } from "@/lib/security/portal-session";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { isSiteUnderMaintenance } from "@/lib/site-settings/maintenance-flag";

// Runs on every page request. Under maintenance it answers with the maintenance page: for the
// public site when that's switched on in the portal (Maintenance), which leaves the portal up to
// switch it back; for everything, portal included, while MAINTENANCE_MODE is set. Otherwise it
// leaves the public site alone and, on portal requests:
//   • caps how many requests one address can make (a ceiling against floods and scripts),
//   • refreshes the Supabase session cookie and sends visitors who aren't signed in to the login page,
//   • ends sessions after 30 minutes idle or 8 hours total (src/lib/security/portal-session.ts),
//   • stops browsers from caching portal pages, so Back can't show them after signing out.
// It can't tell whether an account was revoked, so pages and Server Actions still check access
// themselves via `requirePortalUser`.

const openPaths = new Set(["/portal/login", "/portal/auth/callback", "/portal/request-access/start"]);

/** Link prefetches aren't the person doing anything, so they don't count as activity. */
const isPrefetch = (request: NextRequest) => request.headers.has("next-router-prefetch") || request.headers.get("sec-purpose")?.includes("prefetch") || request.headers.get("purpose") === "prefetch";

/** A Server Action call (a form post from a portal page) rather than a page load. */
const isServerAction = (request: NextRequest) => request.method === "POST" && request.headers.has("next-action");

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

/**
 * Sends the browser to `path`. A Server Action can't follow a plain redirect: the browser would
 * re-post the action to `path`, get a page back instead of an action result, and show "An
 * unexpected response was received from the server." So actions get Next.js's own redirect
 * header, which makes the page load `path` itself.
 */
function redirectResponse(request: NextRequest, path: string) {
  const url = new URL(path, request.nextUrl);
  if (!isServerAction(request)) return NextResponse.redirect(url);
  return new NextResponse(null, { headers: { "x-action-redirect": `${url.pathname}${url.search};replace` } });
}

/** Set MAINTENANCE_MODE=1 (or "true") to take the whole website, portal included, offline. */
const lockedDown = () => ["1", "true"].includes(process.env.MAINTENANCE_MODE?.trim().toLowerCase() ?? "");

/**
 * The maintenance page (src/app/(status)/maintenance) in place of whatever was asked for, as a 503
 * so search engines know it's temporary and keep what they've indexed.
 */
function maintenanceResponse(request: NextRequest) {
  const headers = { "Retry-After": "3600", "Cache-Control": "no-store, max-age=0" };
  // A form posted from a page that was already open: the action can't run, so say why.
  if (isServerAction(request)) return new NextResponse("The website is under maintenance. Please try again later.", { status: 503, headers: { ...headers, "Content-Type": "text/plain" } });
  return NextResponse.rewrite(new URL("/maintenance", request.nextUrl), { status: 503, headers });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (lockedDown()) return maintenanceResponse(request);
  if (pathname !== "/portal" && !pathname.startsWith("/portal/")) return (await isSiteUnderMaintenance()) ? maintenanceResponse(request) : NextResponse.next();

  const ip = clientIp(request.headers);

  const flood = rateLimit(`portal:${ip}`, limits.portal.limit, limits.portal.windowMs);
  const login = pathname === "/portal/auth/callback" ? rateLimit(`login:${ip}`, limits.login.limit, limits.login.windowMs) : { ok: true, retryAfter: 0 };
  if (!flood.ok || !login.ok) {
    return new NextResponse("Too many requests. Please wait a moment and try again.", {
      status: 429,
      // Next.js only shows a Server Action's error text when the type is exactly "text/plain".
      headers: { "Retry-After": String(Math.max(flood.retryAfter, login.retryAfter)), "Content-Type": isServerAction(request) ? "text/plain" : "text/plain; charset=utf-8" },
    });
  }

  const isOpen = openPaths.has(pathname);
  if (!isSupabaseConfigured()) return noStore(isOpen ? NextResponse.next() : redirectResponse(request, "/portal/login"));

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
    const redirect = redirectResponse(request, path);
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
  // Everything but build assets and the files in public/, which the maintenance page needs too.
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico).*)"],
};
