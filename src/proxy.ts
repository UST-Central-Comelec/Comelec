import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

// Runs on portal requests: refreshes the Supabase session cookie, and sends visitors who aren't
// signed in to the login page. It can't tell whether an account was revoked, so pages and Server
// Actions still check access themselves via `requirePortalUser`.

const openPaths = new Set(["/portal/login", "/portal/auth/callback"]);

export async function proxy(request: NextRequest) {
  const isOpen = openPaths.has(request.nextUrl.pathname);
  if (!isSupabaseConfigured()) return isOpen ? NextResponse.next() : NextResponse.redirect(new URL("/portal/login", request.nextUrl));

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

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && !isOpen) {
    const redirect = NextResponse.redirect(new URL("/portal/login", request.nextUrl));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/portal", "/portal/:path*"],
};
