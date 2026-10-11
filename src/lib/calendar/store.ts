import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { CalendarData, CalendarHighlight, CalendarNote, CalendarTodo, HighlightValues } from "./options";

// Reads and saves a unit's notes, to-dos and highlights (supabase/migrations/0069_secretariat_calendar.sql).
// `college` is null for the Central Comelec. The scope always comes from the signed-in account,
// never from the form, and every change is filtered by it, so one unit can't touch another's rows.

export type CalendarScope = { college: string | null };
export type CalendarActor = CalendarScope & { email: string; name: string };

export const calendarUnavailable = "The calendar’s notes, to-dos and highlights aren’t set up in the database yet. Run supabase/migrations/0069_secretariat_calendar.sql in the Supabase SQL Editor, then reload.";

type Row = Record<string, unknown>;
const notes = () => createAdminClient().from("calendar_notes");
const todos = () => createAdminClient().from("calendar_todos");
const highlights = () => createAdminClient().from("calendar_highlights");

type UnitFilterable<Q> = { is(column: "college", value: null): Q; eq(column: "college", value: string): Q };

/** Narrows a query to the unit's own rows. */
function own<Q>(query: Q, scope: CalendarScope): Q {
  // supabase-js's builder types are too deep for TypeScript to check against a generic constraint.
  const filterable = query as unknown as UnitFilterable<Q>;
  return scope.college === null ? filterable.is("college", null) : filterable.eq("college", scope.college);
}

const toNote = (row: Row): CalendarNote => ({ id: row.id as string, date: row.note_date as string, body: row.body as string, author: row.author_name as string, authorEmail: row.created_by as string, createdAt: row.created_at as string, updatedAt: row.updated_at as string });
const toTodo = (row: Row): CalendarTodo => ({ id: row.id as string, title: row.title as string, dueDate: (row.due_date as string | null) ?? null, done: row.done === true, doneAt: (row.done_at as string | null) ?? null, doneBy: (row.done_by as string | null) ?? null, author: row.author_name as string, createdAt: row.created_at as string });
const toHighlight = (row: Row, scope: CalendarScope): CalendarHighlight => ({ id: row.id as string, start: row.start_date as string, end: row.end_date as string, kind: row.kind as CalendarHighlight["kind"], color: (row.color as CalendarHighlight["color"]) ?? null, label: (row.label as string | null) ?? "", author: row.author_name as string, shared: ((row.college as string | null) ?? null) !== scope.college });

type DbError = { code?: string; message: string };
/** The tables (or a column) aren't there yet: 0069 hasn't been run. */
const isMissing = (error: DbError) => error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist/i.test(error.message);

/** Only a missing table asks for 0069; anything else (a dropped connection, a timeout) says what went wrong. */
function fail(error: DbError, doing: "load" | "save"): never {
  console.error(error);
  throw new Error(isMissing(error) ? calendarUnavailable : `Couldn’t ${doing} the calendar’s notes, to-dos and highlights: ${error.message}`);
}

/** A unit's highlights, including Central Comelec highlights for Local units. */
export async function listCalendarHighlights(scope: CalendarScope): Promise<CalendarHighlight[]> {
  if (!isSupabaseConfigured()) return [];
  const results = await Promise.all([
    own(highlights().select("*"), scope).order("start_date"),
    scope.college === null ? Promise.resolve({ data: [] as Row[], error: null }) : highlights().select("*").is("college", null).order("start_date"),
  ]);
  for (const result of results) if (result.error) fail(result.error, "load");
  return results.flatMap(result => (result.data ?? []).map(row => toHighlight(row, scope))).sort((a, b) => a.start.localeCompare(b.start));
}

/** The unit's notes, to-dos and the same highlights used in event date pickers. */
export async function listCalendar(scope: CalendarScope): Promise<CalendarData> {
  if (!isSupabaseConfigured()) return { notes: [], todos: [], highlights: [] };
  const [noteRows, todoRows, savedHighlights] = await Promise.all([
    own(notes().select("*"), scope).order("note_date").order("created_at"),
    own(todos().select("*"), scope).order("created_at"),
    listCalendarHighlights(scope),
  ]);
  for (const result of [noteRows, todoRows]) if (result.error) fail(result.error, "load");
  return {
    notes: (noteRows.data ?? []).map(toNote),
    todos: (todoRows.data ?? []).map(toTodo),
    highlights: savedHighlights,
  };
}

const stamp = (actor: CalendarActor) => ({ updated_at: new Date().toISOString(), updated_by: actor.email });
const gone = "This was removed, or it isn’t your unit’s. Reload the calendar.";

async function single<T>(query: PromiseLike<{ data: Row | null; error: DbError | null }>, map: (row: Row) => T): Promise<T> {
  const { data, error } = await query;
  if (error) fail(error, "save");
  if (!data) throw new Error(gone);
  return map(data);
}

export const insertNote = (actor: CalendarActor, values: { date: string; body: string }) =>
  single(notes().insert({ college: actor.college, note_date: values.date, body: values.body, created_by: actor.email, author_name: actor.name, ...stamp(actor) }).select("*").maybeSingle(), toNote);

export const updateNote = (actor: CalendarActor, id: string, body: string) =>
  single(own(notes().update({ body, ...stamp(actor) }).eq("id", id), actor).select("*").maybeSingle(), toNote);

export const insertTodo = (actor: CalendarActor, values: { title: string; dueDate: string | null }) =>
  single(todos().insert({ college: actor.college, title: values.title, due_date: values.dueDate, created_by: actor.email, author_name: actor.name, ...stamp(actor) }).select("*").maybeSingle(), toTodo);

export const updateTodo = (actor: CalendarActor, id: string, values: { title: string; dueDate: string | null }) =>
  single(own(todos().update({ title: values.title, due_date: values.dueDate, ...stamp(actor) }).eq("id", id), actor).select("*").maybeSingle(), toTodo);

export const markTodo = (actor: CalendarActor, id: string, done: boolean) =>
  single(own(todos().update({ done, done_at: done ? new Date().toISOString() : null, done_by: done ? actor.name : null, ...stamp(actor) }).eq("id", id), actor).select("*").maybeSingle(), toTodo);

export const insertHighlight = (actor: CalendarActor, values: HighlightValues) =>
  single(highlights().insert({ college: actor.college, start_date: values.start, end_date: values.end, kind: values.kind, color: values.color, label: values.label, created_by: actor.email, author_name: actor.name, ...stamp(actor) }).select("*").maybeSingle(), (row) => toHighlight(row, actor));

export const updateHighlight = (actor: CalendarActor, id: string, values: HighlightValues) =>
  single(own(highlights().update({ start_date: values.start, end_date: values.end, kind: values.kind, color: values.color, label: values.label, ...stamp(actor) }).eq("id", id), actor).select("*").maybeSingle(), (row) => toHighlight(row, actor));

/** Removes one of the unit's own rows. */
export async function removeFromCalendar(actor: CalendarActor, table: "notes" | "todos" | "highlights", id: string) {
  const query = table === "notes" ? notes() : table === "todos" ? todos() : highlights();
  const { data, error } = await own(query.delete().eq("id", id), actor).select("id");
  if (error) fail(error, "save");
  if (!data?.length) throw new Error(gone);
}
