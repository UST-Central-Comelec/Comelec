"use server";

import type { FormState } from "./form";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { endAccessFlow } from "@/lib/access-requests/verification";
import { revalidatePath } from "next/cache";
import { ACCOUNT_COOKIE, accountCookieOptions } from "./account-selection";
import { getPortalMemberships, homeFor, isLoginConfigured } from "@/lib/auth/session";
import { ACTIVITY_COOKIE, activityCookieOptions, decodeActivity, REMEMBER_COOKIE, rememberCookieOptions, timeoutReason } from "@/lib/security/portal-session";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

async function siteOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signInWithGoogle(formData: FormData) {
  if (!isLoginConfigured()) redirect("/portal/login?error=not-configured");
  if (!rateLimit(`login-start:${clientIp(await headers())}`, limits.login.limit, limits.login.windowMs).ok) redirect("/portal/login?error=rate-limited");
  // So the callback treats this as a portal sign-in, even after an abandoned Request access.
  await endAccessFlow();
  // The callback reads this after Google: whether the session should outlast the usual timeouts.
  const cookieStore = await cookies();
  if (formData.get("remember") === "on") cookieStore.set(REMEMBER_COOKIE, "1", rememberCookieOptions);
  else cookieStore.delete({ name: REMEMBER_COOKIE, path: rememberCookieOptions.path });

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
  const cookieStore = await cookies();
  cookieStore.delete({ name: ACTIVITY_COOKIE, path: activityCookieOptions.path });
  cookieStore.delete({ name: ACCOUNT_COOKIE, path: accountCookieOptions.path });
}

/** Switch only between enabled memberships of the current Google identity. */
export async function switchPortalAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const accountId = formData.get("accountId");
  const memberships = await getPortalMemberships();
  const target = memberships.find((account) => account.id === accountId);
  if (!target) return { error: "This account is no longer available to switch to. Refresh the page and try again." };
  (await cookies()).set(ACCOUNT_COOKIE, target.id, accountCookieOptions);
  revalidatePath("/portal", "layout");
  redirect(homeFor(target));
}

export async function logout() {
  await endSession();
  redirect("/portal/login");
}

/** A stale tab must never end a newer or remembered session based on its old browser timer. */
export async function logoutAfterTimeout() {
  const { data } = await (await createAuthClient()).auth.getClaims();
  const sessionId = data?.claims.session_id;
  if (typeof sessionId !== "string") redirect("/portal/login");
  const record = await decodeActivity((await cookies()).get(ACTIVITY_COOKIE)?.value, sessionId);
  const reason = record ? timeoutReason(record) : "expired";
  if (record && !reason) {
    return { startedAt: record.startedAt, lastActiveAt: record.lastActiveAt, remember: record.remember };
  }
  await endSession();
  redirect(`/portal/login?reason=${reason}`);
}
