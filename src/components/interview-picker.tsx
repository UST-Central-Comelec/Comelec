"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { interviewModes, slotDate, slotDay, slotTimeRange, describeSlot, type InterviewSlot } from "@/lib/applications/interview-format";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthLabel = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(year, index - 1, 1));
};

/** The cells of a month grid: blanks before the 1st, then "YYYY-MM-DD" for each day. */
function monthCells(month: string) {
  const [year, index] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, index - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, day) => `${month}-${String(day + 1).padStart(2, "0")}`),
  ];
}

/**
 * Month calendar of open interview slots. Days with room are highlighted; picking one lists its
 * times. The chosen slot is sent as `interviewSlot`.
 */
export function InterviewPicker({ slots, value, onChange, invalid }: { slots: InterviewSlot[]; value: string; onChange: (id: string) => void; invalid?: boolean }) {
  const byDay = new Map<string, InterviewSlot[]>();
  for (const slot of slots) {
    const day = slotDay(slot.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), slot]);
  }
  const days = [...byDay.keys()].sort();
  const months = [...new Set(days.map((day) => day.slice(0, 7)))];
  const chosen = slots.find((slot) => slot.id === value);

  const [day, setDay] = useState(() => (chosen ? slotDay(chosen.startsAt) : days[0] ?? ""));
  const [month, setMonth] = useState(() => day.slice(0, 7) || months[0] || "");

  if (!slots.length) {
    return <p className="apply-note">No interview times are open for your division right now. Continue with your application, and the division will email you to schedule your interview.</p>;
  }

  const monthIndex = months.indexOf(month);
  const daySlots = byDay.get(day) ?? [];

  return (
    <div className={`interview-picker${invalid ? " has-error" : ""}`}>
      <input type="hidden" name="interviewSlot" value={value} />

      <div className="interview-calendar">
        <div className="interview-calendar-head">
          <button type="button" onClick={() => setMonth(months[monthIndex - 1])} disabled={monthIndex <= 0} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <strong aria-live="polite">{monthLabel(month)}</strong>
          <button type="button" onClick={() => setMonth(months[monthIndex + 1])} disabled={monthIndex >= months.length - 1} aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div className="interview-calendar-grid" role="group" aria-label={`Interview days in ${monthLabel(month)}`}>
          {weekdays.map((name) => <span key={name} className="interview-weekday" aria-hidden="true">{name}</span>)}
          {monthCells(month).map((cell, index) => {
            if (!cell) return <span key={`blank-${index}`} />;
            const open = byDay.get(cell);
            const label = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${cell}T00:00:00Z`));
            return (
              <button
                key={cell}
                type="button"
                className={`interview-day${open ? " has-slots" : ""}${cell === day ? " is-selected" : ""}${chosen && slotDay(chosen.startsAt) === cell ? " is-chosen" : ""}`}
                disabled={!open}
                aria-pressed={open ? cell === day : undefined}
                aria-label={open ? `${label}, ${open.length} ${open.length === 1 ? "time" : "times"} open` : label}
                onClick={() => setDay(cell)}
              >
                {Number(cell.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="interview-times">
        {daySlots.length ? (
          <>
            <strong className="interview-times-day">{slotDate(daySlots[0].startsAt)}</strong>
            <div className="interview-times-list" role="radiogroup" aria-label={`Times on ${slotDate(daySlots[0].startsAt)}`}>
              {daySlots.map((slot) => {
                const left = slot.capacity - slot.booked;
                return (
                  <label key={slot.id} className="interview-time">
                    <input type="radio" name="interviewSlotChoice" checked={slot.id === value} onChange={() => onChange(slot.id)} />
                    <span className="interview-time-text">
                      <strong>{slotTimeRange(slot.startsAt, slot.durationMinutes)}</strong>
                      <small>{[interviewModes[slot.mode], slot.location].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="interview-time-left">{left === 1 ? "1 spot left" : `${left} spots left`}</span>
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <p className="interview-times-empty">Pick a highlighted day to see its times.</p>
        )}
        {chosen && <p className="interview-chosen"><span>Your interview</span>{describeSlot(chosen)}</p>}
      </div>
    </div>
  );
}
