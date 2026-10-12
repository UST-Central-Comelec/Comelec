"use client";

import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, Highlighter, ListTodo, Pencil, Plus, StickyNote, Trash2, X } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { SlidingFilterButtons } from "./sliding-filters";
import { DatePicker } from "@/components/portal/date-picker";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { highlightColors, highlightKinds, highlightOrder, type CalendarData, type CalendarEntry, type CalendarHighlight, type CalendarNote, type CalendarTodo, type HighlightColor, type HighlightKind } from "@/lib/calendar/options";
import { comelecUnits, unitAbbreviations } from "@/lib/applications/options";
import { comelecUnit } from "@/lib/events/options";
import { rankUnitLabels } from "@/lib/portal/unit-filter";
import { dateParts, formatDayLabel } from "@/lib/events/format";
import { addCalendarNote, addCalendarTodo, deleteFromCalendar, editCalendarNote, editCalendarTodo, saveCalendarHighlight, setCalendarTodoDone } from "@/lib/portal/calendar-actions";
import { toast } from "./toast";
import "./secretariat-calendar.css";

// Secretariat → Calendar: a month of the commission's dates. Events and each unit's Recruitment,
// Political Party Registration and Filing of Candidacy come in on their own (added from Events and
// from each section's Settings, never here); the unit adds notes, a to-do list and highlighted days.
// Built from the website's event calendar (components/events/events-board.tsx): the same wells,
// inverted today and date blocks, grown into a full month.

// Days ------------------------------------------------------------------------------------------

const DAY = 86_400_000;
const timeOf = (day: string) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day: string, count: number) => new Date(timeOf(day) + count * DAY).toISOString().slice(0, 10);
const daysFrom = (from: string, to: string) => Math.round((timeOf(to) - timeOf(from)) / DAY);
const weekdayOf = (day: string) => new Date(timeOf(day)).getUTCDay();
const shiftMonth = (month: string, count: number) => {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + count, 1)).toISOString().slice(0, 7);
};
const order = (a: string, b: string) => (a <= b ? [a, b] : [b, a]) as [string, string];
const overlaps = (item: { start: string; end: string }, from: string, to: string) => item.start <= to && item.end >= from;

/** The weeks a month's grid shows, Sunday first, with the days of the months either side. */
function monthWeeks(month: string) {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const start = addDays(first, -weekdayOf(first));
  const weeks: string[][] = [];
  for (let day = start; day <= last || weeks.at(-1)?.length !== 7; day = addDays(day, 1)) {
    if (!weeks.length || weeks.at(-1)!.length === 7) weeks.push([]);
    weeks.at(-1)!.push(day);
  }
  return weeks;
}

const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long" });
const monthShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });
const dayShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const stampFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const monthLabel = (month: string) => monthName.format(new Date(timeOf(`${month}-01`)));

