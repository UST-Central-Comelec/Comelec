import "server-only";

import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/portal/account-selection";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import type { AccountAffiliation, AccountKind, AccountPosition, AccountSummary } from "@/lib/data/types";
import { FULL_ACCESS, accessLevelOf, homeOf, isViewerLevel, tabHref, tabKeys, tabsFor, type AccessLevel, type AccessOverrides, type TabKey } from "@/lib/portal/access";
import { getAccessOverrides } from "@/lib/portal/access-store";
import { sweepExpiredAccounts } from "@/lib/portal/expiry-store";
import { ALLOWED_EMAIL_DOMAIN, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, createAuthClient } from "@/lib/supabase/server";

// Who may use the portal.
//
// People sign in with Google through Supabase Auth, but signing in isn't enough: the email must be
// an @ust.edu.ph address AND match an active account added under Accounts.
// PORTAL_EXECUTIVE_EMAIL is the built-in executive: it always has access, to everything, and can't
// be revoked from the portal, so there's always someone able to add the first accounts.
//
// What an account may do comes in three parts, checked by pages and Server Actions:
//   • which tabs it may open: its kind, affiliation and position put it in a level, and each level
//     has its tabs (src/lib/portal/access.ts) — requireAccess below;
//   • whose records it sees there: a Local account only its own college's — isLocal and
//     canSeeCollege below;
//   • whether it may change anything: Advisers and Admins only read — requireEditor below, which
//     every Server Action uses in place of requireAccess.

export const BUILT_IN_ID = "built-in";

export type PortalUser = {
  id: string;
  name: string;
  /** Their first name, where the account has its name in parts. Empty for an official account, and for one added before accounts had them. */
  firstName: string;
  email: string;
  /** A person's own account, or a unit's official one (which acts as its unit's Executive Board). */
  kind: AccountKind;
  affiliation: AccountAffiliation;
  position: AccountPosition;
  /** "Chairperson", "Office of the Chairperson", "Deputy"; empty until it's picked under Accounts. */
  role: string;
  college: string | null;
  level: AccessLevel;
  /** The tabs this account may open. */
  tabs: readonly TabKey[];
  /** An Adviser or Admin: opens its tabs to read them, and changes nothing. */
  readOnly: boolean;
  builtIn: boolean;
  avatarUrl?: string | null;
};

export type AccessDenied = "not-ust" | "not-registered" | "revoked";

export function isLoginConfigured() {
  return isSupabaseConfigured() && Boolean(builtInEmail());
}

function builtInEmail() {
  return process.env.PORTAL_EXECUTIVE_EMAIL?.trim().toLowerCase() || null;
}

/**
 * The built-in executive: always Central Executive Board, with everything open. `profile` is its own
 * row under Accounts, if it has one (its details, to show in the Directory, or the Central Comelec's
 * official account); the row's kind, position, affiliation and access never limit it.
 */
export function builtInUser(name?: string, profile?: AccountSummary | null): PortalUser | null {
  const email = builtInEmail();
  if (!email) return null;
  return {
    id: profile?.id ?? BUILT_IN_ID,
    name: profile?.name || name || process.env.PORTAL_EXECUTIVE_NAME || "Executive",
    firstName: profile?.firstName ?? "",
    email,
    kind: profile?.kind ?? "personal",
    affiliation: "central",
    position: "executive-board",
    role: profile?.role ?? "",
    college: profile?.college ?? null,
    level: FULL_ACCESS,
    tabs: tabKeys,
    readOnly: false,
    builtIn: true,
  };
}

function toUser(account: AccountSummary, overrides: AccessOverrides): PortalUser {
  const { id, name, firstName, email, kind, affiliation, position, role, college } = account;
  const level = accessLevelOf(account);
  return { id, name, firstName, email, kind, affiliation, position, role, college, level, tabs: tabsFor(account, overrides), readOnly: isViewerLevel(level), builtIn: false };
}

export function isBuiltInEmail(email: string) {
  return builtInEmail() === email.trim().toLowerCase();
}

export function isAllowedEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

/** Decides whether a Google-verified email may use the portal, and as whom. */
export async function checkAccess(emailInput: string, googleName?: string, selectedAccountId?: string): Promise<{ user: PortalUser } | { denied: AccessDenied }> {
  const email = emailInput.trim().toLowerCase();
  if (!isAllowedEmail(email)) return { denied: "not-ust" };

  // The end-of-school-year clean-up, if its date has passed, before anyone is let in.
  await sweepExpiredAccounts(builtInEmail());
  const [accounts, overrides] = await Promise.all([store.list("accounts"), getAccessOverrides()]);
  const memberships = accounts.filter((item) => item.email.trim().toLowerCase() === email).map(toSummary);
  // A cookie can select only an active membership belonging to this authenticated email.
  const selected = memberships.find((item) => item.active && item.id === selectedAccountId);
  const central = memberships.find((item) => item.active && item.affiliation === "central");
  const account = selected ?? central ?? memberships.find((item) => item.active) ?? memberships[0] ?? null;
  // The built-in executive's Central account keeps its guaranteed access; its Local account has
  // the same college scope and permissions as any other Local membership.
  if (isBuiltInEmail(email) && (!selected || selected.affiliation === "central")) {
    const profile = memberships.find((item) => item.affiliation === "central") ?? null;
    return { user: builtInUser(googleName, profile)! };
  }

  if (!account) return { denied: "not-registered" };
  if (!account.active) return { denied: "revoked" };
  return { user: toUser(account, overrides) };
}

