// Shared by the cookie notice (src/components/cookie-notice.tsx) and the cookie policy
// (src/app/(site)/cookies/page.tsx).

/** Where the browser remembers that the notice was dismissed. Listed in the policy itself. */
export const COOKIE_NOTICE_KEY = "comelec:cookie-notice";

/**
 * The day the policy last changed. Dismissing the notice stores this date, so changing it brings
 * the notice back once for everyone: do that whenever a cookie is added, removed or repurposed.
 */
export const COOKIE_POLICY_UPDATED = "2026-10-01";

/**
 * What dismissing the notice stores. It also changes when an executive presses "Show again to
 * everyone" in the portal (Maintenance), which brings the notice back the same way.
 */
export const cookieNoticeVersion = (resetAt: string | null) => (resetAt ? `${COOKIE_POLICY_UPDATED}/${resetAt}` : COOKIE_POLICY_UPDATED);
