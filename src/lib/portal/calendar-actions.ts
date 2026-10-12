"use server";

import { isLocal, requireEditor } from "@/lib/auth/session";
import { saverName } from "@/lib/data/edit-guard";
import { highlightSchema, noteSchema, todoSchema, type CalendarHighlight, type CalendarNote, type CalendarTodo } from "@/lib/calendar/options";
import { CalendarConflict, insertHighlight, insertNote, insertTodo, markTodo, removeFromCalendar, updateHighlight, updateNote, updateTodo, type CalendarActor } from "@/lib/calendar/store";

// Secretariat → Calendar's changes. Each writes to the signed-in account's own unit only.
// None revalidates the page: that would load every unit's events, the periods and the portal's
// badge counts again on every save (about fifteen database reads for one ticked to-do), only for
// the calendar to keep the copy it already updated from the saved row each action returns.

/** `latest`: someone else changed the item while it was being edited, and this is theirs. */
type Result<T> = { value: T; error?: never; latest?: never } | { value?: never; error: string; latest?: T };

/** What an editor sends back about the item it opened. */
const isExpected = (value: unknown): value is string | undefined => value === undefined || (typeof value === "string" && value.length <= 300);

const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Runs a change for the signed-in account's unit, turning any failure into the message the calendar shows. */
async function attempt<T>(change: (who: CalendarActor) => Promise<T>, what = "item"): Promise<Result<T>> {
  const user = await requireEditor("secretariat/calendar");
  if (isLocal(user) && !user.college) return { error: "Your account has no college set, so there’s no unit calendar to change. Ask the Central Executive Board to set it under Accounts." };
  try {
    return { value: await change({ college: isLocal(user) ? user.college : null, email: user.email, name: user.name || user.email }) };
  } catch (error) {
    if (error instanceof CalendarConflict) {
      const by = await saverName(error.by, user.email);
      const who = by === "You" ? "You changed this " + what + " in another tab" : `${by} changed this ${what}`;
      return { error: `${who} while you were editing. Theirs is showing now, and your text is still in the editor: save again to replace it, or cancel to keep theirs.`, latest: error.latest as T };
    }
    return { error: error instanceof Error ? error.message : "Couldn’t save. Try again." };
  }
}

const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? "Check what you entered.";

export async function addCalendarNote(date: unknown, body: unknown): Promise<Result<CalendarNote>> {
  const parsed = noteSchema.safeParse({ date, body });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => insertNote(who, parsed.data));
}

export async function editCalendarNote(id: unknown, body: unknown, expected?: unknown): Promise<Result<CalendarNote>> {
  const parsed = noteSchema.shape.body.safeParse(body);
  if (!isId(id) || !isExpected(expected)) return { error: "Unknown note." };
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => updateNote(who, id, parsed.data, expected), "note");
}

export async function addCalendarTodo(title: unknown, dueDate: unknown): Promise<Result<CalendarTodo>> {
  const parsed = todoSchema.safeParse({ title, dueDate: dueDate || null });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => insertTodo(who, parsed.data));
}

export async function editCalendarTodo(id: unknown, title: unknown, dueDate: unknown, expected?: unknown): Promise<Result<CalendarTodo>> {
  const parsed = todoSchema.safeParse({ title, dueDate: dueDate || null });
  if (!isId(id) || !isExpected(expected)) return { error: "Unknown to-do." };
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => updateTodo(who, id, parsed.data, expected), "to-do");
}

export async function setCalendarTodoDone(id: unknown, done: unknown): Promise<Result<CalendarTodo>> {
  if (!isId(id) || typeof done !== "boolean") return { error: "Unknown to-do." };
  return attempt((who) => markTodo(who, id, done));
}

export async function saveCalendarHighlight(id: unknown, values: unknown, expected?: unknown): Promise<Result<CalendarHighlight>> {
  if ((id !== null && !isId(id)) || !isExpected(expected)) return { error: "Unknown highlight." };
  const parsed = highlightSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => (id ? updateHighlight(who, id, parsed.data, expected) : insertHighlight(who, parsed.data)), "highlight");
}

export async function deleteFromCalendar(table: unknown, id: unknown): Promise<Result<true>> {
  if ((table !== "notes" && table !== "todos" && table !== "highlights") || !isId(id)) return { error: "Unknown item." };
  return attempt(async (who) => {
    await removeFromCalendar(who, table, id);
    return true as const;
  });
}
