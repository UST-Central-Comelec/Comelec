// Portal session timeouts, enforced on the server by src/proxy.ts (OWASP Session Management):
//   • idle: signed out after 30 minutes with no activity
//   • absolute: signed out 8 hours after signing in, active or not
// Someone who ticks "Keep me signed in" (their own device) has neither: they stay signed in until
// they've been away for 30 days. Access is still checked against Accounts on every request, so
// removing someone's access ends a remembered session on its next click all the same.
// A signed cookie records when this session started, when it was last active and whether it's
// remembered. It's tied to the Supabase session id, so it can't be carried over to another
// session, and the HMAC stops anyone from editing it to stay signed in.

import { signValue, verifyValue } from "./signed-token";

export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60_000;
/** A remembered session ends after this long away. */
export const REMEMBERED_TIMEOUT_MS = 30 * 24 * 60 * 60_000;
/** The client warns this long before an idle sign-out. */
export const IDLE_WARNING_MS = 2 * 60_000;

export const ACTIVITY_COOKIE = "portal_activity";
/** Carries the "Keep me signed in" choice across the trip to Google and back. */
export const REMEMBER_COOKIE = "portal_remember";

export type ActivityRecord = { sessionId: string; startedAt: number; lastActiveAt: number; remember: boolean };
/** "away": a remembered session left unused for 30 days. */
export type TimeoutReason = "idle" | "expired" | "away";

const PURPOSE = "portal-activity";

export function encodeActivity(record: ActivityRecord) {
  return signValue(PURPOSE, `${record.sessionId}.${record.startedAt}.${record.lastActiveAt}.${record.remember ? 1 : 0}`);
}

/** The record, or null if the cookie is missing, edited, or from another session. */
export async function decodeActivity(value: string | undefined, sessionId: string): Promise<ActivityRecord | null> {
  const payload = await verifyValue(PURPOSE, value);
  const parts = payload?.split(".") ?? [];
  // Sessions signed in before "Keep me signed in" existed have no fourth part: not remembered.
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [id, started, last, remember] = parts;
  if (id !== sessionId) return null;
  const startedAt = Number(started);
  const lastActiveAt = Number(last);
  return Number.isFinite(startedAt) && Number.isFinite(lastActiveAt) ? { sessionId: id, startedAt, lastActiveAt, remember: remember === "1" } : null;
}

/** Why this session should end now, or null if it's still fine. */
export function timeoutReason(record: ActivityRecord, now = Date.now()): TimeoutReason | null {
  if (record.remember) return now - record.lastActiveAt >= REMEMBERED_TIMEOUT_MS ? "away" : null;
  if (now - record.startedAt >= ABSOLUTE_TIMEOUT_MS) return "expired";
  if (now - record.lastActiveAt >= IDLE_TIMEOUT_MS) return "idle";
  return null;
}

export const activityCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/portal",
  maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
};

/** A remembered session's cookie outlives closing the browser for as long as the session lasts. */
export const activityCookieFor = (record: Pick<ActivityRecord, "remember">) =>
  record.remember ? { ...activityCookieOptions, maxAge: REMEMBERED_TIMEOUT_MS / 1000 } : activityCookieOptions;

/** Only for the sign-in round trip to Google, which takes a minute at most. */
export const rememberCookieOptions = { ...activityCookieOptions, maxAge: 15 * 60 };