/**
 * True when this session came from Google sign-in. Supabase Auth also allows email sign-up by
 * default; without this check, a session created that way for a commissioner's address would get in.
 */
export function isGoogleSession(claims: { amr?: unknown; app_metadata?: { providers?: unknown } } | undefined) {
  const methods = Array.isArray(claims?.amr) ? claims.amr.map((entry) => (typeof entry === "string" ? entry : (entry as { method?: string }).method)) : [];
  const providers = Array.isArray(claims?.app_metadata?.providers) ? claims.app_metadata.providers : [];
  return methods.includes("oauth") && providers.includes("google");
}

/**
 * Called when someone signs in with Google. An account added by hand has its email verified from
 * its first sign-in; one that's already verified is left as it is.
 */
export async function markEmailVerified(email: string) {
  const { error } = await createAdminClient().from("portal_accounts").update({ email_verified_at: new Date().toISOString() }).eq("email", email.trim().toLowerCase()).is("email_verified_at", null);
  // Before supabase/migrations/0021 there's no such column. Signing in mustn't fail over it.
  if (error) console.error("Couldn’t mark the email as verified:", error.message);
}

/** The Google profile picture from the session, or null. Only Google's own image host is accepted, since it goes straight into an `<img>`. */
function googleAvatar(value: unknown) {
  if (typeof value !== "string" || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com") ? url.href : null;
}

/**
 * The signed-in portal user. Checked against Accounts and the access control on every request, so
 * revoking access, changing a position or switching a tab off takes effect on their next click.
 */
export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  // Always per-request: never let a portal page be prerendered, even before Supabase is configured.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const { data } = await (await createAuthClient()).auth.getClaims();
  const email = data?.claims.email;
  if (typeof email !== "string" || !isGoogleSession(data?.claims)) return null;

  const metadata = data?.claims.user_metadata as { full_name?: string; name?: string; avatar_url?: unknown; picture?: unknown } | undefined;
  const selectedAccountId = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  const access = await checkAccess(email, metadata?.full_name ?? metadata?.name, selectedAccountId);
  return "user" in access ? { ...access.user, avatarUrl: googleAvatar(metadata?.avatar_url ?? metadata?.picture) } : null;
});

/** Active memberships for the authenticated Google email, for the profile menu and switch action. */
export async function getPortalMemberships(): Promise<PortalUser[]> {
  const user = await requirePortalUser();
  const [accounts, overrides] = await Promise.all([store.list("accounts"), getAccessOverrides()]);
  const own = accounts.map(toSummary).filter((account) => account.email.trim().toLowerCase() === user.email.trim().toLowerCase());
  const memberships = own.filter((account) => account.active).map((account) => isBuiltInEmail(user.email) && account.affiliation === "central"
    ? builtInUser(undefined, account)!
    : toUser(account, overrides));
  if (isBuiltInEmail(user.email) && !memberships.some((account) => account.builtIn)) memberships.unshift(builtInUser(undefined, own.find((account) => account.affiliation === "central"))!);
  return memberships.sort((a, b) => Number(b.affiliation === "central") - Number(a.affiliation === "central"));
}

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

export const isLocal = (user: Pick<PortalUser, "affiliation">) => user.affiliation === "local";

/** Whether `user` may see or manage someone from `college`: Central sees everyone, Local only its own college. */
export function canSeeCollege(user: PortalUser, college: string) {
  return !isLocal(user) || (user.college !== null && user.college === college);
}

export const canOpen = (user: PortalUser, tab: TabKey) => user.tabs.includes(tab);

/** Where `user` lands: the Dashboard, or the first tab open to them. */
export const homeFor = (user: PortalUser) => homeOf(user.tabs);

/**
 * For every page and Server Action under a tab: the signed-in account, if `tab` is open to it.
 * Anyone else is sent to where they land, so a tab switched off for a level simply isn't there.
 */
export async function requireAccess(tab: TabKey) {
  const user = await requirePortalUser();
  if (!canOpen(user, tab)) redirect(homeFor(user));
  return user;
}

/**
 * For every Server Action that changes something under a tab: `requireAccess`, and not an Adviser
 * or Admin. Pages don't offer them the forms; one sent anyway lands them back on the tab.
 */
export async function requireEditor(tab: TabKey) {
  const user = await requireAccess(tab);
  if (user.readOnly) redirect(tabHref(tab));
  return user;
}

/** `requireAccess` as withPortalUser's check: `withPortalUser(load, allowed("news"))`. */
export const allowed = (tab: TabKey) => () => requireAccess(tab);

/** For Accounts → Access Control, where access itself is changed: the Central Executive Board only. */
export async function requireFullAccess() {
  const user = await requirePortalUser();
  if (user.level !== FULL_ACCESS) redirect(homeFor(user));
  return user;
}
