import "server-only";

import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { combinePeriods, openBodies } from "@/lib/periods/summary";
import { getOpenSlots } from "./interviews";
import { getSlots, getUnitSlots } from "./slots";

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

export const getUnitSlotsForApplyPage = () => remember("unit-position-slots", getUnitSlots);
export const getSlotsForApplyPage = () => remember("position-slots", getSlots);
export const getInterviewsForApplyPage = () => remember("interview-slots", getOpenSlots);

/** Every unit's recruitment period. One that can't be read counts as closed rather than breaking the page. */
const getRecruitmentPeriods = () => remember("periods", () => listUnitPeriodsForSite("recruitment"));

/**
 * Whether applications are open, as the site says it in one line: open while any unit is recruiting
 * (src/lib/periods/summary.ts). Each unit opens and closes its own under Recruitment → Settings.
 */
export const getPeriodForApplyPage = async () => combinePeriods(await getRecruitmentPeriods());

/** Which units an applicant can ask to serve in right now. */
export const getOpenBodiesForApplyPage = async () => openBodies(await getRecruitmentPeriods());

/** Call after anything that changes slot counts or the application period. */
export function clearApplyPageCache() {
  entries.clear();
}
