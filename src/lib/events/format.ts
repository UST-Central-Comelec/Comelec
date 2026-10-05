import type { CommissionEvent } from "./options";

// How an event's day and times read on the website, in the portal and in emails. Events are saved as
// a Manila date ("2026-10-20") and Manila times ("13:00"), so nothing here depends on the reader's
// own time zone: dates are formatted as UTC days, and times straight from their digits.

const day = (date: string) => new Date(`${date}T00:00:00Z`);

const longDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });
const weekdayShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

/** Today's date in Manila, as YYYY-MM-DD. */
export const manilaToday = (now = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);

/** "Tuesday, October 20, 2026". */
export const formatEventDate = (date: string) => longDate.format(day(date));

/** "Tue, Oct 20, 2026", for tables. */
export const formatEventDateShort = (date: string) => shortDate.format(day(date));

/** "Tuesday, October 20", for a calendar day's label. */
export const formatDayLabel = (date: string) => weekdayLong.format(day(date));

/** "October 2026", from "2026-10" or a full date. */
export const formatMonth = (month: string) => monthName.format(day(`${month.slice(0, 7)}-01`));

/** The pieces of a date block: { day: "20", month: "Oct", weekday: "Tue", year: "2026" }. */
export function dateParts(date: string) {
  return { day: String(Number(date.slice(8, 10))), month: monthShort.format(day(date)), weekday: weekdayShort.format(day(date)), year: date.slice(0, 4) };
}

/** "13:00" as "1:00 PM". */
export function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** "1:00 – 4:00 PM", or "11:00 AM – 1:00 PM" when it runs past noon. */
export function formatTimeRange(start: string, end: string) {
  const from = formatTime(start);
  const to = formatTime(end);
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)} – ${to}` : `${from} – ${to}`;
}

const dayShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

type Span = Pick<CommissionEvent, "eventDate" | "endDate">;
const isOneDay = (event: Span) => !event.endDate || event.endDate === event.eventDate;

/** "Tuesday, October 20, 2026", or "October 20 – 22, 2026" / "October 30 – November 2, 2026" for a run of days. */
export function formatEventDates(event: Span) {
  if (isOneDay(event)) return formatEventDate(event.eventDate);
  const [from, to] = [day(event.eventDate), day(event.endDate)];
  const sameYear = event.eventDate.slice(0, 4) === event.endDate.slice(0, 4);
  const sameMonth = sameYear && event.eventDate.slice(0, 7) === event.endDate.slice(0, 7);
  const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric" });
  if (sameMonth) return `${monthDay.format(from)} – ${to.getUTCDate()}, ${event.endDate.slice(0, 4)}`;
  if (sameYear) return `${monthDay.format(from)} – ${monthDay.format(to)}, ${event.endDate.slice(0, 4)}`;
  return `${monthDay.format(from)}, ${event.eventDate.slice(0, 4)} – ${monthDay.format(to)}, ${event.endDate.slice(0, 4)}`;
}

/** "Tue, Oct 20, 2026", or "Oct 20 – Oct 22, 2026" for a run of days, for tables. */
export function formatEventDatesShort(event: Span) {
  if (isOneDay(event)) return formatEventDateShort(event.eventDate);
  const year = event.endDate.slice(0, 4);
  return event.eventDate.slice(0, 4) === year ? `${dayShort.format(day(event.eventDate))} – ${dayShort.format(day(event.endDate))}, ${year}` : `${formatEventDateShort(event.eventDate)} – ${formatEventDateShort(event.endDate)}`;
}

/** "1:00 – 4:00 PM" on one day; "Oct 20, 1:00 PM – Oct 22, 5:00 PM" across several. */
export function formatEventTimes(event: Span & Pick<CommissionEvent, "startsTime" | "endsTime">) {
  if (isOneDay(event)) return formatTimeRange(event.startsTime, event.endsTime);
  return `${dayShort.format(day(event.eventDate))}, ${formatTime(event.startsTime)} – ${dayShort.format(day(event.endDate))}, ${formatTime(event.endsTime)}`;
}

/** Every day an event runs, first to last, as YYYY-MM-DD; at most 62, so a mistyped year can't fill a calendar. */
export function daysOf(event: Span) {
  const days: string[] = [];
  for (let at = Date.parse(`${event.eventDate}T00:00:00Z`), last = Date.parse(`${event.endDate || event.eventDate}T00:00:00Z`); at <= last && days.length < 62; at += 86_400_000) days.push(new Date(at).toISOString().slice(0, 10));
  return days;
}

/** An event's schedule, one row per line that's set: the form's ingress, activity time and egress. */
export function scheduleRows(event: Span & Pick<CommissionEvent, "ingressTime" | "startsTime" | "endsTime" | "egressTime">): Array<[label: string, value: string]> {
  return [
    ...(event.ingressTime ? [["Ingress", formatTime(event.ingressTime)] as [string, string]] : []),
    ["Activity time", formatEventTimes(event)],
    ...(event.egressTime ? [["Egress", formatTime(event.egressTime)] as [string, string]] : []),
  ];
}

/** The months from `first` to `last` ("2026-09"), in order, both included. */
export function monthsBetween(first: string, last: string) {
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** The cells of a month grid, Sunday first: blanks before the 1st, then "YYYY-MM-DD" for each day. */
export function monthCells(month: string) {
  const [year, index] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, index - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: days }, (_, offset) => `${month}-${String(offset + 1).padStart(2, "0")}`)];
}
