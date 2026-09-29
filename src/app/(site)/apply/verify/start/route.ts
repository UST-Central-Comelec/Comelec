import { NextResponse, type NextRequest } from "next/server";
import { verificationFinishPage } from "@/lib/applications/verification-page";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_EMAIL_DOMAIN, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

// Opened in the verification popup: starts Google sign-in for a UST account. Google then returns
// to /apply/verify. A GET only starts sign-in and sets nothing but Supabase's sign-in cookie, so
// it's safe as a plain link.

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return verificationFinishPage("unavailable");
  if (!rateLimit(`verify:${clientIp(request.headers)}`, limits.login.limit, limits.login.windowMs).ok) return verificationFinishPage("rate-limited");

  const { data, error } = await (await createAuthClient()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/apply/verify", request.nextUrl).toString(),
      // `hd` only pre-selects UST accounts in Google's picker; the callback enforces the domain.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) return verificationFinishPage("failed");
  return NextResponse.redirect(data.url);
}
