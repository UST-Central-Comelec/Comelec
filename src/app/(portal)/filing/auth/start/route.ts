import { NextResponse, type NextRequest } from "next/server";
import { filingFinishPage } from "@/lib/filing-portal/callback";
import { isFlowMode, startFilingFlow } from "@/lib/filing-portal/verification";
import { endEventFlow } from "@/lib/events/verification";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_EMAIL_DOMAIN, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

// Starts Google sign-in for the filing portal: `?mode=party` or `?mode=candidacy` from a sign-up
// form's popup, `?mode=login` from the portal's sign-in page. Google returns to /apply/verify,
// which hands over to the filing portal (src/lib/filing-portal/callback.ts). A GET only starts
// sign-in and sets nothing but the flow and Supabase's sign-in cookies, so it's safe as a plain link.

export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get("mode");
  const mode = isFlowMode(asked) ? asked : "login";
  const failed = (status: "failed" | "rate-limited" | "unavailable") => (mode === "login" ? NextResponse.redirect(new URL(`/filing/login?error=${status}`, request.nextUrl)) : filingFinishPage(mode, status));
  if (!isSupabaseConfigured()) return failed("unavailable");
  if (!rateLimit(`verify:${clientIp(request.headers)}`, limits.login.limit, limits.login.windowMs).ok) return failed("rate-limited");

  const { data, error } = await (await createAuthClient()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/apply/verify", request.nextUrl).toString(),
      // `hd` only pre-selects UST accounts in Google's picker; the callback enforces the domain.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) return failed("failed");
  // So the callback treats this as the filing portal's, even after an abandoned event registration.
  await endEventFlow();
  await startFilingFlow(mode);
  return NextResponse.redirect(data.url);
}
