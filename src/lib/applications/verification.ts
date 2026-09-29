import "server-only";

import { cookies } from "next/headers";
import { signJson, verifyJson } from "@/lib/security/signed-token";

// Applicants prove they have a UST Google account right after giving consent. They sign in with
// Google once, the server checks the email is @ust.edu.ph, and the Google session is ended straight
// away; what's kept is this signed, short-lived pass. The form fills in (and locks) the email from
// it, and the server trusts only the pass's email when saving the application.

export const PASS_COOKIE = "apply_verified";
const PURPOSE = "applicant-pass";
/** Comfortably longer than filling in the form takes; after that they verify again. */
export const PASS_LIFETIME_MS = 6 * 60 * 60_000;

export type ApplicantPass = { email: string; firstName: string; lastName: string; consentAt: number; expiresAt: number };

export const passCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/apply",
  maxAge: PASS_LIFETIME_MS / 1000,
};

export function createPass(pass: Omit<ApplicantPass, "expiresAt">) {
  return signJson(PURPOSE, { ...pass, expiresAt: Date.now() + PASS_LIFETIME_MS } satisfies ApplicantPass);
}

/** The applicant's pass, if they verified and it hasn't expired or been tampered with. */
export async function readPass(): Promise<ApplicantPass | null> {
  const pass = await verifyJson<ApplicantPass>(PURPOSE, (await cookies()).get(PASS_COOKIE)?.value);
  return pass && typeof pass.email === "string" && pass.expiresAt > Date.now() ? pass : null;
}

export async function clearPass() {
  (await cookies()).delete({ name: PASS_COOKIE, path: passCookieOptions.path });
}
