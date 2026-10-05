"use client";

import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import { dateParts, daysOf, formatDayLabel, formatMonth, monthCells, monthsBetween } from "@/lib/events/format";
import { comelecUnits, unitAbbreviations } from "@/lib/applications/options";
import { FACEBOOK_PAGE } from "@/lib/content";
import { venueModes } from "@/lib/events/options";
import { SignUp, StatusTag } from "./event-parts";
import { periodKinds, type PeriodKind } from "@/lib/periods/kinds";
import type { EventView } from "./event-view";
import styles from "./events-board.module.css";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Tab = "upcoming" | "past";
// The application choices cover undergraduate and first professional degrees. Event
// organizers also include UST's graduate schools and any unit present in the listings.
const academicUnits = [...comelecUnits, "Graduate School", "Graduate School of Law"];
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const subscribeToHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
function readHash() {
  try { return decodeURIComponent(window.location.hash.slice(1)); } catch { return ""; }
}

function EventCopyLink({ event }: { event: EventView }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2200);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(`/events/${event.id}`, window.location.origin).href);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  const label = status === "copied" ? "Link copied" : `Copy link to ${event.name}`;
  return <>
    <button type="button" className={styles.copyLink} onClick={copy} aria-label={label} title={label}>
      {status === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
    <span className={status === "failed" ? styles.copyError : styles.srOnly} role="status">{status === "copied" ? "Link copied" : status === "failed" ? "Couldn't copy the link. Try again." : ""}</span>
  </>;
}

