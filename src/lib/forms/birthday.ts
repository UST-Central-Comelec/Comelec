import { formatPortalDate } from "./calendar";

export const manilaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Accept a calendar's ISO value or a typed month/day/year, rejecting rolled-over dates. */
export function parseBirthday(value: string) {
  const text = value.trim();
  if (formatPortalDate(text)) return text;
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!parts) return "";
  const iso = `${parts[3]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  return formatPortalDate(iso) ? iso : "";
}

export function formatBirthday(value: string) {
  const date = parseBirthday(value);
  return date ? `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}` : value;
}

/** Completed years on a Manila calendar day; keep the existing age reports working. */
export function ageFromBirthday(value: string, on = manilaToday()) {
  const date = parseBirthday(value);
  if (!date) return null;
  return Number(on.slice(0, 4)) - Number(date.slice(0, 4)) - (on.slice(5) < date.slice(5) ? 1 : 0);
}

export function birthdayProblem(value: string, on = manilaToday()) {
  const date = parseBirthday(value);
  if (!date) return "Enter your birthday as MM/DD/YYYY, or choose it from the calendar.";
  if (date > on) return "Your birthday can’t be in the future.";
  const age = ageFromBirthday(date, on)!;
  return age < 10 || age > 120 ? "Check your birthday. Registrants must be 10 to 120 years old." : null;
}