/** "Oct 10", "Oct 10 – 14", "Oct 30 – Nov 2". */
function rangeLabel(from: string, to: string) {
  if (from === to) return dayShort.format(new Date(timeOf(from)));
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayShort.format(new Date(timeOf(from)))} – ${Number(to.slice(8))}`;
  return `${dayShort.format(new Date(timeOf(from)))} – ${dayShort.format(new Date(timeOf(to)))}`;
}
const plural = (count: number, noun: string, many = `${noun}s`) => `${count} ${count === 1 ? noun : many}`;

// Layers ----------------------------------------------------------------------------------------

type EntryKind = CalendarEntry["kind"];
type Layer = EntryKind | "highlights" | "notes" | "todos";
const entryLabels: Record<EntryKind, string> = { event: "Events", recruitment: "Recruitment", "party-registration": "Political Party", candidacy: "Filing of Candidacy" };
const layers: Layer[] = ["event", "recruitment", "party-registration", "candidacy", "highlights", "notes", "todos"];
const layerLabels: Record<Layer, string> = { ...entryLabels, highlights: "Highlights", notes: "Notes", todos: "To-dos" };
const allLayers = Object.fromEntries(layers.map((layer) => [layer, true])) as Record<Layer, boolean>;
const unitLabel = (entry: CalendarEntry) => entry.organizer === "central" ? "Central Comelec" : `${entry.unit} Unit`;
/** The dot before a status: open, waiting (scheduled, waitlisted, moved), or over. */
const stateOf = (entry: CalendarEntry) => (entry.cancelled || entry.status === "Ended" || entry.status.endsWith("closed") ? "off" : entry.scheduled || /waitlist|rescheduled/i.test(entry.status) ? "waiting" : entry.status.endsWith(" open") ? "open" : "off");

/** The highlight whose colour fills a day: moratorium periods first, then holidays, university events, the rest. */
const byWeight = (a: CalendarHighlight, b: CalendarHighlight) => highlightOrder.indexOf(a.kind) - highlightOrder.indexOf(b.kind) || a.start.localeCompare(b.start);
const toneOf = (highlight: Pick<CalendarHighlight, "kind" | "color">) => (highlight.kind === "custom" ? `custom-${highlight.color ?? "gold"}` : highlight.kind);
const highlightTitle = (highlight: CalendarHighlight) => highlight.label || highlightKinds[highlight.kind].label;

type Panel = "details" | "notes" | "todos";
const panels: [Panel, string][] = [["details", "Details"], ["notes", "Notes"], ["todos", "To-do list"]];

/** How many lines a day shows before the rest fold into "+N more". */
const LANES = 3;

/** Bottom to top: Recruitment, then Political Party, then Filing of Candidacy, then events. */
const stackRank: Record<CalendarEntry["kind"], number> = { recruitment: 0, "party-registration": 1, candidacy: 2, event: 3 };

type Segment = { entry: CalendarEntry; column: number; lane: number };

/** Stacks each day's lines from the bottom in a fixed order, newer events above older ones. When a day has more than fit, its oldest events fold away first. */
function layoutWeek(week: string[], entries: CalendarEntry[]) {
  const segments: Segment[] = [];
  const hidden = [0, 0, 0, 0, 0, 0, 0];
  week.forEach((day, column) => {
    const stack = entries.filter((entry) => overlaps(entry, day, day)).sort((a, b) => stackRank[a.kind] - stackRank[b.kind] || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    while (stack.length > LANES) {
      const oldestEvent = stack.findIndex((entry) => entry.kind === "event");
      stack.splice(oldestEvent === -1 ? stack.length - 1 : oldestEvent, 1);
      hidden[column]++;
    }
    stack.forEach((entry, lane) => segments.push({ entry, column, lane }));
  });
  return { segments, hidden };
}

/**
 * Saves don't re-render the page (src/lib/portal/calendar-actions.ts), so the calendar's own copy is
 * the latest. Back and Forward bring back the page as the server first sent it, so that copy is
 * also kept here, under the data it started from, and taken up again when that same data returns.
 * A fresh visit brings new data from the server, and that wins.
 */
const kept = new WeakMap<CalendarData, CalendarData>();

type Selection = { anchor: string; start: string; end: string };
/** `updatedAt`: when the highlight being edited was last saved, so a save doesn’t silently replace someone else’s. */
type HighlightDraft = { id: string | null; start: string; end: string; kind: HighlightKind; color: HighlightColor; label: string; updatedAt?: string };
type UnitFilter = "all" | "central" | `unit:${string}`;
const unitFilters: Array<[UnitFilter, string]> = [
  ["all", "All units"],
  ["central", "Central Comelec"],
  ...comelecUnits.map((college): [UnitFilter, string] => [`unit:${college}`, unitAbbreviations[college] ? `${college} (${unitAbbreviations[college]})` : college]),
];

export function SecretariatCalendar({ today, entries, data, readOnly, canAddEvent, loadError }: {
  today: string;
  entries: CalendarEntry[];
  data: CalendarData;
  unitName: string;
  local: boolean;
  readOnly: boolean;
  canAddEvent: boolean;
  loadError: string | null;
}) {
  const unitLabelId = useId();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [direction, setDirection] = useState(0);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [selection, setSelection] = useState<Selection>({ anchor: today, start: today, end: today });
  const [shown, setShown] = useState(allLayers);
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("all");
  const [initial] = useState(() => kept.get(data) ?? data);
  const [notes, setNotes] = useState(initial.notes);
  const [todos, setTodos] = useState(initial.todos);
  const [highlights, setHighlights] = useState(initial.highlights);
  const [focusedEntry, setFocusedEntry] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("details");
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<HighlightDraft | null>(null);
  const [isDragging, setDragging] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ moved: boolean } | null>(null);
  const draggedAcross = useRef(false);
  const focusAfterMove = useRef(false);

  useEffect(() => {
    kept.set(data, { notes, todos, highlights });
  }, [data, notes, todos, highlights]);

  const { start, end } = selection;
  const single = start === end;

  // What's drawn: the layers switched on, from the units picked.
  const visible = useMemo(() => entries.filter((entry) => shown[entry.kind] && (unitFilter === "all" || (unitFilter === "central" ? entry.organizer === "central" : entry.organizer === "local" && entry.unitName === comelecUnit("local", unitFilter.slice(5))))), [entries, shown, unitFilter]);
  const shownHighlights = useMemo(() => (shown.highlights ? [...highlights].sort(byWeight) : []), [highlights, shown.highlights]);
  const notesByDay = useMemo(() => group(shown.notes ? notes : [], (note) => note.date), [notes, shown.notes]);
  const todosByDay = useMemo(() => group(shown.todos ? todos.filter((todo) => !todo.done && todo.dueDate) : [], (todo) => todo.dueDate!), [todos, shown.todos]);
  const weeks = useMemo(() => monthWeeks(month), [month]);

  const highlightsOn = (day: string) => shownHighlights.filter((highlight) => overlaps(highlight, day, day));

  // Moving --------------------------------------------------------------------------------------

  const goToMonth = (next: string) => {
    if (next === month) return;
    setDirection(next > month ? 1 : -1);
    setMonth(next);
  };
  const select = (day: string, extend = false) => {
    setSelection((current) => (extend ? { anchor: current.anchor, ...range(current.anchor, day) } : { anchor: day, start: day, end: day }));
    setFocusedEntry(null);
    if (day.slice(0, 7) !== month && !extend) goToMonth(day.slice(0, 7));
  };
  const goToday = () => {
    goToMonth(today.slice(0, 7));
    setSelection({ anchor: today, start: today, end: today });
  };

  // After moving the selection by keyboard, focus follows it into the (maybe new) month.
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-date="${selection.anchor === selection.start ? selection.end : selection.start}"]`)?.focus();
  }, [selection, month]);

  const onCellKey = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekdayOf(day), End: 6 - weekdayOf(day) };
    let target: string | null = null;
    if (event.key in moves) target = addDays(day, moves[event.key]);
    else if (event.key === "PageUp" || event.key === "PageDown") {
      const next = shiftMonth(day.slice(0, 7), event.key === "PageUp" ? -1 : 1);
      target = `${next}-${String(Math.min(Number(day.slice(8)), new Date(Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5)), 0)).getUTCDate())).padStart(2, "0")}`;
    }
    if (!target) return;
    event.preventDefault();
    focusAfterMove.current = true;
    if (event.shiftKey && !event.key.startsWith("Page")) {
      setSelection((current) => ({ anchor: current.anchor, ...range(current.anchor, target!) }));
      if (target.slice(0, 7) !== month) goToMonth(target.slice(0, 7));
    } else select(target);
  };

  // Dragging across days picks a run of them, for a highlight.
  const onCellPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, day: string) => {
    draggedAcross.current = false;
    if (event.pointerType !== "mouse" || event.button !== 0 || event.shiftKey) return;
    dragging.current = { moved: false };
    setDragging(true);
    setSelection({ anchor: day, start: day, end: day });
    setFocusedEntry(null);
  };
  const onCellPointerEnter = (event: ReactPointerEvent<HTMLButtonElement>, day: string) => {
    // Only while the button is held: a grid that changes month under a still pointer isn't a drag.
    if (!dragging.current || !(event.buttons & 1)) return;
    dragging.current.moved = true;
    setSelection((current) => ({ anchor: current.anchor, ...range(current.anchor, day) }));
  };
  useEffect(() => {
    // The click that ends a drag across days mustn't then pick just the last one.
    const stop = () => {
      draggedAcross.current = Boolean(dragging.current?.moved);
      dragging.current = null;
      setDragging(false);
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);
  const onCellClick = (event: React.MouseEvent, day: string) => {
    if (draggedAcross.current) {
      draggedAcross.current = false;
      return;
    }
    select(day, event.shiftKey);
  };

  // Saving --------------------------------------------------------------------------------------

  async function run<T>(key: string, change: () => Promise<{ value?: T; error?: string; latest?: T }>, apply: (value: T) => void) {
    setBusy(key);
    try {
      const result = await change();
      // Someone else changed it meanwhile: show theirs, and leave the editor open with this person's text.
      if (result.latest !== undefined) apply(result.latest);
      if (result.error !== undefined) toast(result.error, "error");
      else apply(result.value as T);
      return result.error === undefined;
    } catch {
      toast("Couldn’t reach the portal. Check your connection and try again.", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const toggleTodo = async (todo: CalendarTodo) => {
    // Ticked straight away; put back if the save fails.
    setTodos((list) => list.map((item) => (item.id === todo.id ? { ...item, done: !todo.done } : item)));
    const saved = await run(`todo-${todo.id}`, () => setCalendarTodoDone(todo.id, !todo.done), (value: CalendarTodo) => setTodos((list) => list.map((item) => (item.id === value.id ? value : item))));
    if (!saved) setTodos((list) => list.map((item) => (item.id === todo.id ? todo : item)));
  };

  const openHighlight = (highlight?: CalendarHighlight) => {
    setDraft(highlight ? { id: highlight.id, start: highlight.start, end: highlight.end, kind: highlight.kind, color: highlight.color ?? "gold", label: highlight.label, updatedAt: highlight.updatedAt } : { id: null, start, end, kind: "moratorium", color: "gold", label: "" });
  };

  // The selected days -------------------------------------------------------------------------

  const daysEntries = visible.filter((entry) => overlaps(entry, start, end));
  const daysHighlights = shownHighlights.filter((highlight) => overlaps(highlight, start, end));
  const daysNotes = (shown.notes ? notes : []).filter((note) => note.date >= start && note.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const parts = dateParts(start);
  const startTone = single ? highlightsOn(start)[0] : undefined;
  const openTodos = todos.filter((todo) => !todo.done).length;
  // The calendar's links aren't prefetched: this one changes with every day picked, and the Agenda
  // lists every event in the month, so each would be another request to the server.
  const addEventHref = `/portal/events/new?date=${start}&from=calendar`;

  return (
    <div className="cal">
      <header className="cal-head">
        <div className="cal-head-title">
          <MonthJump month={month} onPick={goToMonth} />
        </div>
        <div className="cal-head-tools">
          {readOnly && !loadError && <ViewOnlyTag />}
          {canAddEvent && <Link className="portal-button" href={addEventHref} prefetch={false}><Plus size={16} aria-hidden="true" /> Add event</Link>}
        </div>
      </header>

      {loadError && <p className="portal-form-error cal-error" role="alert">{loadError}</p>}

      <div className="cal-body">
        <div className="cal-toolbar">
          <div className="cal-toolbar-navigation">
            <div className="cal-nav" role="group" aria-label="Month">
              <button type="button" onClick={() => goToMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={17} aria-hidden="true" /></button>
              <button type="button" className="cal-nav-today" onClick={goToday}>Today</button>
              <button type="button" onClick={() => goToMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
            <SlidingFilterButtons items={[{ key: "month", label: "Month" }, { key: "agenda", label: "Agenda" }]} active={view} label="View" onChange={setView} />
          </div>
          <div className="cal-toolbar-tools">
            <div className="portal-field cal-units">
              <span id={unitLabelId} className="portal-visually-hidden">Whose events</span>
              <Combobox key={unitFilter} name="calendar-unit" options={unitFilters.map(([, label]) => label)} value={unitFilters.find(([value]) => value === unitFilter)![1]} onChange={label => {
                const choice = unitFilters.find(([, text]) => text === label);
                if (choice) setUnitFilter(choice[0]);
              }} labelledBy={unitLabelId} placeholder="Search unit or abbreviation…" filterOptions={rankUnitLabels} emptyText="No matching unit." />
            </div>
            <div className="cal-side-switch">
              <SlidingFilterButtons items={panels.map(([key, label]) => ({ key, label }))} active={panel} label="Show in the side panel" onChange={setPanel} />
            </div>
          </div>
        </div>

        <section className="cal-board" aria-label={`${monthLabel(month)} ${month.slice(0, 4)}`}>
          <div className="cal-board-head">
            <div className="cal-layers" role="group" aria-label="Show on the calendar">
              {layers.filter(layer => layer !== "notes" && layer !== "todos" && layer !== "highlights").map((layer) => <button key={layer} type="button" data-layer={layer} aria-pressed={shown[layer]} onClick={() => setShown((current) => ({ ...current, [layer]: !current[layer] }))}><i aria-hidden="true" />{layerLabels[layer]}</button>)}
            </div>
          </div>
          {view === "month" ? (
            <div className="cal-month">
              <div className="cal-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => <span key={name}><b>{name}</b><i>{name.slice(0, 1)}</i></span>)}</div>
              <div key={month} ref={grid} className={`cal-weeks${isDragging ? " is-dragging" : ""}`} data-direction={direction} role="group" aria-label="Days">
                {weeks.map((week) => {
                  const { segments, hidden } = layoutWeek(week, visible);
                  return (
                    <div key={week[0]} className="cal-week">
                      {week.map((day, column) => {
                        const dayHighlights = highlightsOn(day);
                        const fill = dayHighlights[0];
                        // A highlight is named on its first day, and again where a new week row picks it up.
                        const named = dayHighlights.find((highlight) => highlight.start === day || column === 0);
                        const dayEntries = visible.filter((entry) => overlaps(entry, day, day));
                        const dayNotes = notesByDay.get(day) ?? [];
                        const dayTodos = todosByDay.get(day) ?? [];
                        const selected = day >= start && day <= end;
                        const label = [formatDayLabel(day), day === today && "today", ...dayHighlights.map((highlight) => `${highlightKinds[highlight.kind].label}${highlight.label ? `: ${highlight.label}` : ""}`), dayEntries.length && plural(dayEntries.length, "event"), dayNotes.length && plural(dayNotes.length, "note"), dayTodos.length && plural(dayTodos.length, "to-do")].filter(Boolean).join(", ");
                        return (
                          <button
                            key={day}
                            type="button"
                            className="cal-cell"
                            style={{ gridColumn: column + 1 }}
                            data-date={day}
                            data-tone={fill ? toneOf(fill) : undefined}
                            data-outside={day.slice(0, 7) !== month || undefined}
                            data-past={day < today || undefined}
                            data-today={day === today || undefined}
                            data-selected={selected || undefined}
                            data-edge={selected ? (single ? "single" : day === start ? "start" : day === end ? "end" : undefined) : undefined}
                            aria-pressed={selected}
                            aria-current={day === today ? "date" : undefined}
                            aria-label={label}
                            tabIndex={day === selection.anchor || (selection.anchor.slice(0, 7) !== month && day === `${month}-01`) ? 0 : -1}
                            onClick={(event) => onCellClick(event, day)}
                            onKeyDown={(event) => onCellKey(event, day)}
                            onPointerDown={(event) => onCellPointerDown(event, day)}
                            onPointerEnter={(event) => onCellPointerEnter(event, day)}
                          >
                            <span className="cal-cell-head">
                              <span className="cal-num">{day.endsWith("-01") && <span className="cal-num-month">{monthShort.format(new Date(timeOf(day)))}&nbsp;</span>}{Number(day.slice(8))}</span>
                              {named && <span className="cal-hl-name" data-tone={toneOf(named)}>{highlightTitle(named)}</span>}
                              {dayHighlights.length > 1 && <span className="cal-hl-more" aria-hidden="true">{dayHighlights.slice(1, 4).map((highlight) => <i key={highlight.id} data-tone={toneOf(highlight)} />)}</span>}
                            </span>
                            <span className="cal-dots" aria-hidden="true">{[...new Set(dayEntries.map((entry) => entry.kind))].map((kind) => <i key={kind} data-kind={kind} />)}{dayNotes.length > 0 && <i data-kind="note" />}{dayTodos.length > 0 && <i data-kind="todo" />}</span>
                            <span className="cal-cell-foot" aria-hidden="true">
                              {hidden[column] > 0 && <span className="cal-more">+{hidden[column]} more</span>}
                              {dayNotes.length > 0 && <span className="cal-count"><StickyNote size={12} />{dayNotes.length}</span>}
                              {dayTodos.length > 0 && <span className="cal-count"><ListTodo size={12} />{dayTodos.length}</span>}
                            </span>
                          </button>
                        );
                      })}
                      {segments.map(({ entry, column, lane }) => (
                        // A thin line along the foot of each day it runs on, kept inside that day; its name is in the title and the day panel.
                        <button
                          key={`${entry.id}-${column}`}
                          type="button"
                          tabIndex={-1}
                          className="cal-bar"
                          data-kind={entry.kind}
                          data-cancelled={entry.cancelled || undefined}
                          data-scheduled={entry.scheduled || undefined}
                          data-focused={focusedEntry === entry.id || undefined}
                          data-on-tone={highlightsOn(week[column]).length > 0 || undefined}
                          // Lane 0 sits on the bottom row.
                          style={{ gridColumn: column + 1, gridRow: LANES + 2 - lane }}
                          title={`${entry.name} · ${rangeLabel(entry.start, entry.end)} · ${unitLabel(entry)}`}
                          aria-hidden="true"
                          onClick={() => {
                            select(week[column]);
                            setFocusedEntry(entry.id);
                            setPanel("details");
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Agenda month={month} today={today} entries={visible} highlights={shownHighlights} notes={shown.notes ? notes : []} todos={shown.todos ? todos.filter((todo) => !todo.done) : []} selected={[start, end]} onSelect={(day) => select(day)} />
          )}
        </section>

        <aside className="cal-side" aria-label="Selected days">
          <section className="cal-card cal-day">
            <header className="cal-day-head">
              <time className="cal-date-block" dateTime={start} data-tone={startTone ? toneOf(startTone) : undefined}><span>{parts.month}</span><strong>{parts.day}</strong><small>{parts.weekday}</small></time>
              <div>
                <h2>{single ? formatDayLabel(start) : rangeLabel(start, end)}</h2>
                <p className="cal-day-when" data-today={(single && start === today) || undefined}>{single ? (start === today ? "Today" : start < today ? `${plural(daysFrom(start, today), "day")} ago` : `In ${plural(daysFrom(today, start), "day")}`) : `${plural(daysFrom(start, end) + 1, "day")} selected`}</p>
              </div>
              {panel === "notes" && <h3 className="cal-day-count">Notes{daysNotes.length > 0 && <span>{daysNotes.length}</span>}</h3>}
              {panel === "todos" && <h3 className="cal-day-count">To-dos{openTodos > 0 && <span>{openTodos}</span>}</h3>}
            </header>

            {panel === "details" && <>
            <div className="cal-day-actions">
              {!readOnly && <button type="button" className="cal-action" onClick={() => openHighlight()} aria-expanded={draft !== null && draft.id === null}><Highlighter size={15} aria-hidden="true" /> Highlight {single ? "day" : "days"}</button>}
              {canAddEvent && <Link className="cal-action" href={addEventHref} prefetch={false}><CalendarPlus size={15} aria-hidden="true" /> Add event</Link>}
            </div>

            {draft && <HighlightForm draft={draft} setDraft={setDraft} busy={busy === "highlight"} onSave={async () => {
              const saved = await run("highlight", () => saveCalendarHighlight(draft.id, { start: draft.start, end: draft.end, kind: draft.kind, color: draft.kind === "custom" ? draft.color : null, label: draft.label }, draft.updatedAt), (value: CalendarHighlight) => {
                setHighlights((list) => [...list.filter((item) => item.id !== value.id), value]);
                // After a conflict, saving again replaces theirs.
                setDraft((current) => (current && current.id === value.id ? { ...current, updatedAt: value.updatedAt } : current));
              });
              if (saved) setDraft(null);
            }} />}

            <DaySection title="Schedule" count={daysEntries.length + daysHighlights.length} empty={single ? "Nothing on the calendar this day." : "Nothing on the calendar these days."}>
              {daysHighlights.map((highlight) => (
                <li key={highlight.id} className="cal-row is-highlight" data-tone={toneOf(highlight)}>
                  <i className="cal-swatch" aria-hidden="true" />
                  <div>
                    <strong>{highlightTitle(highlight)}</strong>
                    <small>{highlightKinds[highlight.kind].label} · {rangeLabel(highlight.start, highlight.end)}{highlight.shared ? " · From the Central Comelec" : ""}</small>
                  </div>
                  {!readOnly && !highlight.shared && (
                    <span className="cal-row-tools">
                      <button type="button" onClick={() => openHighlight(highlight)} aria-label={`Edit ${highlightTitle(highlight)}`}><Pencil size={14} aria-hidden="true" /></button>
                      <ConfirmRemove label={`Remove ${highlightTitle(highlight)}`} busy={busy === `remove-${highlight.id}`} onConfirm={() => run(`remove-${highlight.id}`, () => deleteFromCalendar("highlights", highlight.id), () => { setHighlights((list) => list.filter((item) => item.id !== highlight.id)); if (draft?.id === highlight.id) setDraft(null); })} />
                    </span>
                  )}
                </li>
              ))}
              {daysEntries.map((entry) => (
                <li key={entry.id} className="cal-row" data-kind={entry.kind} data-focused={focusedEntry === entry.id || undefined} data-cancelled={entry.cancelled || undefined}>
                  <i className="cal-swatch" aria-hidden="true" />
                  <div>
                    <small className="cal-row-kind"><span title={entry.unitName}>{unitLabel(entry)}</span></small>
                    <strong>{entry.name}</strong>
                    <small>{entry.time}</small>
                    <small className="cal-row-status" data-state={stateOf(entry)}>{entry.status}</small>
                  </div>
                  {entry.link && <Link className="cal-row-link" href={entry.link.href} prefetch={false} target={entry.link.external ? "_blank" : undefined} aria-label={`${entry.link.label} ${entry.name}`}>{entry.link.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>}
                </li>
              ))}
            </DaySection>
            </>}

            {panel === "notes" && <>
            <DaySection count={daysNotes.length} empty={single ? "No notes for this day." : "No notes for these days."} hideEmpty={!readOnly && single}>
              {daysNotes.map((note) => <NoteItem key={note.id} note={note} showDate={!single} readOnly={readOnly} busy={busy} onSave={(body) => run(`note-${note.id}`, () => editCalendarNote(note.id, body, note.updatedAt), (value: CalendarNote) => setNotes((list) => list.map((item) => (item.id === value.id ? value : item))))} onRemove={() => run(`remove-${note.id}`, () => deleteFromCalendar("notes", note.id), () => setNotes((list) => list.filter((item) => item.id !== note.id)))} />)}
            </DaySection>
            {!readOnly && (single
              ? <Composer key={`note-${start}`} multiline placeholder={`Add a note for ${dayShort.format(new Date(timeOf(start)))}…`} submitLabel="Add note" busy={busy === "note"} onSubmit={(body) => run("note", () => addCalendarNote(start, body), (value: CalendarNote) => setNotes((list) => [...list, value]))} />
              : <p className="cal-tip">Pick one day to add a note to it.</p>)}
            </>}

            {panel === "todos" && <>
            <TodoStack todos={todos} today={today} readOnly={readOnly} busy={busy}
              onPickDay={(day) => select(day)}
              onToggle={toggleTodo}
              onSave={(todo, title) => run(`todo-${todo.id}`, () => editCalendarTodo(todo.id, title, todo.dueDate, todo.title), (value: CalendarTodo) => setTodos((list) => list.map((item) => (item.id === value.id ? value : item))))}
              onRemove={(todo) => run(`remove-${todo.id}`, () => deleteFromCalendar("todos", todo.id), () => setTodos((list) => list.filter((item) => item.id !== todo.id)))} />
            {!readOnly && (single
              ? <TodoAdder key={`todo-${start}`} due={dayShort.format(new Date(timeOf(start)))} busy={busy === "todo"} onAdd={(title) => run("todo", () => addCalendarTodo(title, start), (value: CalendarTodo) => setTodos((list) => [...list, value]))} />
              : <p className="cal-tip">Pick one day to add a to-do due on it.</p>)}
            </>}
          </section>

        </aside>
      </div>
    </div>
  );
}

function range(a: string, b: string) {
  const [start, end] = order(a, b);
  return { start, end };
}

function group<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

// Pieces ----------------------------------------------------------------------------------------

/** The month's name as the page's heading, which opens a picker of months and years. */
function MonthJump({ month, onPick }: { month: string; onPick: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setYear(Number(month.slice(0, 4))); }}>
      <h1 className="cal-month-title">
        <Popover.Trigger className="cal-month-trigger" aria-label={`${monthLabel(month)} ${month.slice(0, 4)}: go to another month`}>
          {monthLabel(month)} <em>{month.slice(0, 4)}</em>
          <ChevronDown size={18} aria-hidden="true" />
        </Popover.Trigger>
      </h1>
      <Popover.Portal>
        <Popover.Positioner className="cal-pop-positioner" sideOffset={10} align="start">
          <Popover.Popup className="cal-pop">
            <Popover.Title className="cal-sr">Go to a month</Popover.Title>
            <div className="cal-pop-year">
              <button type="button" onClick={() => setYear(year - 1)} aria-label="Previous year"><ChevronLeft size={16} aria-hidden="true" /></button>
              <strong>{year}</strong>
              <button type="button" onClick={() => setYear(year + 1)} aria-label="Next year"><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
            <div className="cal-pop-months">
              {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`).map((value) => (
                <button key={value} type="button" aria-pressed={value === month} onClick={() => { onPick(value); setOpen(false); }}>{monthShort.format(new Date(timeOf(`${value}-01`)))}</button>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A titled list in the day card; without a title when the card's header already names it. */
function DaySection({ title, count, empty, hideEmpty = false, children }: { title?: string; count: number; empty: string; hideEmpty?: boolean; children: React.ReactNode }) {
  return (
    <div className="cal-section">
      {title && <h3>{title}{count > 0 && <span>{count}</span>}</h3>}
      {count > 0 ? <ul className="cal-rows">{children}</ul> : !hideEmpty && <p className="cal-none">{empty}</p>}
    </div>
  );
}

/** A two-step remove: the bin, then "Remove?" with a yes. */
function ConfirmRemove({ label, busy, onConfirm }: { label: string; busy: boolean; onConfirm: () => Promise<unknown> }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button type="button" onClick={() => setArmed(true)} aria-label={label}><Trash2 size={14} aria-hidden="true" /></button>;
  return (
    <span className="cal-confirm">
      <button type="button" className="is-danger" disabled={busy} onClick={async () => { await onConfirm(); setArmed(false); }}>{busy ? "Removing…" : "Remove"}</button>
      <button type="button" disabled={busy} onClick={() => setArmed(false)} aria-label="Keep it"><X size={14} aria-hidden="true" /></button>
    </span>
  );
}

/** A field with its button: a note (several lines; ⌘↵ saves) or a to-do (Enter adds). */
function Composer({ placeholder, submitLabel, busy, multiline = false, initial = "", autoFocus = Boolean(initial), onSubmit, onCancel, children }: { placeholder: string; submitLabel: string; busy: boolean; multiline?: boolean; initial?: string; autoFocus?: boolean; onSubmit: (text: string) => Promise<boolean>; onCancel?: () => void; children?: React.ReactNode }) {
  const [text, setText] = useState(initial);
  const submit = async () => {
    if (!text.trim() || busy) return;
    if (await onSubmit(text.trim())) setText("");
  };
  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && onCancel) onCancel();
    if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); }
  };
  return (
    <div className={`cal-composer${multiline ? " is-multiline" : ""}`}>
      {multiline
        ? <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKey} placeholder={placeholder} rows={text.split("\n").length > 2 ? 5 : 2} maxLength={2000} aria-label={placeholder.replace("…", "")} autoFocus={autoFocus} />
        : <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKey} placeholder={placeholder} maxLength={300} aria-label={placeholder.replace("…", "")} autoFocus={autoFocus} />}
      {children}
      <span className="cal-composer-actions">
        {onCancel && <button type="button" className="cal-text-button" onClick={onCancel}>Cancel</button>}
        <button type="button" className="cal-submit" disabled={busy || !text.trim()} onClick={submit}>{busy ? "Saving…" : submitLabel}</button>
      </span>
    </div>
  );
}

function NoteItem({ note, showDate, readOnly, busy, onSave, onRemove }: { note: CalendarNote; showDate: boolean; readOnly: boolean; busy: string | null; onSave: (body: string) => Promise<boolean>; onRemove: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <li className="cal-note is-editing"><Composer multiline initial={note.body} placeholder="Edit the note…" submitLabel="Save" busy={busy === `note-${note.id}`} onCancel={() => setEditing(false)} onSubmit={async (body) => { const saved = await onSave(body); if (saved) setEditing(false); return saved; }} /></li>;
  return (
    <li className="cal-note">
      {showDate && <small className="cal-note-date">{formatDayLabel(note.date)}</small>}
      <p>{note.body}</p>
      <footer>
        <small>{note.author} · {stampFormat.format(new Date(note.updatedAt))}{note.updatedAt !== note.createdAt ? " · edited" : ""}</small>
        {!readOnly && <span className="cal-row-tools">
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit note"><Pencil size={14} aria-hidden="true" /></button>
          <ConfirmRemove label="Remove note" busy={busy === `remove-${note.id}`} onConfirm={onRemove} />
        </span>}
      </footer>
    </li>
  );
}

function TodoItem({ todo, today, readOnly, busy, showDue = false, onToggle, onSave, onRemove, onPickDay }: { todo: CalendarTodo; today: string; readOnly: boolean; busy: string | null; showDue?: boolean; onToggle: () => void; onSave: (title: string) => Promise<boolean>; onRemove: () => Promise<unknown>; onPickDay?: (day: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="cal-todo is-editing">
        <Composer initial={todo.title} placeholder="Edit the to-do…" submitLabel="Save" busy={busy === `todo-${todo.id}`} onCancel={() => setEditing(false)} onSubmit={async (title) => { const saved = await onSave(title); if (saved) setEditing(false); return saved; }} />
      </li>
    );
  }
  const overdue = !todo.done && todo.dueDate !== null && todo.dueDate < today;
  return (
    <li className="cal-todo" data-done={todo.done || undefined}>
      <button type="button" role="checkbox" aria-checked={todo.done} className="cal-check" disabled={readOnly} onClick={onToggle} aria-label={todo.done ? `Mark “${todo.title}” as not done` : `Mark “${todo.title}” as done`}>{todo.done && <Check size={12} strokeWidth={3} aria-hidden="true" />}</button>
      <div>
        <span className="cal-todo-title">{todo.title}</span>
        <small>
          {showDue && todo.dueDate && (onPickDay
            ? <button type="button" className="cal-due" data-overdue={overdue || undefined} onClick={() => onPickDay(todo.dueDate!)}>{todo.dueDate === today ? "Due today" : `Due ${rangeLabel(todo.dueDate, todo.dueDate)}`}</button>
            : <span className="cal-due" data-overdue={overdue || undefined}>Due {rangeLabel(todo.dueDate, todo.dueDate)}</span>)}
          {todo.done && todo.doneBy ? <span>Done by {todo.doneBy}{todo.doneAt ? ` · ${stampFormat.format(new Date(todo.doneAt))}` : ""}</span> : <span>{todo.author}</span>}
        </small>
      </div>
      {!readOnly && <span className="cal-row-tools">
        {!todo.done && <button type="button" onClick={() => setEditing(true)} aria-label={`Edit “${todo.title}”`}><Pencil size={14} aria-hidden="true" /></button>}
        <ConfirmRemove label={`Remove “${todo.title}”`} busy={busy === `remove-${todo.id}`} onConfirm={onRemove} />
      </span>}
    </li>
  );
}

/** Every to-do in one stack: open ones by due date, soonest first, then those without one; the ticked-off ones fold away below. */
function TodoStack({ todos, today, readOnly, busy, onPickDay, onToggle, onSave, onRemove }: { todos: CalendarTodo[]; today: string; readOnly: boolean; busy: string | null; onPickDay: (day: string) => void; onToggle: (todo: CalendarTodo) => void; onSave: (todo: CalendarTodo, title: string) => Promise<boolean>; onRemove: (todo: CalendarTodo) => Promise<unknown> }) {
  const [showDone, setShowDone] = useState(false);
  const open = todos.filter((todo) => !todo.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.createdAt.localeCompare(b.createdAt));
  const done = todos.filter((todo) => todo.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const item = (todo: CalendarTodo) => <TodoItem key={todo.id} todo={todo} today={today} readOnly={readOnly} busy={busy} showDue onPickDay={onPickDay} onToggle={() => onToggle(todo)} onSave={(title) => onSave(todo, title)} onRemove={() => onRemove(todo)} />;
  return (
    <div className="cal-section cal-todo-stack">
      {open.length ? <ul className="cal-rows">{open.map(item)}</ul> : <p className="cal-none">Nothing to do.</p>}
      {done.length > 0 && <>
        <button type="button" className="cal-text-button cal-done-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
          <ChevronDown size={14} aria-hidden="true" />{showDone ? "Hide" : "Show"} done ({done.length})
        </button>
        {showDone && <ul className="cal-rows">{done.map(item)}</ul>}
      </>}
    </div>
  );
}

/** "Add +" at the foot of the stack; it opens a line to type in, due on the picked day, and stays open for the next one. */
function TodoAdder({ due, busy, onAdd }: { due: string; busy: boolean; onAdd: (title: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="cal-add" onClick={() => setOpen(true)}>Add <Plus size={15} aria-hidden="true" /></button>;
  return <Composer autoFocus placeholder={`Add a to-do due ${due}…`} submitLabel="Add" busy={busy} onCancel={() => setOpen(false)} onSubmit={onAdd} />;
}

function HighlightForm({ draft, setDraft, busy, onSave }: { draft: HighlightDraft; setDraft: (draft: HighlightDraft | null) => void; busy: boolean; onSave: () => void }) {
  const kinds = Object.keys(highlightKinds) as HighlightKind[];
  return (
    <div className="cal-hl-form" role="group" aria-label={draft.id ? "Edit highlight" : "Highlight days"}>
      <div className="cal-hl-kinds" role="radiogroup" aria-label="Kind">
        {kinds.map((kind) => (
          <button key={kind} type="button" role="radio" aria-checked={draft.kind === kind} data-tone={toneOf({ kind, color: draft.color })} onClick={() => setDraft({ ...draft, kind })}>
            <i aria-hidden="true">{draft.kind === kind && <Check size={11} strokeWidth={3} />}</i>
            <span><strong>{highlightKinds[kind].label}</strong><small>{highlightKinds[kind].hint}</small></span>
          </button>
        ))}
      </div>
      {draft.kind === "custom" && (
        <div className="cal-hl-colors" role="radiogroup" aria-label="Colour">
          {(Object.keys(highlightColors) as HighlightColor[]).map((color) => <button key={color} type="button" role="radio" aria-checked={draft.color === color} aria-label={highlightColors[color]} title={highlightColors[color]} data-tone={`custom-${color}`} onClick={() => setDraft({ ...draft, color })}>{draft.color === color && <Check size={12} strokeWidth={3} aria-hidden="true" />}</button>)}
        </div>
      )}
      <label className="portal-field">
        <span className="portal-field-label">Label <span className="portal-muted">(optional)</span></span>
        <input value={draft.label} maxLength={120} placeholder={highlightKinds[draft.kind].placeholder} onChange={(event) => setDraft({ ...draft, label: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSave(); } }} />
      </label>
      <div className="cal-hl-dates">
        <div className="portal-field"><span className="portal-field-label">From</span><DatePicker value={draft.start} onChange={(start) => start && setDraft({ ...draft, start, end: draft.end < start ? start : draft.end })} label="From" /></div>
        <div className="portal-field"><span className="portal-field-label">To</span><DatePicker value={draft.end} min={draft.start} onChange={(end) => end && setDraft({ ...draft, end })} label="To" /></div>
      </div>
      <div className="cal-composer-actions">
        <button type="button" className="cal-text-button" onClick={() => setDraft(null)}>Cancel</button>
        <button type="button" className="cal-submit" disabled={busy} onClick={onSave}>{busy ? "Saving…" : draft.id ? "Save highlight" : "Highlight"}</button>
      </div>
    </div>
  );
}

/** The month as a list: each day with something on it, in order. A run of days is listed on its first day in the month. */
function Agenda({ month, today, entries, highlights, notes, todos, selected, onSelect }: { month: string; today: string; entries: CalendarEntry[]; highlights: CalendarHighlight[]; notes: CalendarNote[]; todos: CalendarTodo[]; selected: [string, string]; onSelect: (day: string) => void }) {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const listedOn = (item: { start: string }) => (item.start < first ? first : item.start);
  const days = new Map<string, { entries: CalendarEntry[]; highlights: CalendarHighlight[]; notes: CalendarNote[]; todos: CalendarTodo[] }>();
  const at = (day: string) => days.get(day) ?? days.set(day, { entries: [], highlights: [], notes: [], todos: [] }).get(day)!;
  for (const entry of entries) if (overlaps(entry, first, last)) at(listedOn(entry)).entries.push(entry);
  for (const highlight of highlights) if (overlaps(highlight, first, last)) at(listedOn(highlight)).highlights.push(highlight);
  for (const note of notes) if (note.date >= first && note.date <= last) at(note.date).notes.push(note);
  for (const todo of todos) if (todo.dueDate && todo.dueDate >= first && todo.dueDate <= last) at(todo.dueDate).todos.push(todo);
  const ordered = [...days.keys()].sort();

  if (!ordered.length) return <section className="cal-agenda is-empty"><p className="cal-none">Nothing on the calendar in {monthLabel(month)}.</p></section>;
  return (
    <section className="cal-agenda" aria-label={`${monthLabel(month)} agenda`}>
      <ol>
        {ordered.map((day) => {
          const items = days.get(day)!;
          const parts = dateParts(day);
          return (
            <li key={day} className="cal-agenda-day" data-today={day === today || undefined} data-past={day < today || undefined}>
              <button type="button" className="cal-date-block" aria-pressed={day >= selected[0] && day <= selected[1]} onClick={() => onSelect(day)} aria-label={`Select ${formatDayLabel(day)}`}><span>{parts.month}</span><strong>{parts.day}</strong><small>{parts.weekday}</small></button>
              <ul className="cal-rows">
                {items.highlights.map((highlight) => <li key={highlight.id} className="cal-row is-highlight" data-tone={toneOf(highlight)}><i className="cal-swatch" aria-hidden="true" /><div><strong>{highlightTitle(highlight)}</strong><small>{highlightKinds[highlight.kind].label} · {rangeLabel(highlight.start, highlight.end)}</small></div></li>)}
                {items.entries.map((entry) => (
                  <li key={entry.id} className="cal-row" data-kind={entry.kind} data-cancelled={entry.cancelled || undefined}>
                    <i className="cal-swatch" aria-hidden="true" />
                    <div><small className="cal-row-kind"><span title={entry.unitName}>{unitLabel(entry)}</span></small><strong>{entry.name}</strong><small>{entry.time}</small><small className="cal-row-status" data-state={stateOf(entry)}>{entry.status}</small></div>
                    {entry.link && <Link className="cal-row-link" href={entry.link.href} prefetch={false} target={entry.link.external ? "_blank" : undefined}>{entry.link.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>}
                  </li>
                ))}
                {items.notes.map((note) => <li key={note.id} className="cal-row" data-kind="note"><i className="cal-swatch" aria-hidden="true" /><div><small className="cal-row-kind">Note · {note.author}</small><p>{note.body}</p></div></li>)}
                {items.todos.map((todo) => <li key={todo.id} className="cal-row" data-kind="todo"><i className="cal-swatch" aria-hidden="true" /><div><small className="cal-row-kind">To-do due</small><strong>{todo.title}</strong></div></li>)}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
