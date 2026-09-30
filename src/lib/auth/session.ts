import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { store } from "@/lib/data/store";
import type { AccountRole, Affiliation } from "@/lib/data/types";
import { ALLOWED_EMAIL_DOMAIN, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

// Who may use the portal.
//
// People sign in with Google through Supabase Auth, but signing in isn't enough: the email must be
// an @ust.edu.ph address AND match an active account that an executive added under Accounts.
// PORTAL_EXECUTIVE_EMAIL is the built-in Executive — it always has access and can't be revoked
// from the portal, so there's always someone able to add the first accounts.
//
// Each account is Central or Local (a college's Local Comelec). Local accounts only reach the
// Directory, Recruitment applications, PolPaR and Filing of Candidacy, and only their own college's
// people there: pages and Server Actions check with requireCentral and canSeeCollege below.

export const BUILT_IN_ID = "built-in";

export type PortalUser = { id: string; name: string; email: string; role: AccountRole; affiliation: Affiliation; college: string | null; builtIn: boolean };

export type AccessDenied = "not-ust" | "not-registered" | "revoked";

export function isLoginConfigured() {
  return isSupabaseConfigured() && Boolean(builtInEmail());
}

function builtInEmail() {
  return process.env.PORTAL_EXECUTIVE_EMAIL?.trim().toLowerCase() || null;
}

export function builtInUser(name?: string): PortalUser | null {
  const email = builtInEmail();
  return email ? { id: BUILT_IN_ID, name: name || process.env.PORTAL_EXECUTIVE_NAME || "Executive", email, role: "executive", affiliation: "central", college: null, builtIn: true } : null;
}

export function isBuiltInEmail(email: string) {
  return builtInEmail() === email.trim().toLowerCase();
}

export function isAllowedEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

/** Decides whether a Google-verified email may use the portal, and as whom. */
export async function checkAccess(emailInput: string, googleName?: string): Promise<{ user: PortalUser } | { denied: AccessDenied }> {
  const email = emailInput.trim().toLowerCase();
  if (!isAllowedEmail(email)) return { denied: "not-ust" };

  if (isBuiltInEmail(email)) return { user: builtInUser(googleName)! };

  const account = (await store.list("accounts")).find((item) => item.email === email);
  if (!account) return { denied: "not-registered" };
  if (!account.active) return { denied: "revoked" };
  // Executives are always Central, whatever the row says.
  const affiliation = account.role === "executive" ? "central" : (account.affiliation ?? "central");
  return { user: { id: account.id, name: account.name, email: account.email, role: account.role, affiliation, college: account.college ?? null, builtIn: false } };
}

/**
 * True when this session came from Google sign-in. Supabase Auth also allows email sign-up by
 * default; without this check, a session created that way for a commissioner's address would get in.
 */
function isGoogleSession(claims: { amr?: unknown; app_metadata?: { providers?: unknown } } | undefined) {
  const methods = Array.isArray(claims?.amr) ? claims.amr.map((entry) => (typeof entry === "string" ? entry : (entry as { method?: string }).method)) : [];
  const providers = Array.isArray(claims?.app_metadata?.providers) ? claims.app_metadata.providers : [];
  return methods.includes("oauth") && providers.includes("google");
}

/**
 * The signed-in portal user. Checked against Accounts on every request, so revoking access or
 * changing a role takes effect on their next click.
 */
export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  // Always per-request: never let a portal page be prerendered, even before Supabase is configured.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const { data } = await (await createAuthClient()).auth.getClaims();
  const email = data?.claims.email;
  if (typeof email !== "string" || !isGoogleSession(data?.claims)) return null;

  const metadata = data?.claims.user_metadata as { full_name?: string; name?: string } | undefined;
  const access = await checkAccess(email, metadata?.full_name ?? metadata?.name);
  return "user" in access ? access.user : null;
});

/** Use in every portal page and Server Action — the proxy redirect alone isn't a security boundary. */
export async function requirePortalUser() {
  const user = await getPortalUser();
  if (!user) redirect("/portal/login");
  return user;
}

/**
 * Waits for `load` (already started) alongside the access check instead of after it, so a page
 * waits for one Supabase round trip rather than two. The data is only handed back once access is
 * confirmed; if access is denied, the redirect wins and the data is dropped.
 */
export async function withPortalUser<T>(load: Promise<T>, check: () => Promise<PortalUser> = requirePortalUser): Promise<[PortalUser, T]> {
  load.catch(() => {}); // Rethrown below, after the access check.
  const user = await check();
  return [user, await load];
}

/** Where a Local account lands: the first tab it can see. */
export const LOCAL_HOME = "/portal/members";

export const isLocal = (user: PortalUser) => user.affiliation === "local";

/** For pages and actions only Central accounts use (News, Documents, commission-wide settings). Local accounts are sent to their home tab. */
export async function requireCentral() {
  const user = await requirePortalUser();
  if (isLocal(user)) redirect(LOCAL_HOME);
  return user;
}

/** Whether `user` may see or manage someone from `college`: Central sees everyone, Local only its own college. */
export function canSeeCollege(user: PortalUser, college: string) {
  return !isLocal(user) || (user.college !== null && user.college === college);
}

/** For account management. Commissioners who reach an executive page are sent to the dashboard. */
export async function requireExecutive() {
  const user = await requirePortalUser();
  if (user.role !== "executive") redirect("/portal");
  return user;
}
