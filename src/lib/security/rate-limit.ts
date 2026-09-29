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
 * The visitor's IP. Behind a host like Vercel, the first x-forwarded-for entry is the client
 * (set by the platform); locally it falls back to "local".
 */
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "local";
}

/** Limits used across the app, in one place. */
export const limits = {
  /** Google sign-in starts and callbacks. */
  login: { limit: 10, windowMs: 10 * 60_000 },
  /** Application submissions (each person needs one). */
  apply: { limit: 5, windowMs: 60 * 60_000 },
  /** Track application lookups; also stops guessing reference codes. */
  track: { limit: 10, windowMs: 15 * 60_000 },
  /** Every portal request, as a ceiling against floods from one address. */
  portal: { limit: 300, windowMs: 60_000 },
};
