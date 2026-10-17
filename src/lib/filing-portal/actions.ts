"use server";

import { redirect } from "next/navigation";
import { listJoinableParties } from "@/lib/party-portal/store";
import type { JoinableParty } from "@/lib/party-portal/types";
import { findAccountByEmail, markNoticesRead } from "./accounts";
import { endFilingSession, requireFilingAccount } from "./session";
import type { ProfileSummary } from "./types";
import { clearFilingPass, readFilingPass } from "./verification";

// The filing portal's own actions: what a sign-up form loads once its person is verified, signing
// out, and reading the notifications. Each checks who's asking first.

export type SignUpContext = { profile: ProfileSummary | null; parties: JoinableParty[] };

/**
 * After verifying with Google: the profile this account already has (About you then only shows it),
 * and the parties to pick: pending ones to join, or accredited ones to run under. Only after
 * verifying, so the lists aren't open to anyone.
 */
export async function loadSignUpContext(purpose: "party" | "candidacy"): Promise<SignUpContext> {
  const pass = await readFilingPass();
  if (!pass) return { profile: null, parties: [] };
  const [account, parties] = await Promise.all([findAccountByEmail(pass.email), listJoinableParties(purpose === "party" ? "pending" : "accredited")]);
  return { profile: account && profileOf(account), parties };
}

const profileOf = (account: ProfileSummary): ProfileSummary => ({
  email: account.email, lastName: account.lastName, firstName: account.firstName, middleName: account.middleName, studentNumber: account.studentNumber,
  mobileNumber: account.mobileNumber, facebookUrl: account.facebookUrl, college: account.college, program: account.program, yearLevel: account.yearLevel,
});

/** Forgets the verified UST account, to start again with another. */
export async function forgetFilingVerification(purpose: "party" | "candidacy") {
  await clearFilingPass();
  redirect(purpose === "party" ? "/party-registration" : "/candidacy");
}

export async function signOutOfFiling() {
  await endFilingSession();
  redirect("/filing/login");
}

/** Marks the notifications read. The page keeps showing which were new; the sidebar's count clears in the browser. */
export async function markFilingNoticesRead() {
  const { account } = await requireFilingAccount();
  await markNoticesRead(account.id);
}
