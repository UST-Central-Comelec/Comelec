import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { store } from "@/lib/data/store";
import type { AccountRole } from "@/lib/data/types";
import { ALLOWED_EMAIL_DOMAIN, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

// Who may use the portal.
//
// People sign in with Google through Supabase Auth, but signing in isn't enough: the email must be
// an @ust.edu.ph address AND match an active account that an executive added under Accounts.
// PORTAL_EXECUTIVE_EMAIL is the built-in Executive — it always has access and can't be revoked
// from the portal, so there's always someone able to add the first accounts.

export const BUILT_IN_ID = "built-in";

export type PortalUser = { id: string; name: string; email: string; role: AccountRole; builtIn: boolean };

export type AccessDenied = "not-ust" | "not-registered" | "revoked";

export function isLoginConfigured() {
  return isSupabaseConfigured() && Boolean(builtInEmail());
}

function builtInEmail() {
  return process.env.PORTAL_EXECUTIVE_EMAIL?.trim().toLowerCase() || null;
}

export function builtInUser(name?: string): PortalUser | null {
  const email = builtInEmail();
  return email ? { id: BUILT_IN_ID, name: name || process.env.PORTAL_EXECUTIVE_NAME || "Executive", email, role: "executive", builtIn: true } : null;
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
  return { user: { id: account.id, name: account.name, email: account.email, role: account.role, builtIn: false } };
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

/** For account management. Commissioners who reach an executive page are sent to the dashboard. */
export async function requireExecutive() {
  const user = await requirePortalUser();
  if (user.role !== "executive") redirect("/portal");
  return user;
}
