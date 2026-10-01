"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Clock, MapPin, Video, X } from "lucide-react";
import { dateParts, formatDayLabel, formatMonth, monthCells, monthsBetween } from "@/lib/events/format";
import { venueModes } from "@/lib/events/options";
import { Facts, Organizer, SignUp, StatusTag } from "./event-parts";
import type { EventView } from "./event-view";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "upcoming" | "past";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

function readHash() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
}

/** The address's #fragment: an event's id, when a link points at one (/events#voters-forum). Empty on the server. */
const useHash = () => useSyncExternalStore(subscribeToHash, readHash, () => "");

/**
 * The Events page's two columns. On the left, the events as an accordion: opening one shows its
 * short description, its schedule and venue, and the buttons to read more and to register. On the
 * right, a month calendar with a dot on each day that has an event; picking a day narrows the list
 * to that day, and opening an event turns the calendar to its month. `events` come soonest first.
 */
export function EventsBoard({ events, today }: { events: EventView[]; today: string }) {
  const upcoming = events.filter((event) => !event.ended);
  // The most recent first.
  const past = events.filter((event) => event.ended).reverse();
  // The one that starts open: the next event that's still going ahead.
  const next = upcoming.find((event) => event.status !== "cancelled") ?? upcoming[0] ?? null;

  const [tab, setTab] = useState<Tab>("upcoming");
  /** The calendar day the list is narrowed to. */
  const [day, setDay] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(next?.id ?? null);
  const [month, setMonth] = useState((next?.date ?? today).slice(0, 7));
  const listRef = useRef<HTMLDivElement>(null);

  // A link to one event (/events#its-id) opens it, on whichever tab it's under, and brings it into view.
  const hash = useHash();
  const [seenHash, setSeenHash] = useState("");
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  if (hash !== seenHash) {
    setSeenHash(hash);
    const linked = events.find((event) => event.id === hash);
    if (linked) {
      setDay(null);
      setTab(linked.ended ? "past" : "upcoming");
      setOpenId(linked.id);
      setMonth(linked.date.slice(0, 7));
      setArrivedAt(linked.id);
    }
  }
  // Before paint, with the folding held still for a frame: the page arrives with that event already
  // open and in place, instead of landing on it and then watching the list shift as panels fold.
  useLayoutEffect(() => {
    const list = listRef.current;
    const target = arrivedAt ? document.getElementById(arrivedAt) : null;
    if (!list || !target) return;
    list.classList.add("is-arriving");
    target.scrollIntoView({ block: "start" });
    const frame = requestAnimationFrame(() => list.classList.remove("is-arriving"));
    return () => cancelAnimationFrame(frame);
  }, [arrivedAt]);

  const byDay = new Map<string, EventView[]>();
  for (const event of events) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event]);

  // The calendar turns from the earliest event's month to the latest's, and always reaches this month.
  const reach = [today.slice(0, 7), ...events.map((event) => event.date.slice(0, 7))].sort();
  const months = monthsBetween(reach[0], reach[reach.length - 1]);
  const monthIndex = months.indexOf(month);
  const inMonth = events.filter((event) => event.date.startsWith(month)).length;

  const shown = day ? (byDay.get(day) ?? []) : tab === "upcoming" ? upcoming : past;

  const toggle = (event: EventView) => {
    const opening = openId !== event.id;
    setOpenId(opening ? event.id : null);
    if (opening) setMonth(event.date.slice(0, 7));
  };

  const pickDay = (date: string) => {
    if (day === date) return setDay(null);
    setDay(date);
    setOpenId(byDay.get(date)?.[0]?.id ?? null);
    // Scrolled past the top of the list (or on a phone, where the calendar sits below it)? Come back up to it.
    const list = listRef.current;
    if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showTab = (value: Tab) => {
    setDay(null);
    setTab(value);
  };

  return (
    <div className="ev-layout">
      <section className="ev-list" ref={listRef} aria-labelledby="ev_list_title">
        <header className="ev-list-head">
          <h2 id="ev_list_title" className="ev-list-title">{day ? formatDayLabel(day) : tab === "upcoming" ? "Coming up" : "Past events"}</h2>
          {day ? (
            <button type="button" className="ev-clear" onClick={() => setDay(null)}>
              <X size={14} aria-hidden="true" />Show all events
            </button>
          ) : (
            <div className="ev-tabs" role="group" aria-label="Which events to list">
              {(["upcoming", "past"] as const).map((value) => (
                <button key={value} type="button" className={`ev-tab${tab === value ? " is-active" : ""}`} aria-pressed={tab === value} onClick={() => showTab(value)}>
                  {value === "upcoming" ? "Upcoming" : "Past"}
                  <small>{String(value === "upcoming" ? upcoming.length : past.length).padStart(2, "0")}</small>
                </button>
              ))}
            </div>
          )}
        </header>
        <p className="visually-hidden" role="status">{day ? `${plural(shown.length, "event")} on ${formatDayLabel(day)}` : `${plural(shown.length, tab === "upcoming" ? "upcoming event" : "past event")}`}</p>

        {shown.length > 0 ? (
          // Keyed so a new view plays in, rather than the old one's items rearranging.
          <ol className="ev-items" key={day ?? tab}>
            {shown.map((event) => {
              const open = openId === event.id;
              const parts = dateParts(event.date);
              const VenueIcon = event.venueMode === "online" ? Video : MapPin;
              return (
                <li key={event.id} id={event.id} className={`ev-item${open ? " is-open" : ""}${event.ended || event.status === "cancelled" ? " is-over" : ""}`}>
                  <Organizer event={event} />
                  <h3 className="ev-item-head">
                    <button type="button" className="ev-toggle" aria-expanded={open} aria-controls={`${event.id}_details`} onClick={() => toggle(event)}>
                      <span className="ev-date" aria-hidden="true">
                        <span>{parts.month}</span>
                        <b>{parts.day}</b>
                        <small>{parts.weekday}</small>
                      </span>
                      <span className="ev-item-main">
                        <span className="ev-item-title">{event.name}</span>
                        <span className="visually-hidden">, {event.dateLabel}</span>
                        <span className="ev-item-meta">
                          <span><Clock size={13} strokeWidth={1.8} aria-hidden="true" />{event.time}</span>
                          <span><VenueIcon size={13} strokeWidth={1.8} aria-hidden="true" />{venueModes[event.venueMode]} · {event.venue}</span>
                        </span>
                      </span>
                      <span className="ev-item-end">
                        <StatusTag event={event} />
                        <ChevronDown className="ev-chevron" size={18} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                    </button>
                  </h3>
                  {/* Closed panels are inert, so Tab skips the buttons inside them. */}
                  <div className="ev-panel" id={`${event.id}_details`} role="region" aria-label={`${event.name}: details`} inert={!open}>
                    <div>
                      <div className="ev-panel-inner">
                        <p className="ev-summary">{event.summary}</p>
                        <Facts event={event} />
                        <div className="ev-actions">
                          <Link className="ev-button is-ghost is-small" href={`/events/${event.id}`}>Read more<ArrowUpRight size={15} aria-hidden="true" /></Link>
                          <SignUp event={event} small />
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="ev-empty">
            <span className="ev-empty-scope" aria-hidden="true"><i /></span>
            {events.length === 0 ? (
              <>
                <h3>Nothing on the calendar yet.</h3>
                <p>Events and activities from the Central Comelec and every college’s unit appear here as soon as they’re announced.</p>
              </>
            ) : tab === "upcoming" ? (
              <>
                <h3>Nothing coming up right now.</h3>
                <p>The next event appears here as soon as it’s announced. Meanwhile, see what the commission has held so far.</p>
                <button type="button" className="ev-button is-ghost is-small" onClick={() => showTab("past")}>See past events</button>
              </>
            ) : (
              <>
                <h3>No past events yet.</h3>
                <p>Events move here once they’ve ended.</p>
              </>
            )}
          </div>
        )}
      </section>

      <aside className="ev-side" aria-label="Calendar of events">
        <div className="ev-calendar">
          <header className="ev-calendar-head">
            <h2 className="ev-calendar-month" aria-live="polite">{formatMonth(month)}</h2>
            <div className="ev-calendar-nav">
              {month !== today.slice(0, 7) && <button type="button" className="ev-calendar-today" onClick={() => setMonth(today.slice(0, 7))}>Today</button>}
              <button type="button" onClick={() => setMonth(months[monthIndex - 1])} disabled={monthIndex <= 0} aria-label="Previous month"><ChevronLeft size={16} aria-hidden="true" /></button>
              <button type="button" onClick={() => setMonth(months[monthIndex + 1])} disabled={monthIndex >= months.length - 1} aria-label="Next month"><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </header>
          <div className="ev-weekdays" aria-hidden="true">{weekdays.map((name) => <span key={name}>{name}</span>)}</div>
          {/* Keyed so the days play in as the month turns. */}
          <div className="ev-days" key={month} role="group" aria-label={`Days in ${formatMonth(month)}`}>
            {monthCells(month).map((cell, index) => {
              if (!cell) return <span key={`blank-${index}`} />;
              const list = byDay.get(cell);
              const number = Number(cell.slice(8));
              const state = `${cell === today ? " is-today" : ""}${cell < today ? " is-past" : ""}`;
              if (!list) return <span key={cell} className={`ev-day${state}`}><span className="ev-day-number">{number}</span></span>;
              return (
                <button
                  key={cell}
                  type="button"
                  className={`ev-day has-events${state}${day === cell ? " is-selected" : ""}${list.some((event) => event.id === openId) ? " is-open" : ""}`}
                  aria-pressed={day === cell}
                  aria-label={`${formatDayLabel(cell)}${cell === today ? ", today" : ""}: ${list.map((event) => event.name).join(", ")}`}
                  onClick={() => pickDay(cell)}
                >
                  <span className="ev-day-number">{number}</span>
                  <span className="ev-day-dots" aria-hidden="true">
                    {list.slice(0, 3).map((event) => <i key={event.id} className={`is-${event.organizer}${event.ended || event.status === "cancelled" ? " is-over" : ""}`} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <footer className="ev-calendar-foot">
            <p className="ev-legend"><span className="is-central"><i aria-hidden="true" />Central Comelec</span><span className="is-local"><i aria-hidden="true" />Local units</span></p>
            <p className="ev-calendar-count">{inMonth === 0 ? "No events this month" : `${plural(inMonth, "event")} this month`}</p>
          </footer>
        </div>
      </aside>
    </div>
  );
}
