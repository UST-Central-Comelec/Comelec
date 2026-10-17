import { signJson, verifyJson } from "@/lib/security/signed-token";

// The filing portal's session, in a signed cookie. Political parties' members and candidates prove
// their UST Google account the way applicants do (src/lib/applications/verification.ts): Google
// once, the Google session ended at once, and this cookie kept instead. So nobody in the filing
// portal holds a Supabase session, and it never mixes with the commission portal's. Read by
// src/proxy.ts (timeouts, kept fresh on each visit) and ./session.ts (whose account it is, checked
// against the database on every request). No server-only imports: the proxy uses it.

export const FILING_SESSION_COOKIE = "filing_session";
const PURPOSE = "filing-session";

/** Like the commission portal: signed out after 30 minutes idle, and 8 hours after signing in. */
export const FILING_IDLE_MS = 30 * 60_000;
export const FILING_ABSOLUTE_MS = 8 * 60 * 60_000;

export type FilingSession = { accountId: string; email: string; startedAt: number; lastActiveAt: number };

export const filingSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/filing",
  maxAge: FILING_ABSOLUTE_MS / 1000,
};

export const encodeFilingSession = (session: FilingSession) => signJson(PURPOSE, session);

/** The session, or null if the cookie is missing, edited, or not one of ours. */
export async function decodeFilingSession(value: string | undefined): Promise<FilingSession | null> {
  const session = await verifyJson<FilingSession>(PURPOSE, value);
  if (!session || typeof session.accountId !== "string" || typeof session.email !== "string") return null;
  return Number.isFinite(session.startedAt) && Number.isFinite(session.lastActiveAt) ? session : null;
}

/** Why this session should end now, or null if it's still fine. */
export function filingTimeout(session: FilingSession, now = Date.now()): "idle" | "expired" | null {
  if (now - session.startedAt >= FILING_ABSOLUTE_MS) return "expired";
  if (now - session.lastActiveAt >= FILING_IDLE_MS) return "idle";
  return null;
}
