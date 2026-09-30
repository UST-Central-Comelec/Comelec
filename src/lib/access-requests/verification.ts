import "server-only";

import { cookies } from "next/headers";
import { signJson, verifyJson } from "@/lib/security/signed-token";
import type { AccessProfile, AccessStep } from "./channel";

// Requesting portal access proves the UST Google account twice, like the applicant pass
// (src/lib/applications/verification.ts), and nobody stays signed in either time:
//   • before the form: Google sign-in, then a signed pass holding the verified email;
//   • on submit: Google sign-in again with the same account, then a signed confirmation that's
//     only good for a few minutes. The server saves a request only with both, for the same email.
// Both Google sign-ins return to the portal's own callback (already allowed in Supabase); a short-
// lived flow cookie tells it the sign-in is for a request, not for the portal.

const PASS_COOKIE = "portal_access_pass";
const CONFIRM_COOKIE = "portal_access_confirmed";
const FLOW_COOKIE = "portal_access_flow";

const PASS_LIFETIME_MS = 2 * 60 * 60_000;
/** Time from confirming in the popup to the form submitting, with room for a slow connection. */
const CONFIRM_LIFETIME_MS = 5 * 60_000;
/** Time to finish Google's sign-in once it's opened. */
const FLOW_LIFETIME_MS = 10 * 60_000;

export type AccessPass = AccessProfile & { id: string; expiresAt: number };
type Confirmation = { passId: string; email: string; expiresAt: number };
type Flow = { step: AccessStep; expiresAt: number };

const cookieOptions = (lifetimeMs: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/portal",
  maxAge: lifetimeMs / 1000,
});

async function read<T extends { expiresAt: number }>(purpose: string, name: string) {
  const value = await verifyJson<T>(purpose, (await cookies()).get(name)?.value);
  return value && typeof value.expiresAt === "number" && value.expiresAt > Date.now() ? value : null;
}

async function write(purpose: string, name: string, data: object, lifetimeMs: number) {
  (await cookies()).set(name, await signJson(purpose, { ...data, expiresAt: Date.now() + lifetimeMs }), cookieOptions(lifetimeMs));
}

const remove = async (name: string) => (await cookies()).delete({ name, path: "/portal" });

export const readAccessPass = () => read<AccessPass>("access-pass", PASS_COOKIE);
export const createAccessPass = (profile: AccessProfile) => write("access-pass", PASS_COOKIE, { ...profile, id: crypto.randomUUID() }, PASS_LIFETIME_MS);

export async function confirmAccessPass(pass: AccessPass) {
  await write("access-confirm", CONFIRM_COOKIE, { passId: pass.id, email: pass.email }, CONFIRM_LIFETIME_MS);
}

/** True when the account behind `pass` was confirmed with Google in the last few minutes. */
export async function isConfirmed(pass: AccessPass) {
  const confirmation = await read<Confirmation>("access-confirm", CONFIRM_COOKIE);
  return Boolean(confirmation && confirmation.passId === pass.id && confirmation.email === pass.email);
}

/** "Use a different account", and after a request is saved: one request per verification. */
export async function clearAccessVerification() {
  await Promise.all([remove(PASS_COOKIE), remove(CONFIRM_COOKIE)]);
}

export const startAccessFlow = (step: AccessStep) => write("access-flow", FLOW_COOKIE, { step }, FLOW_LIFETIME_MS);

/** The step a Google sign-in was started for, if it was started from Request access. Reading it ends it. */
export async function takeAccessFlow() {
  const flow = await read<Flow>("access-flow", FLOW_COOKIE);
  if ((await cookies()).has(FLOW_COOKIE)) await remove(FLOW_COOKIE);
  return flow && (flow.step === "verify" || flow.step === "confirm") ? flow.step : null;
}

/** A portal sign-in is starting; make sure a request's leftover flow doesn't catch its callback. */
export const endAccessFlow = () => remove(FLOW_COOKIE);
