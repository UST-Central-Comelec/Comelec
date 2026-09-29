"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { interviewModes, slotDate, slotDay, slotTimeRange } from "@/lib/applications/interview-format";
import type { AdminInterviewSlot } from "@/lib/applications/interviews";
import { divisions, type DivisionId } from "@/lib/applications/options";
import type { FormState } from "@/lib/portal/form";
import { deleteInterviewSlot } from "@/lib/portal/interview-actions";
import { InterviewSlotForm } from "./interview-slot-form";
import { TitleWithInfo } from "./info-tip";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

const monthLabel = (month: string) => new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(toTime(`${month}-01`));

const shiftMonth = (month: string, by: number) => {
  const [year, index] = month.split("-").map(Number);
  return fromTime(Date.UTC(year, index - 1 + by, 1)).slice(0, 7);
};

/** Every day from `a` to `b`, inclusive, in order. */
function dayRange(a: string, b: string) {
  const [from, to] = [toTime(a), toTime(b)].sort((x, y) => x - y);
  return Array.from({ length: Math.round((to - from) / DAY_MS) + 1 }, (_, index) => fromTime(from + index * DAY_MS));
}

/** Blanks before the 1st, then "YYYY-MM-DD" for each day, padded to whole weeks. */
function monthCells(month: string) {
  const [year, index] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, index - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const cells = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: days }, (_, day) => `${month}-${String(day + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  return cells;
}

const sortDays = (days: Iterable<string>) => [...new Set(days)].sort();

/**
 * The Interviews page: a month calendar marking the days with interview slots, the selected days'
 * schedules beneath it, and the "Add interview slots" settings beside it.
 *
 * Selecting days: click one; drag across several (or Shift-click) for a run; Ctrl/Cmd-click to add
 * or remove single days. On touchscreens, tapping toggles days. The form then adds the same slots
 * to every selected day that hasn't passed.
 */
export function InterviewPlanner({ slots, today, division, initialDay, addAction }: {
  slots: AdminInterviewSlot[];
  /** "YYYY-MM-DD" in Manila, from the server, so server and browser agree. */
  today: string;
  division?: DivisionId;
  initialDay?: string;
  addAction: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const byDay = new Map<string, AdminInterviewSlot[]>();
  for (const slot of slots) {
    const day = slotDay(slot.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), slot]);
  }

  const startDay = initialDay ?? [...byDay.keys()].sort().find((day) => day >= today) ?? today;
  const [selected, setSelected] = useState<string[]>([startDay]);
  const [anchor, setAnchor] = useState(startDay);
  const [month, setMonth] = useState(startDay.slice(0, 7));
  const dragging = useRef(false);
  const lastPointer = useRef("mouse");

  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
  }, []);

  const selectOnly = (day: string) => {
    setSelected([day]);
    setAnchor(day);
  };
  const extendTo = (day: string) => setSelected(dayRange(anchor, day));
  const toggle = (day: string) => {
    setAnchor(day);
    setSelected((current) => {
      const next = current.includes(day) ? current.filter((item) => item !== day) : sortDays([...current, day]);
      return next.length ? next : [day];
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, day: string) => {
    lastPointer.current = event.pointerType;
    // Touch taps are handled on click, so dragging a finger still scrolls the page.
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    event.preventDefault();
    if (event.shiftKey) return extendTo(day);
    if (event.metaKey || event.ctrlKey) return toggle(day);
    dragging.current = true;
    selectOnly(day);
  };
  const onPointerEnter = (event: PointerEvent<HTMLButtonElement>, day: string) => {
    // Only while the button is actually held: if it was released outside the window, the drag is over.
    if (!dragging.current) return;
    if (!(event.buttons & 1)) {
      dragging.current = false;
      return;
    }
    extendTo(day);
  };
  const onClick = (event: MouseEvent<HTMLButtonElement>, day: string) => {
    if (lastPointer.current === "mouse" && event.detail > 0) return; // already handled on pointer down
    if (event.detail > 0) return toggle(day); // a tap on a touchscreen
    // Keyboard (Enter/Space)
    if (event.shiftKey) return extendTo(day);
    if (event.metaKey || event.ctrlKey) return toggle(day);
    selectOnly(day);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") selectOnly(anchor);
  };

  const goTo = (day: string) => {
    selectOnly(day);
    setMonth(day.slice(0, 7));
  };

  // New slots go on the selected days that haven't passed (today if none have).
  const formDates = selected.filter((day) => day >= today);
  const shownDays = selected.filter((day) => byDay.has(day));
  const shownSlots = shownDays.flatMap((day) => byDay.get(day)!);
  const booked = shownSlots.reduce((total, slot) => total + slot.booked, 0);
  const capacity = shownSlots.reduce((total, slot) => total + slot.capacity, 0);
  const heading = selected.length === 1 ? slotDate(`${selected[0]}T12:00:00+08:00`) : `${selected.length} days selected`;

  return (
    <div className="interview-planner">
      <div className="interview-planner-main">
        <section className="portal-card interview-month">
          <header className="interview-month-head">
            <TitleWithInfo as="h2" info="Click a day to see its slots. Drag across days, or Shift-click, to select several.">{monthLabel(month)}</TitleWithInfo>
            <div className="interview-month-nav">
              <button type="button" className="interview-today" onClick={() => goTo(today)}>Today</button>
              <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
            </div>
          </header>

          <div className="interview-month-weekdays" aria-hidden="true">
            {weekdays.map((name) => <span key={name}>{name}</span>)}
          </div>
          {/* Keyed by month so each month fades in. */}
          <div key={month} className="interview-month-grid" role="group" aria-label={monthLabel(month)}>
            {monthCells(month).map((cell, index) => {
              if (!cell) return <span key={`blank-${index}`} className="planner-day is-blank" />;
              const cellSlots = byDay.get(cell) ?? [];
              const cellDivisions = [...new Set(cellSlots.map((slot) => slot.division ?? "none"))];
              const isSelected = selected.includes(cell);
              const label = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(toTime(cell));
              return (
                <button
                  key={cell}
                  type="button"
                  className={`planner-day${isSelected ? " is-selected" : ""}${cell === today ? " is-today" : ""}${cell < today ? " is-past" : ""}${cellSlots.length ? " has-slots" : ""}`}
                  aria-pressed={isSelected}
                  aria-label={`${label}${cellSlots.length ? `, ${cellSlots.length} interview ${cellSlots.length === 1 ? "slot" : "slots"}` : ""}`}
                  onPointerDown={(event) => onPointerDown(event, cell)}
                  onPointerEnter={(event) => onPointerEnter(event, cell)}
                  onClick={(event) => onClick(event, cell)}
                  onKeyDown={onKeyDown}
                >
                  <span className="planner-day-number">{Number(cell.slice(8))}</span>
                  {/* One dot per division with slots that day; the count is in the aria-label and the schedule below. */}
                  {cellSlots.length > 0 && (
                    <span className="planner-day-dots" aria-hidden="true">{cellDivisions.map((id) => <i key={id} className={`is-${id}`} />)}</span>
                  )}
                </button>
              );
            })}
          </div>

          <footer className="interview-legend" aria-label="Divisions">
            {(Object.keys(divisions) as DivisionId[]).filter((id) => !division || id === division).map((id) => (
              <span key={id}><i className={`is-${id}`} />{divisions[id].label}</span>
            ))}
          </footer>
        </section>

        <section className="portal-card is-flush" aria-live="polite">
          <div className="portal-card-head portal-interview-day">
            <h2 className="portal-card-title">{heading}</h2>
            {shownSlots.length > 0 && <span className="portal-muted">{booked} of {capacity} booked</span>}
          </div>
          {shownSlots.length === 0 ? (
            <p className="portal-empty"><CalendarPlus size={18} aria-hidden="true" /> No interview slots {selected.length === 1 ? "on this day" : "on these days"}{division ? ` for the ${divisions[division].label}` : ""}. {formDates.length ? "Add some with the form." : ""}</p>
          ) : (
            shownDays.map((day) => (
              <div key={day} className="interview-schedule-day">
                {selected.length > 1 && <h3>{slotDate(`${day}T12:00:00+08:00`)}</h3>}
                <ul className="portal-interview-slots">
                  {byDay.get(day)!.map((slot) => (
                    <li key={slot.id}>
                      <div className="portal-interview-time">
                        <strong>{slotTimeRange(slot.startsAt, slot.durationMinutes)}</strong>
                        <small className="portal-muted">{[interviewModes[slot.mode], slot.location].filter(Boolean).join(" · ")}</small>
                        <span className={`portal-tag interview-division-tag is-${slot.division ?? "none"}`}>{slot.division ? divisions[slot.division].label : "No division"}</span>
                      </div>
                      <div className="portal-interview-bookings">
                        <span className={`portal-tag ${slot.booked >= slot.capacity ? "is-ok" : slot.booked ? "is-gold" : ""}`}>{slot.booked} / {slot.capacity} booked</span>
                        {slot.bookings.map((booking) => (
                          <Link key={booking.id} href={`/portal/recruitment/applications/${booking.id}`}>{booking.name}<small className="portal-muted">{booking.position}</small></Link>
                        ))}
                      </div>
                      {slot.booked === 0 && (
                        <form action={deleteInterviewSlot.bind(null, slot.id, day)}>
                          <button className="portal-icon-button is-light" type="submit" aria-label={`Delete the ${slotTimeRange(slot.startsAt, slot.durationMinutes)} slot`} title="Delete slot"><Trash2 size={15} /></button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>

      <aside className="interview-planner-side" aria-label="Interview settings">
        <section className="portal-card">
          <TitleWithInfo as="h2" className="portal-card-title" info="Pick days on the calendar first. With several days selected, the same slot is added to every one of them.">Add interview slots</TitleWithInfo>
          <InterviewSlotForm action={addAction} division={division} dates={formDates.length ? formDates : [today]} layout="side" />
        </section>
      </aside>
    </div>
  );
}
