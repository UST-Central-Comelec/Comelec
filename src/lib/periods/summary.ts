import { closingTime, isAccepting, type ApplicationPeriod } from "@/lib/applications/period";
import type { Unit } from "./kinds";

// Every unit has its own period, but the website's menu, its home page and each public page's
// banner say one thing: whether there's anything open at all, and until when. Free of server-only
// imports.

type UnitPeriod = ApplicationPeriod & { unit: Unit };

const closed: ApplicationPeriod = { mode: "closed", closesAt: null, graceEndsAt: null, updatedAt: null, updatedBy: null };

/**
 * One period standing for every unit's: open while any unit is. It reads as the Central Comelec's
 * while that's open; otherwise it closes when the last Local unit still open does, or has no closing
 * date if one of them has none.
 */
export function combinePeriods(periods: readonly UnitPeriod[], now = Date.now()): ApplicationPeriod {
  const open = periods.filter((period) => isAccepting(period, now));
  if (!open.length) return closed;
  const central = open.find((period) => period.unit.organizer === "central");
  if (central) return central;
  const closings = open.map(closingTime);
  if (closings.some((closing) => closing === null)) return { ...closed, mode: "open" };
  return { ...closed, mode: "scheduled", closesAt: new Date(Math.max(...(closings as number[]))).toISOString() };
}

/** The units taking submissions right now, the Central Comelec first, then by college. */
export function openUnits<T extends UnitPeriod>(periods: readonly T[], now = Date.now()): T[] {
  return periods
    .filter((period) => isAccepting(period, now))
    .sort((a, b) => Number(b.unit.organizer === "central") - Number(a.unit.organizer === "central") || (a.unit.college ?? "").localeCompare(b.unit.college ?? ""));
}

/** Which units an applicant can ask to serve in right now: the Central Comelec, and the colleges whose Local unit is recruiting. */
export type OpenBodies = { central: boolean; colleges: string[] };

export function openBodies(periods: readonly UnitPeriod[], now = Date.now()): OpenBodies {
  const open = openUnits(periods, now);
  return { central: open.some((period) => period.unit.organizer === "central"), colleges: open.flatMap((period) => (period.unit.organizer === "local" && period.unit.college ? [period.unit.college] : [])) };
}

/** Whether the unit an application is for is recruiting: the Central Comelec, or the applicant's own college's Local unit. */
export const isBodyOpen = (bodies: OpenBodies, preferredBody: string, college: string) => (preferredBody === "local" ? bodies.colleges.includes(college) : bodies.central);
