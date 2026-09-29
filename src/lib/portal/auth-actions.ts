"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLoginConfigured } from "@/lib/auth/session";
import { ACTIVITY_COOKIE, activityCookieOptions, type TimeoutReason } from "@/lib/security/portal-session";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

async function siteOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signInWithGoogle() {
  if (!isLoginConfigured()) redirect("/portal/login?error=not-configured");
  if (!rateLimit(`login-start:${clientIp(await headers())}`, limits.login.limit, limits.login.windowMs).ok) redirect("/portal/login?error=rate-limited");

  const { data, error } = await (await createAuthClient()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/portal/auth/callback`,
      // `hd` only pre-selects UST accounts in Google's picker; the domain is enforced after sign-in.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/portal/login?error=failed");
  redirect(data.url);
}

async function endSession() {
  await (await createAuthClient()).auth.signOut({ scope: "local" });
  (await cookies()).delete({ name: ACTIVITY_COOKIE, path: activityCookieOptions.path });
}

export async function logout() {
  await endSession();
  redirect("/portal/login");
}

/** Called by the portal when the idle or absolute timeout runs out in the browser. */
export async function logoutAfterTimeout(reason: TimeoutReason) {
  await endSession();
  redirect(`/portal/login?reason=${reason === "expired" ? "expired" : "idle"}`);
}
