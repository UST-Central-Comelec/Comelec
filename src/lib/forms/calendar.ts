/** Calendar calculations use UTC so daylight saving and the browser's zone cannot shift dates. */
export const calendarTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
export const calendarDay = (time: number) => new Date(time).toISOString().slice(0, 10);
export const shiftCalendarDay = (day: string, amount: number) => calendarDay(calendarTime(day) + amount * 86_400_000);

export function shiftCalendarMonth(day: string, amount: number) {
  const date = new Date(calendarTime(day));
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), last));
  return calendarDay(target.getTime());
}

export function calendarDays(month: string) {
  const first = `${month}-01`;
  const offset = new Date(calendarTime(first)).getUTCDay();
  return Array.from({ length: 42 }, (_, index) => shiftCalendarDay(first, index - offset));
}

export function formatPortalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const time = calendarTime(value);
  if (Number.isNaN(time) || calendarDay(time) !== value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(time);
}
