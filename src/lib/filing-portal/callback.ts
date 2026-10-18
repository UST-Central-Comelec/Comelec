import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { finishPage } from "@/lib/applications/verification-page";
import { checkAccess, isAllowedEmail } from "@/lib/auth/session";
import { candidacyOfAccount } from "@/lib/candidacy/store";
import { membershipOfAccount } from "@/lib/party-portal/store";
import { createAdminClient, createAuthClient } from "@/lib/supabase/server";
import { findAccountByEmail } from "./accounts";
import { FILING_CHANNEL, type FilingVerifiedProfile, type FilingVerifyMessage, type FilingVerifyStatus } from "./channel";
import { startFilingSession } from "./session";
import { createFilingPass, FILING_PASS_COOKIE, filingPassCookieOptions, type FilingFlowMode } from "./verification";

type Metadata = { full_name?: string; name?: string; given_name?: string; family_name?: string };

const pages = { party: "/party-registration", candidacy: "/candidacy" } as const;

/** A sign-up popup's last page. Opened without a popup, it goes back to the form's page. */
export function filingFinishPage(mode: "party" | "candidacy", status: FilingVerifyStatus, profile: FilingVerifiedProfile | null = null) {
  return finishPage({
    channel: FILING_CHANNEL,
    message: { status, profile } satisfies FilingVerifyMessage,
    ok: status === "ok" || status === "has-account",
    fallback: `${pages[mode]}?verify=${status}`,
    backLabel: mode === "party" ? "Back to registration" : "Back to your filing",
  });
}

/**
 * Google sends people back to the applicant callback; when the sign-in was started for the filing
 * portal, the callback hands over here. Like applicant verification, the Google session ends
 * straight away. Signing in starts a filing portal session. Signing up keeps a signed pass for the
 * form, or, for someone who has already filed that application, signs them in.
 */
export async function finishFilingVerification(request: NextRequest, code: string | null, mode: FilingFlowMode) {
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/filing/login?error=${error}`, request.nextUrl));
  const failed = (status: FilingVerifyStatus) => (mode === "login" ? toLogin(status) : filingFinishPage(mode, status));
  if (!code) return failed("failed");

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data?.user?.email?.trim().toLowerCase();
  const metadata = { ...(data?.user?.identities?.[0]?.identity_data ?? {}), ...(data?.user?.user_metadata ?? {}) } as Metadata;
  await supabase.auth.signOut({ scope: "local" });

  // Keep no sign-in record for the filing portal: it has its own session. Commissioners' records
  // stay, since they sign in to the commission portal with the same accounts.
  if (data?.user && (!email || !("user" in (await checkAccess(email))))) {
    const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(data.user.id);
    if (deleteError) console.error("Couldn’t delete the filer’s sign-in record:", deleteError.message);
  }

  if (error || !email) return failed("failed");
  if (!isAllowedEmail(email)) return failed("not-ust");

  let account;
  try {
    account = await findAccountByEmail(email);
  } catch (lookupError) {
    console.error("Couldn’t look up the filing portal account:", lookupError);
    return failed("unavailable");
  }

  // Suspended by the commission: no session, whichever way they came in.
  if (account?.suspendedAt) return mode === "login" ? toLogin("suspended") : failed("failed");

  if (mode === "login") {
    if (!account) return toLogin("not-registered");
    await startFilingSession(account);
    return NextResponse.redirect(new URL("/filing", request.nextUrl));
  }

  const profile = { email, firstName: metadata.given_name?.trim() ?? "", lastName: metadata.family_name?.trim() ?? "" };
  // Already filed this application: signed in, and the form offers the way to the portal.
  const filed = account && (mode === "party" ? await membershipOfAccount(account.id) : await candidacyOfAccount(account.id));
  if (account && filed) {
    await startFilingSession(account);
    return filingFinishPage(mode, "has-account", profile);
  }
  const response = filingFinishPage(mode, "ok", profile);
  response.cookies.set(FILING_PASS_COOKIE, await createFilingPass(profile), filingPassCookieOptions);
  return response;
}
