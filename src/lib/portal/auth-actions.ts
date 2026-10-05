"use server";

import type { FormState } from "./form";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { endAccessFlow } from "@/lib/access-requests/verification";
import { revalidatePath } from "next/cache";
import { ACCOUNT_COOKIE, accountCookieOptions } from "./account-selection";
import { getPortalMemberships, homeFor, isLoginConfigured } from "@/lib/auth/session";
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
  // So the callback treats this as a portal sign-in, even after an abandoned Request access.
  await endAccessFlow();

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

/** Called by the portal when the idle or absolute timeout runs out in the browser. */
export async function logoutAfterTimeout(reason: TimeoutReason) {
  await endSession();
  redirect(`/portal/login?reason=${reason === "expired" ? "expired" : "idle"}`);
}
