// Portal session timeouts, enforced on the server by src/proxy.ts (OWASP Session Management):
//   • idle: signed out after 30 minutes with no activity
//   • absolute: signed out 8 hours after signing in, active or not
// A signed cookie records when this session started and was last active. It's tied to the
// Supabase session id, so it can't be carried over to another session, and the HMAC stops anyone
// from editing the times to stay signed in.

import { signValue, verifyValue } from "./signed-token";

export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60_000;
/** The client warns this long before an idle sign-out. */
export const IDLE_WARNING_MS = 2 * 60_000;

export const ACTIVITY_COOKIE = "portal_activity";

export type ActivityRecord = { sessionId: string; startedAt: number; lastActiveAt: number };
export type TimeoutReason = "idle" | "expired";

const PURPOSE = "portal-activity";

export function encodeActivity(record: ActivityRecord) {
  return signValue(PURPOSE, `${record.sessionId}.${record.startedAt}.${record.lastActiveAt}`);
}

/** The record, or null if the cookie is missing, edited, or from another session. */
export async function decodeActivity(value: string | undefined, sessionId: string): Promise<ActivityRecord | null> {
  const payload = await verifyValue(PURPOSE, value);
  const parts = payload?.split(".") ?? [];
  if (parts.length !== 3) return null;
  const [id, started, last] = parts;
  if (id !== sessionId) return null;
  const startedAt = Number(started);
  const lastActiveAt = Number(last);
  return Number.isFinite(startedAt) && Number.isFinite(lastActiveAt) ? { sessionId: id, startedAt, lastActiveAt } : null;
}

/** Why this session should end now, or null if it's still fine. */
export function timeoutReason(record: ActivityRecord, now = Date.now()): TimeoutReason | null {
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
