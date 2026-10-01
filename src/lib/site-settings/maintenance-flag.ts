import { isSupabaseConfigured, supabaseSecretKey, supabaseUrl } from "@/lib/supabase/config";

// The portal's maintenance switch (site_settings.maintenance), as src/proxy.ts reads it on every
// public page request. A plain REST call, checked at most once every few seconds per server, so
// switching it in the portal reaches visitors within that time.

const TTL_MS = 10_000;
/** A slow database must not hold up every page. */
const TIMEOUT_MS = 2_000;

let known = false;
let checkedAt = 0;
let checking: Promise<boolean> | null = null;

async function read(): Promise<boolean> {
  try {
    const key = supabaseSecretKey();
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/site_settings?select=maintenance&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // The table isn't there until migration 0018 is run: the site stays live.
    if (!response.ok) return false;
    const rows: unknown = await response.json();
    return Array.isArray(rows) && rows[0]?.maintenance === true;
  } catch {
    // Can't reach the database: keep what was last known rather than flipping the site on or off.
    return known;
  }
}

/** Whether the public website was put under maintenance from the portal. */
export async function isSiteUnderMaintenance(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (Date.now() - checkedAt < TTL_MS) return known;
  checking ??= read().then((value) => {
    known = value;
    checkedAt = Date.now();
    checking = null;
    return value;
  });
  return checking;
}
