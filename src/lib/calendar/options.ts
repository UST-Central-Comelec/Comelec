import { z } from "zod";
import type { PeriodKind } from "@/lib/periods/kinds";

// Secretariat → Calendar: what a unit keeps on it (notes, a to-do list, highlighted dates), and
// what it reads from elsewhere (events, and each unit's Recruitment, Political Party Registration
// and Filing of Candidacy). Free of server-only imports: the calendar and the server actions share it.
// The database checks the same keys (supabase/migrations/0069_secretariat_calendar.sql).

/** What fills a highlighted day. Moratorium periods, holidays and university events each have their own colour. */
export const highlightKinds = {
  moratorium: { label: "Moratorium", hint: "No campaigning", placeholder: "e.g. Campaign moratorium" },
  holiday: { label: "Holiday", hint: "No classes or offices", placeholder: "e.g. All Saints’ Day" },
  university: { label: "University event", hint: "On the UST calendar", placeholder: "e.g. Paskuhan" },
  custom: { label: "Custom", hint: "Any colour you pick", placeholder: "What this marks" },
} as const;
export type HighlightKind = keyof typeof highlightKinds;

/** The colours a custom highlight can take. */
export const highlightColors = { gold: "Gold", orange: "Orange", teal: "Teal", blue: "Blue", pink: "Pink", slate: "Slate" } as const;
export type HighlightColor = keyof typeof highlightColors;

/** Above which the colour of a highlight wins a day's fill, when highlights overlap. */
export const highlightOrder: HighlightKind[] = ["moratorium", "holiday", "university", "custom"];

/** An event, or a unit's period, as the calendar draws it. Worked out on the server. */
export type CalendarEntry = {
  id: string;
  kind: "event" | PeriodKind;
  name: string;
  /** YYYY-MM-DD, first and last day. */
  start: string;
  end: string;
  /** "1:00 – 4:00 PM", or "Oct 20, 1:00 PM – Oct 22, 5:00 PM". */
  time: string;
  /** "CICS", or "Central Comelec". */
  unit: string;
  unitName: string;
  organizer: "central" | "local";
  /** The viewer's own unit's. */
  own: boolean;
  /** "Registration open", "Scheduled to open", "Cancelled". */
  status: string;
  /** Called off: drawn struck through. */
  cancelled: boolean;
  /** A period scheduled to open later. */
  scheduled: boolean;
  /** Where it opens, and what the link says; null when it has nowhere to go yet. */
  link: { href: string; label: string; external?: boolean } | null;
};

export type CalendarNote = { id: string; date: string; body: string; author: string; authorEmail: string; createdAt: string; updatedAt: string };
export type CalendarTodo = { id: string; title: string; dueDate: string | null; done: boolean; doneAt: string | null; doneBy: string | null; author: string; createdAt: string };
export type CalendarHighlight = {
  id: string;
  start: string;
  end: string;
  kind: HighlightKind;
  color: HighlightColor | null;
  label: string;
  author: string;
  /** Another unit's (the Central Comelec's, on a Local unit's calendar): shown, not changed. */
  shared: boolean;
};

export type CalendarData = { notes: CalendarNote[]; todos: CalendarTodo[]; highlights: CalendarHighlight[] };

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const day = z.string().refine(isDay, "Pick a date.");
export const isCalendarDay = (value: unknown): value is string => typeof value === "string" && isDay(value);

export const noteSchema = z.object({
  date: day,
  body: z.string().trim().min(1, "Write the note first.").max(2000, "Keep a note under 2,000 characters."),
});

export const todoSchema = z.object({
  title: z.string().trim().min(1, "Write the to-do first.").max(300, "Keep a to-do under 300 characters."),
  dueDate: day.nullable(),
});

const spanDays = (start: string, end: string) => (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;

export const highlightSchema = z.object({
  start: day,
  end: day,
  kind: z.enum(Object.keys(highlightKinds) as [HighlightKind, ...HighlightKind[]]),
  color: z.enum(Object.keys(highlightColors) as [HighlightColor, ...HighlightColor[]]).nullable(),
  label: z.string().trim().max(120, "Keep the label under 120 characters."),
})
  .refine((value) => value.end >= value.start, { path: ["end"], message: "The last day can’t be before the first." })
  .refine((value) => spanDays(value.start, value.end) <= 366, { path: ["end"], message: "A highlight can cover a year at most." })
  .transform((value) => ({ ...value, color: value.kind === "custom" ? (value.color ?? "gold") : null }));

export type HighlightValues = z.infer<typeof highlightSchema>;
