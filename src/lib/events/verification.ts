import "server-only";

import { cookies } from "next/headers";
import { signJson, verifyJson } from "@/lib/security/signed-token";
import { isEventId } from "./options";

// Registering for an event starts by proving a UST Google account, like applying to be a
// commissioner (src/lib/applications/verification.ts): the student signs in with Google once, the
// server checks the email is @ust.edu.ph, and the Google session is ended straight away. What's kept
// is a signed, short-lived pass for that one event. The form shows who it's for, and the server
// trusts only the pass's email when saving the registration.
//
// Google returns to the applicant callback (/apply/verify), which Supabase already allows; a
// short-lived flow cookie tells it the sign-in is for an event, and which one.

export const EVENT_PASS_COOKIE = "event_verified";
const FLOW_COOKIE = "event_verify_flow";

const PASS_PURPOSE = "event-pass";
const FLOW_PURPOSE = "event-flow";

/** Longer than filling in the form takes; after that they verify again. */
const PASS_LIFETIME_MS = 60 * 60_000;
/** Time to finish Google's sign-in once it's opened. */
const FLOW_LIFETIME_MS = 10 * 60_000;

export type EventPass = { eventId: string; email: string; firstName: string; lastName: string; expiresAt: number };
type Flow = { eventId: string; expiresAt: number };

const cookieOptions = (path: string, lifetimeMs: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path,
  maxAge: lifetimeMs / 1000,
});

export const eventPassCookieOptions = cookieOptions("/events", PASS_LIFETIME_MS);
/** Sent to the callback, which lives under /apply. */
const flowCookieOptions = cookieOptions("/apply", FLOW_LIFETIME_MS);

export function createEventPass(pass: Omit<EventPass, "expiresAt">) {
  return signJson(PASS_PURPOSE, { ...pass, expiresAt: Date.now() + PASS_LIFETIME_MS } satisfies EventPass);
}

/** The visitor's pass for `eventId`, if they verified for it and it hasn't expired or been tampered with. */
export async function readEventPass(eventId: string): Promise<EventPass | null> {
  const pass = await verifyJson<EventPass>(PASS_PURPOSE, (await cookies()).get(EVENT_PASS_COOKIE)?.value);
  return pass && typeof pass.email === "string" && pass.eventId === eventId && pass.expiresAt > Date.now() ? pass : null;
}

/** After a registration is saved: one registration per verification. */
export async function clearEventPass() {
  (await cookies()).delete({ name: EVENT_PASS_COOKIE, path: eventPassCookieOptions.path });
}

export async function startEventFlow(eventId: string) {
  (await cookies()).set(FLOW_COOKIE, await signJson(FLOW_PURPOSE, { eventId, expiresAt: Date.now() + FLOW_LIFETIME_MS } satisfies Flow), flowCookieOptions);
}

/** The event a Google sign-in was started for, if it was started from an event's Register button. Reading it ends it. */
export async function takeEventFlow() {
  const cookieStore = await cookies();
  const flow = await verifyJson<Flow>(FLOW_PURPOSE, cookieStore.get(FLOW_COOKIE)?.value);
  if (cookieStore.has(FLOW_COOKIE)) cookieStore.delete({ name: FLOW_COOKIE, path: flowCookieOptions.path });
  return flow && flow.expiresAt > Date.now() && isEventId(flow.eventId) ? flow.eventId : null;
}

/** An applicant's verification is starting; make sure an abandoned event sign-in doesn't catch its callback. */
export async function endEventFlow() {
  (await cookies()).delete({ name: FLOW_COOKIE, path: flowCookieOptions.path });
}
