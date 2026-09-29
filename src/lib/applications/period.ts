// Shared by the Apply page, the portal and the server: whether commissioner applications are open.
// Set in the portal (Recruitment → Settings), stored in public.recruitment_settings
// (supabase/migrations/0010_application_period.sql). All times are Manila time.

export type PeriodMode = "scheduled" | "open" | "closed";

export const periodModes: Record<PeriodMode, string> = {
  scheduled: "Close on a set date",
  open: "Keep open",
  closed: "Close now",
};

export const isPeriodMode = (value: unknown): value is PeriodMode => typeof value === "string" && value in periodModes;

export type ApplicationPeriod = {
  mode: PeriodMode;
  /** When a scheduled period closes. Kept in the other modes so switching back remembers it. */
  closesAt: string | null;
  /** For 'closed': when it really closes, after the grace period. Null: closed straight away. */
  graceEndsAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Used before 0010 is run: the closing date the site had before this setting existed. */
export const defaultPeriod: ApplicationPeriod = { mode: "scheduled", closesAt: "2026-10-29T15:59:59.000Z", graceEndsAt: null, updatedAt: null, updatedBy: null };

/** Closing from the portal waits this long, so anyone partway through the form can still submit. */
export const CLOSE_GRACE_MINUTES = 5;

/**
 * When applications close on their own, as a timestamp: the scheduled time, or the end of a closing
 * grace period. Null when there's nothing to count down to.
 */
export function closingTime(period: ApplicationPeriod) {
  if (period.mode === "scheduled" && period.closesAt) return Date.parse(period.closesAt);
  if (period.mode === "closed" && period.graceEndsAt) return Date.parse(period.graceEndsAt);
  return null;
}

export function isAccepting(period: ApplicationPeriod, now = Date.now()) {
  const closes = closingTime(period);
  if (period.mode === "closed") return closes !== null && now < closes;
  return closes === null || now < closes;
}

/** Closed from the portal, but still inside the grace period. */
export const isClosingSoon = (period: ApplicationPeriod, now = Date.now()) => period.mode === "closed" && isAccepting(period, now);

const zone = "Asia/Manila";

/** "2026-10-29T23:59": a moment as a Manila wall-clock value for <input type="datetime-local">. */
export function toManilaInput(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** The reverse of toManilaInput; null for anything that isn't a valid date and time. */
export function fromManilaInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "October 29, 2026, 11:59 PM". Format on the server and pass the text down, so hydration matches. */
export const formatClosing = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: zone, dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

/** "29 days, 4 hours" / "3 hours, 12 minutes" / "40 seconds": a rough, human time left. */
export function describeTimeLeft(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const units: Array<[string, number]> = [
    ["day", Math.floor(seconds / 86400)],
    ["hour", Math.floor(seconds / 3600) % 24],
    ["minute", Math.floor(seconds / 60) % 60],
    ["second", seconds % 60],
  ];
  const first = units.findIndex(([, value]) => value > 0);
  if (first === -1) return "0 seconds";
  return units
    .slice(first, first + 2)
    .filter(([, value]) => value > 0)
    .map(([unit, value]) => `${value} ${unit}${value === 1 ? "" : "s"}`)
    .join(", ");
}