/** An agenda filtered by organizing unit with a compact calendar. Event and registration destinations are shared with the detail pages. */
export function EventsBoard({ events, today }: { events: EventView[]; today: string }) {
  const organizerUnits = [...new Set([...academicUnits, ...events.flatMap((event) => event.organizer === "local" && event.college ? [event.college] : [])])].sort((a, b) => a.localeCompare(b));
  const organizers = [
    { value: "central", label: "Central Comelec" },
    ...organizerUnits.map((unit) => ({ value: unit, label: unit })),
  ];
  const allUnits = organizers.map(({ value }) => value);
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [selectedUnits, setUnits] = useState<string[] | null>(null);
  const units = selectedUnits ?? allUnits;
  const [day, setDay] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [monthDirection, setMonthDirection] = useState(0);
  const listRef = useRef<HTMLElement>(null);
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const [seenHash, setSeenHash] = useState("");
  const [arrivedAt, setArrivedAt] = useState<{ id: string } | null>(null);

  // A shared event link reveals its details, even after the visitor narrowed the list.
  if (hash !== seenHash) {
    setSeenHash(hash);
    const linked = events.find((event) => event.id === hash);
    if (linked) {
      setDay(null); setUnits(null);
      setTab(linked.ended ? "past" : "upcoming");
      setOpenId(linked.id); setMonth(linked.date.slice(0, 7)); setArrivedAt({ id: linked.id });
    }
  }
  useLayoutEffect(() => {
    if (!arrivedAt) return;
    document.getElementById(arrivedAt.id)?.scrollIntoView({ block: "nearest" });
  }, [arrivedAt]);

  const allOrganizers = units.length === organizers.length;
  const organizerLabel = allOrganizers ? "All organizers" : units.length === 0 ? "Select organizers" : units.length === 1 ? organizers.find(({ value }) => value === units[0])!.label : plural(units.length, "organizer");
  const filtered = events.filter((event) => allOrganizers || units.includes(event.organizer === "central" ? "central" : event.college ?? ""));
  const upcoming = filtered.filter((event) => !event.ended);
  const past = filtered.filter((event) => event.ended).reverse();
  const byDay = new Map<string, EventView[]>();
  for (const event of filtered) for (const date of daysOf({ eventDate: event.date, endDate: event.endDate })) byDay.set(date, [...(byDay.get(date) ?? []), event]);
  const shown = day ? (byDay.get(day) ?? []) : tab === "upcoming" ? upcoming : past;
  const reach = [today.slice(0, 7), ...events.flatMap((event) => [event.date.slice(0, 7), event.endDate.slice(0, 7)])].sort();
  const months = monthsBetween(reach[0], reach[reach.length - 1]);
  const monthIndex = months.indexOf(month);
  const monthEvents = filtered.filter((event) => event.date.slice(0, 7) <= month && event.endDate.slice(0, 7) >= month);
  const changeMonth = (direction: -1 | 1) => {
    const nextMonth = months[monthIndex + direction];
    if (!nextMonth) return;
    setMonthDirection(direction);
    setMonth(nextMonth);
  };

  const pickDay = (date: string) => {
    setDay(day === date ? null : date); setOpenId(null);
    if (listRef.current && listRef.current.getBoundingClientRect().top < 0) listRef.current.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const showEvent = (event: EventView) => {
    setDay(null); setTab(event.ended ? "past" : "upcoming"); setOpenId(event.id); setArrivedAt({ id: event.id });
  };
  const resetFilters = () => { setUnits(null); setDay(null); };

  return (
    <div className={styles.board}>
      <div className={styles.layout}>
        <section ref={listRef} className={styles.list} aria-label="Events and activities">
          <div className={styles.toolbar}>
            <LayoutGroup>
              <div className={styles.tabs} role="group" aria-label="Event schedule">
                {(["upcoming", "past"] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value && !day} onClick={() => { setTab(value); setDay(null); }}><span>{value === "upcoming" ? "Upcoming" : "Past events"}</span><small>{value === "upcoming" ? upcoming.length : past.length}</small>{tab === value && !day && <motion.span className={styles.tabIndicator} layoutId="event-schedule-indicator" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34 }} aria-hidden="true" />}</button>)}
              </div>
            </LayoutGroup>
            <div className={styles.organizerFilter}>
              <Popover.Root>
                <Popover.Trigger className={styles.organizerTrigger} aria-label={`Filter organizers: ${organizerLabel}`}>
                  <span className={styles.organizerValue}>{organizerLabel}</span>
                  <span className={styles.organizerSizer} aria-hidden="true">{organizers.map(({ value, label }) => <span key={value}>{label}</span>)}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner className={styles.organizerPositioner} sideOffset={8} align="end">
                    <Popover.Popup className={styles.organizerPopup} data-lenis-prevent>
                      <Popover.Title className={styles.srOnly}>Filter organizers</Popover.Title>
                      <label>
                        <input type="checkbox" checked={allOrganizers} ref={(input) => { if (input) input.indeterminate = units.length > 0 && !allOrganizers; }} onChange={() => setUnits(allOrganizers ? [] : null)} />
                        <span>All organizers</span>
                      </label>
                      {organizers.map(({ value, label }) => <label key={value}>
                        <input type="checkbox" checked={units.includes(value)} onChange={() => setUnits(units.includes(value) ? units.filter((unit) => unit !== value) : [...units, value])} />
                        <span>{label}</span>
                      </label>)}
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>
          <div className={styles.filters}>
            <span>{plural(shown.length, "event")}</span>
          </div>
          {day && <div className={styles.dayFilter}><span>{formatDayLabel(day)}</span><button type="button" onClick={() => setDay(null)}>Clear date <X size={14} aria-hidden="true" /></button></div>}
          <p className={styles.srOnly} role="status">{plural(shown.length, "event")}{day ? ` on ${formatDayLabel(day)}` : ` in ${tab}`}</p>
          {shown.length ? <ol className={styles.items}>{shown.map((event) => {
            const parts = dateParts(event.date);
            const open = openId === event.id;
            const organizerLabel = event.organizer === "central" ? "Central Comelec" : unitAbbreviations[event.college ?? ""] ?? (event.college === "Graduate School" ? "GS" : event.college === "Graduate School of Law" ? "GSL" : (event.college ?? "Local").split(/\s+/).map((word) => word[0]).join("").toUpperCase());
            return <li key={event.id} id={event.id} className={styles.item} onClick={(click) => {
              // Keep the card's links and Details button independent of this shortcut.
              if ((click.target as HTMLElement).closest("a, button") || window.getSelection()?.toString()) return;
              setOpenId((current) => current === event.id ? null : event.id);
            }}>
              <span className={styles.organizer} data-unit={organizerLabel} title={event.unit} aria-label={`Organized by ${event.unit}`}>{organizerLabel}</span>
              <button type="button" className={styles.detailToggle} aria-expanded={open} aria-controls={`${event.id}_details`} onClick={() => setOpenId(open ? null : event.id)}>{open ? "Less detail" : "Details"}<ChevronDown size={15} aria-hidden="true" /></button>
              <div className={styles.itemHeader}>
                <time className={styles.date} dateTime={event.date}><span>{parts.month}</span><strong>{parts.day}</strong><small>{parts.weekday}</small></time>
                <div className={styles.itemContent}>
                  <div className={styles.eventStatus}><StatusTag event={event} /></div>
                  <div className={styles.titleRow}><h3>{event.name}</h3><EventCopyLink event={event} /></div>
                  <p className={styles.meta}><span>{event.time}</span><span>{venueModes[event.venueMode]}</span></p>
                </div>
              </div>
              <div className={`${styles.details}${open ? ` ${styles.openDetails}` : ""}`} id={`${event.id}_details`} role="region" aria-label={`${event.name}: details`} inert={!open}>
                <div><p className={styles.summary}>{event.summary}</p><dl><div><dt>When</dt><dd>{event.dateLabel}</dd></div><div><dt>Where</dt><dd>{event.venue}</dd></div><div><dt>Who can join</dt><dd>{event.audience}</dd></div>{event.period?.closes && <div><dt>Sign-up deadline</dt><dd>{event.period.closes}</dd></div>}{event.ingress && <div><dt>Ingress</dt><dd>{event.ingress}</dd></div>}{event.egress && <div><dt>Egress</dt><dd>{event.egress}</dd></div>}</dl></div>
              </div>
              <footer className={styles.itemFooter}>
                <Link className={styles.viewLink} href={`/events/${event.id}`}>Learn more<ArrowRight size={15} aria-hidden="true" /></Link>
                {event.signUp && <div className={styles.actions}><SignUp event={event} small /></div>}
              </footer>
            </li>;
          })}</ol> : <div className={styles.empty}><CalendarDays size={28} strokeWidth={1.4} aria-hidden="true" /><h3>{!allOrganizers || day ? "No events match your filters." : tab === "past" ? "No past events yet." : "Nothing scheduled just yet."}</h3><p>{!allOrganizers || day ? "Try another organizer or date." : "Check back for the next activity from the commission."}</p>{(!allOrganizers || day) && <button type="button" onClick={resetFilters}>Reset filters<ArrowRight size={15} aria-hidden="true" /></button>}</div>}
        </section>

        <aside className={styles.side} aria-label="Calendar of events">
          <section className={styles.calendar}>
            <header className={styles.calendarHead}><h3 aria-live="polite">{formatMonth(month)}</h3><div><button type="button" onClick={() => changeMonth(-1)} disabled={monthIndex <= 0} aria-label="Previous month"><ChevronLeft size={17} aria-hidden="true" /></button><button type="button" onClick={() => changeMonth(1)} disabled={monthIndex >= months.length - 1} aria-label="Next month"><ChevronRight size={17} aria-hidden="true" /></button></div></header>
            <div className={styles.weekdays} aria-hidden="true">{weekdays.map((name) => <span key={name}>{name.slice(0, 1)}</span>)}</div>
            <motion.div key={month} className={styles.days} initial={reduceMotion || !monthDirection ? false : { x: monthDirection * 18, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : .28, ease: [.22, 1, .36, 1] }} role="group" aria-label={`Days in ${formatMonth(month)}`}>{monthCells(month).map((cell, index) => {
              if (!cell) return <span key={`blank-${index}`} />;
              const list = byDay.get(cell);
              const hasEvents = !!list?.length;
              const regularEvent = list?.some((event) => !event.period) ?? false;
              const periods = (Object.keys(periodKinds) as PeriodKind[]).filter((kind) => list?.some((event) => event.period?.kind === kind));
              return <button key={cell} type="button" className={styles.day} data-today={cell === today} data-events={hasEvents} data-regular-event={regularEvent} aria-pressed={day === cell} aria-current={cell === today ? "date" : undefined} aria-label={`${formatDayLabel(cell)}${cell === today ? ", today" : ""}${hasEvents ? `: ${plural(list.length, "event")}${regularEvent ? ", event scheduled" : ""}${periods.map((kind) => `, ${periodKinds[kind].title}`).join("")}` : ": no events"}`} disabled={!hasEvents} onClick={() => pickDay(cell)}><span>{Number(cell.slice(8))}</span>{hasEvents && <span className={styles.dayDots} aria-hidden="true">{regularEvent && <i />}{periods.map((kind) => <i key={kind} data-kind={kind} />)}</span>}</button>;
            })}</motion.div>
            <div className={styles.monthAgenda}>{monthEvents.length ? <ul>{monthEvents.slice(0, 3).map((event) => <li key={event.id}><button type="button" onClick={() => showEvent(event)}><span className={styles.agendaDate}>{event.date.slice(0, 7) < month ? "Now" : dateParts(event.date).day}</span><span><strong>{event.name}</strong><small>{event.dateLabel}</small></span><ArrowUpRight size={14} aria-hidden="true" /></button></li>)}</ul> : <p>No events scheduled for this month.</p>}{monthEvents.length > 3 && <p>+{monthEvents.length - 3} more in the event list</p>}</div>
          </section>
          <a className={styles.updates} href={FACEBOOK_PAGE} target="_blank" rel="noreferrer"><span><strong>Commission updates</strong><small>Announcements and reminders on Facebook</small></span><ArrowUpRight size={19} aria-hidden="true" /></a>
        </aside>
      </div>
    </div>
  );
}
