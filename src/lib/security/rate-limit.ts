// A small in-memory rate limiter (fixed window per key). It slows down scripted abuse of the
// public forms and the login flow from a single address. It lives in this server process's memory,
// so limits reset on restart and aren't shared between server instances; large-scale attacks
// (DDoS) have to be stopped in front of the app by the host or a CDN (e.g. Vercel Firewall,
// Cloudflare).

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = Date.now();

/** Forget expired windows now and then so memory doesn't grow with every address ever seen. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key);
}

/**
 * Counts one attempt for `key` and says whether it's allowed: at most `limit` per `windowMs`.
 * `retryAfter` is in seconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  window.count += 1;
  return { ok: window.count <= limit, retryAfter: Math.ceil((window.resetAt - now) / 1000) };
}

/**
 * The visitor's IP, from a header the visitor can't forge. A browser can send its own
 * x-forwarded-for, and a proxy only adds to the end of it, so the first entry is only trustworthy
 * where the host rewrites the whole header (Vercel). Elsewhere it's the last entry, the one the
 * proxy in front of this server added. Set CLIENT_IP_HEADER to read another header the proxy
 * overwrites instead (e.g. cf-connecting-ip behind Cloudflare). Locally it falls back to "local".
 */
export function clientIp(headers: Headers) {
  const trusted = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (trusted) return headers.get(trusted)?.split(",")[0]?.trim() || "local";
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return (process.env.VERCEL ? chain[0] : chain.at(-1)) || "local";
}

/** Limits used across the app, in one place. */
//
// Most limits are per address, and the campus network reaches the site from one address, so those
// are sized for a crowd (a meeting signing in at once, a class applying together), not one person.
export const limits = {
  /**
   * Google sign-in starts and callbacks. Google's own sign-in is what stops abuse; this is a ceiling
   * against scripts hammering the flow.
   */
  login: { limit: 150, windowMs: 10 * 60_000 },
  /**
   * Application and access request submissions. What keeps each person to one is the verified UST
   * account, not this.
   */
  apply: { limit: 60, windowMs: 60 * 60_000 },
  /**
   * Political party registrations. Only a handful of parties file, there's no verified account, and
   * each can carry 30 MB of uploads, so this stays low.
   */
  party: { limit: 10, windowMs: 60 * 60_000 },
  /**
   * Track application lookups. A lookup needs the reference code and the matching last name or
   * student number, so this still makes guessing codes impractical.
   */
  track: { limit: 100, windowMs: 15 * 60_000 },
  /**
   * Portal requests from one signed-in account. Someone working quickly sends 10–25 a minute (pages,
   * link prefetches, the bell's and sidebar's checks), so this only stops a runaway script or tab.
   */
  portal: { limit: 300, windowMs: 60_000 },
  /** Portal requests from one address, signed in or not: a ceiling against floods. */
  portalAddress: { limit: 3000, windowMs: 60_000 },
  /**
   * Google sign-in starts for event registration. A whole class can register at once from the
   * campus network, which reaches the site from one address, so this is a ceiling against scripts
   * (one a second, sustained) rather than a limit on any one person.
   */
  eventVerify: { limit: 600, windowMs: 10 * 60_000 },
  /**
   * Event registrations saved from one address, for the same reason. What keeps each person to one
   * registration is the verified pass (src/lib/events/verification.ts), not this.
   */
  eventRegister: { limit: 300, windowMs: 10 * 60_000 },
};
