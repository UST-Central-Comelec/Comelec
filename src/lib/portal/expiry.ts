// When commissioners' portal access ends: the end-of-school-year clean-up, set under
// Accounts → Expiration. Free of server-only imports, so pages and forms share the wording.

import { isCommissionerPosition, type AccountKind, type AccountPosition } from "@/lib/data/types";

/** Until supabase/migrations/0023 is run, and whenever the saved date can't be read. */
export const DEFAULT_EXPIRY = "2027-06-30";

/** Commissioners' accounts expire. Official accounts, advisers and admins don't. */
export const expires = (account: { kind: AccountKind; position: AccountPosition }) => account.kind === "personal" && isCommissionerPosition(account.position);

/** The moment access ends: the end of that day in the Philippines. */
export const expiryEnd = (date: string) => new Date(`${date}T23:59:59.999+08:00`).getTime();

/** Whether that day has ended. */
export const hasExpired = (date: string, now = Date.now()) => expiryEnd(date) <= now;

/** "June 30, 2027". */
export const formatExpiry = (date: string) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "Asia/Manila" });

/** "in 271 days", "tomorrow", "today", or "passed". */
export function timeLeft(date: string, now = Date.now()) {
  const days = Math.ceil((expiryEnd(date) - now) / 86_400_000) - 1;
  if (days < 0) return "passed";
  return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days.toLocaleString("en-US")} days`;
}
