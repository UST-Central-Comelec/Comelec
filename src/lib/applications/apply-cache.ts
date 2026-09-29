import "server-only";

import { getOpenSlots } from "./interviews";
import { defaultPeriod } from "./period";
import { getApplicationPeriod } from "./period-store";
import { getSlots } from "./slots";

// The Apply page shows position and interview slot counts from Supabase, which costs a round trip
// or two on every visit. Those counts rarely change, so the page reuses them for a few seconds.
// Anything that changes them (portal edits, a new application) clears this straight away, and
// submitting re-checks against fresh counts, so a stale number can never let a full slot be booked.

const TTL_MS = 15_000;

type Entry<T> = { value: Promise<T>; expiresAt: number };
const entries = new Map<string, Entry<unknown>>();

function remember<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = entries.get(key) as Entry<T> | undefined;
  if (entry && entry.expiresAt > now) return entry.value;
  const value = load();
  entries.set(key, { value, expiresAt: now + TTL_MS });
  // Don't keep a failure around; the next visit tries again.
  value.catch(() => entries.delete(key));
  return value;
}

export const getSlotsForApplyPage = () => remember("position-slots", getSlots);
export const getInterviewsForApplyPage = () => remember("interview-slots", getOpenSlots);

/** Whether applications are open. Falls back to the original closing date until 0010 is run. */
export const getPeriodForApplyPage = () =>
  remember("period", getApplicationPeriod).catch((error) => {
    console.error(error);
    return defaultPeriod;
  });

/** Call after anything that changes slot counts or the application period. */
export function clearApplyPageCache() {
  entries.clear();
}
