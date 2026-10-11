"use server";

import { isLocal, requireEditor } from "@/lib/auth/session";
import { highlightSchema, noteSchema, todoSchema, type CalendarHighlight, type CalendarNote, type CalendarTodo } from "@/lib/calendar/options";
import { insertHighlight, insertNote, insertTodo, markTodo, removeFromCalendar, updateHighlight, updateNote, updateTodo, type CalendarActor } from "@/lib/calendar/store";

// Secretariat → Calendar's changes. Each writes to the signed-in account's own unit only.
// None revalidates the page: that would load every unit's events, the periods and the portal's
// badge counts again on every save (about fifteen database reads for one ticked to-do), only for
// the calendar to keep the copy it already updated from the saved row each action returns.

type Result<T> = { value: T; error?: never } | { value?: never; error: string };

const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Runs a change for the signed-in account's unit, turning any failure into the message the calendar shows. */
async function attempt<T>(change: (who: CalendarActor) => Promise<T>): Promise<Result<T>> {
  const user = await requireEditor("secretariat/calendar");
  if (isLocal(user) && !user.college) return { error: "Your account has no college set, so there’s no unit calendar to change. Ask the Central Executive Board to set it under Accounts." };
  try {
    return { value: await change({ college: isLocal(user) ? user.college : null, email: user.email, name: user.name || user.email }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save. Try again." };
  }
}

const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? "Check what you entered.";

export async function addCalendarNote(date: unknown, body: unknown): Promise<Result<CalendarNote>> {
  const parsed = noteSchema.safeParse({ date, body });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => insertNote(who, parsed.data));
}

export async function editCalendarNote(id: unknown, body: unknown): Promise<Result<CalendarNote>> {
  const parsed = noteSchema.shape.body.safeParse(body);
  if (!isId(id)) return { error: "Unknown note." };
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => updateNote(who, id, parsed.data));
}

export async function addCalendarTodo(title: unknown, dueDate: unknown): Promise<Result<CalendarTodo>> {
  const parsed = todoSchema.safeParse({ title, dueDate: dueDate || null });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => insertTodo(who, parsed.data));
}

export async function editCalendarTodo(id: unknown, title: unknown, dueDate: unknown): Promise<Result<CalendarTodo>> {
  const parsed = todoSchema.safeParse({ title, dueDate: dueDate || null });
  if (!isId(id)) return { error: "Unknown to-do." };
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => updateTodo(who, id, parsed.data));
}

export async function setCalendarTodoDone(id: unknown, done: unknown): Promise<Result<CalendarTodo>> {
  if (!isId(id) || typeof done !== "boolean") return { error: "Unknown to-do." };
  return attempt((who) => markTodo(who, id, done));
}

export async function saveCalendarHighlight(id: unknown, values: unknown): Promise<Result<CalendarHighlight>> {
  if (id !== null && !isId(id)) return { error: "Unknown highlight." };
  const parsed = highlightSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
  return attempt((who) => (id ? updateHighlight(who, id, parsed.data) : insertHighlight(who, parsed.data)));
}

export async function deleteFromCalendar(table: unknown, id: unknown): Promise<Result<true>> {
  if ((table !== "notes" && table !== "todos" && table !== "highlights") || !isId(id)) return { error: "Unknown item." };
  return attempt(async (who) => {
    await removeFromCalendar(who, table, id);
    return true as const;
  });
}
