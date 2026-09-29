// Shared by the form, the portal and the emails: how interview slots look. All times are Manila time.

import type { DivisionId } from "./options";

export type InterviewMode = "online" | "onsite";

export const interviewModes: Record<InterviewMode, string> = { online: "Online", onsite: "On-site" };

/** A bookable slot as the apply form sees it. */
export type InterviewSlot = {
  id: string;
  /** Each division runs its own interviews. Null only for slots added before divisions existed. */
  division: DivisionId | null;
  startsAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  location: string | null;
  capacity: number;
  booked: number;
};

const zone = "Asia/Manila";

/** "2026-10-05": the Manila calendar day a slot falls on. */
export const slotDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Manila hour (0–23) and minute of a moment, as plain numbers. */
function manilaClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return { hour: part("hour") % 24, minute: part("minute") };
}

/**
 * "9:00 – 9:30 AM", or "11:30 AM – 12:00 PM" across noon. Built by hand rather than with
 * Intl's formatRange: Node and browsers space and punctuate that differently, and text that
 * differs between the server and the browser breaks React's hydration.
 */
export function slotTimeRange(startsAt: string, durationMinutes: number) {
  const start = manilaClock(new Date(startsAt));
  const end = manilaClock(new Date(new Date(startsAt).getTime() + durationMinutes * 60_000));
  const period = (hour: number) => (hour < 12 ? "AM" : "PM");
  const clock = ({ hour, minute }: { hour: number; minute: number }) => `${hour % 12 || 12}:${String(minute).padStart(2, "0")}`;
  return period(start.hour) === period(end.hour)
    ? `${clock(start)} – ${clock(end)} ${period(end.hour)}`
    : `${clock(start)} ${period(start.hour)} – ${clock(end)} ${period(end.hour)}`;
}

/** "Monday, October 5, 2026" */
export const slotDate = (iso: string) => new Intl.DateTimeFormat("en-PH", { timeZone: zone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));

/** "Monday, October 5, 2026, 9:00 – 9:30 AM · Online" */
export function describeSlot(slot: Pick<InterviewSlot, "startsAt" | "durationMinutes" | "mode" | "location">) {
  const where = [interviewModes[slot.mode], slot.location].filter(Boolean).join(", ");
  return `${slotDate(slot.startsAt)}, ${slotTimeRange(slot.startsAt, slot.durationMinutes)} · ${where}`;
}
