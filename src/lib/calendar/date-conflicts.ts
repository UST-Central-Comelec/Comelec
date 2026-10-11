import { highlightOrder, type CalendarHighlight } from "./options";

export const orderedDateRange = (first: string, last: string) => first <= last ? { start: first, end: last } : { start: last, end: first };

/** Inclusive overlap catches conflicts between the two endpoints as well. */
export function dateConflicts(highlights: CalendarHighlight[], start: string, end: string) {
  if (!start || !end) return [];
  return highlights.filter(highlight => highlight.kind !== "custom" && highlight.start <= end && highlight.end >= start)
    .sort((a, b) => highlightOrder.indexOf(a.kind) - highlightOrder.indexOf(b.kind) || a.start.localeCompare(b.start));
}
