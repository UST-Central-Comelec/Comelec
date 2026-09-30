import { NextResponse, type NextRequest } from "next/server";
import { accessFinishPage } from "@/lib/access-requests/callback";
import { readAccessPass, startAccessFlow } from "@/lib/access-requests/verification";
import { isLoginConfigured } from "@/lib/auth/session";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

// Opened in Request access's popup: starts Google sign-in to verify a UST account (?step=verify),
// or to confirm the verified one again when submitting (?step=confirm). Google returns to the
// portal's callback, which sees the flow cookie set here and finishes the request's verification.
// A GET only starts sign-in and sets short-lived cookies, so it's safe as a plain link.

export async function GET(request: NextRequest) {
  const step = request.nextUrl.searchParams.get("step") === "confirm" ? "confirm" : "verify";
  if (!isLoginConfigured()) return accessFinishPage("unavailable");
  if (!rateLimit(`access-start:${clientIp(request.headers)}`, limits.login.limit, limits.login.windowMs).ok) return accessFinishPage("rate-limited");

  const pass = step === "confirm" ? await readAccessPass() : null;
  if (step === "confirm" && !pass) return accessFinishPage("expired");

  const { data, error } = await (await createAuthClient()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/portal/auth/callback", request.nextUrl).toString(),
      // `hd` only pre-selects UST accounts in Google's picker; the callback enforces the domain.
      // Confirming suggests the account that was verified; the callback checks it's the same.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account", ...(pass ? { login_hint: pass.email } : {}) },
    },
  });
  if (error || !data.url) return accessFinishPage("failed");

  await startAccessFlow(step);
  return NextResponse.redirect(data.url);
}
