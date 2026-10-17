import "server-only";

import { cookies } from "next/headers";
import { signJson, verifyJson } from "@/lib/security/signed-token";

// Signing up for the filing portal (to register a party, or to file a candidacy) and signing in to
// it all start with a UST Google account. Google returns to the applicant callback (/apply/verify),
// which Supabase already allows; a short-lived flow cookie tells it the sign-in is the filing
// portal's, and what for (./callback.ts). Signing up keeps a signed pass while the form is filled
// in: the form fills in (and locks) the email from it, and the server trusts only the pass's email.

const FLOW_COOKIE = "filing_verify_flow";
const FLOW_PURPOSE = "filing-flow";
export const FILING_PASS_COOKIE = "filing_verified";
const PASS_PURPOSE = "filing-pass";

/** Time to finish Google's sign-in once it's opened. */
const FLOW_LIFETIME_MS = 10 * 60_000;
/** Longer than filling in a form takes, its one-hour session included; after that they verify again. */
const PASS_LIFETIME_MS = 2 * 60 * 60_000;

/** "party": the Political Party Registration page; "candidacy": Filing of Candidacy; "login": the portal's sign-in. */
export type FilingFlowMode = "party" | "candidacy" | "login";
const modes: readonly FilingFlowMode[] = ["party", "candidacy", "login"];
export const isFlowMode = (value: unknown): value is FilingFlowMode => modes.includes(value as FilingFlowMode);

type Flow = { mode: FilingFlowMode; expiresAt: number };
export type FilingPass = { email: string; firstName: string; lastName: string; expiresAt: number };

const cookieOptions = (path: string, lifetimeMs: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path,
  maxAge: lifetimeMs / 1000,
});

/** Sent to the callback, which lives under /apply. */
const flowCookieOptions = cookieOptions("/apply", FLOW_LIFETIME_MS);
/** Read by the sign-up pages and the actions that make the account. */
export const filingPassCookieOptions = cookieOptions("/", PASS_LIFETIME_MS);

export async function startFilingFlow(mode: FilingFlowMode) {
  (await cookies()).set(FLOW_COOKIE, await signJson(FLOW_PURPOSE, { mode, expiresAt: Date.now() + FLOW_LIFETIME_MS } satisfies Flow), flowCookieOptions);
}

/** Whether the Google sign-in coming back was started for the filing portal, and what for. Reading it ends it. */
export async function takeFilingFlow(): Promise<FilingFlowMode | null> {
  const cookieStore = await cookies();
  const flow = await verifyJson<Flow>(FLOW_PURPOSE, cookieStore.get(FLOW_COOKIE)?.value);
  if (cookieStore.has(FLOW_COOKIE)) cookieStore.delete({ name: FLOW_COOKIE, path: flowCookieOptions.path });
  return flow && flow.expiresAt > Date.now() && isFlowMode(flow.mode) ? flow.mode : null;
}

/** Another verification is starting (an application, an event); an abandoned filing sign-in mustn't catch its callback. */
export async function endFilingFlow() {
  (await cookies()).delete({ name: FLOW_COOKIE, path: flowCookieOptions.path });
}

export function createFilingPass(pass: Omit<FilingPass, "expiresAt">) {
  return signJson(PASS_PURPOSE, { ...pass, expiresAt: Date.now() + PASS_LIFETIME_MS } satisfies FilingPass);
}

/** The sign-up's pass, if they verified and it hasn't expired or been tampered with. */
export async function readFilingPass(): Promise<FilingPass | null> {
  const pass = await verifyJson<FilingPass>(PASS_PURPOSE, (await cookies()).get(FILING_PASS_COOKIE)?.value);
  return pass && typeof pass.email === "string" && pass.expiresAt > Date.now() ? pass : null;
}

export async function clearFilingPass() {
  (await cookies()).delete({ name: FILING_PASS_COOKIE, path: filingPassCookieOptions.path });
}
