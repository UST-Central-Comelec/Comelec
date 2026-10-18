"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { SlidingFilterButtons } from "@/components/portal/sliding-filters";
import { dateParts, formatDayLabel } from "@/lib/events/format";
import "@/components/portal/secretariat-calendar.css";

// The filing portal's Calendar: a month of what concerns the account, in the Secretariat
// calendar's look (secretariat-calendar.css). Political Party Registration and Filing of Candidacy,
// the units' events, the account's own campaign schedule and requests, over the days the commission
// marks: no-campaign days, holidays and university events. Read only: each entry links to where
// it's changed. Worked out on the server (src/lib/filing-portal/calendar.ts).

export type FilingCalendarKind = "party-registration" | "candidacy" | "event" | "campaign" | "service";
export type FilingCalendarEntry = {
  id: string;
  kind: FilingCalendarKind;
  name: string;
  /** Whose it is, or where. */
  unit: string;
  /** YYYY-MM-DD, first and last day. */
  start: string;
  end: string;
  time: string;
  status: string;
  /** The status dot: open or confirmed, waiting, or over. */
  state: "open" | "waiting" | "off";
  cancelled?: boolean;
  href: string | null;
  /** On the website, so it opens in a new tab. */
  external?: boolean;
};
export type FilingCalendarHighlight = { id: string; start: string; end: string; kind: "moratorium" | "holiday" | "university"; label: string; unit: string };

const DAY = 86_400_000;
const timeOf = (day: string) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day: string, count: number) => new Date(timeOf(day) + count * DAY).toISOString().slice(0, 10);
const weekdayOf = (day: string) => new Date(timeOf(day)).getUTCDay();
const shiftMonth = (month: string, count: number) => {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + count, 1)).toISOString().slice(0, 7);
};
const overlaps = (item: { start: string; end: string }, day: string) => item.start <= day && item.end >= day;
const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long" });
const monthShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });
const dayShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const rangeLabel = (from: string, to: string) => (from === to ? dayShort.format(new Date(timeOf(from))) : `${dayShort.format(new Date(timeOf(from)))} – ${dayShort.format(new Date(timeOf(to)))}`);
const plural = (count: number, noun: string) => `${count} ${count === 1 ? noun : `${noun}s`}`;

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

const layers: FilingCalendarKind[] = ["candidacy", "party-registration", "event", "campaign", "service"];
const layerLabels: Record<FilingCalendarKind, string> = { candidacy: "Filing of Candidacy", "party-registration": "Party Registration", event: "Events", campaign: "Your campaign", service: "Your requests" };
/** Bottom to top along a day's foot. */
const stackRank: Record<FilingCalendarKind, number> = { "party-registration": 0, candidacy: 1, campaign: 2, service: 3, event: 4 };
const LANES = 3;
const highlightOrder = ["moratorium", "holiday", "university"] as const;

function layoutWeek(week: string[], entries: FilingCalendarEntry[]) {
  const segments: Array<{ entry: FilingCalendarEntry; column: number; lane: number }> = [];
  const hidden = week.map(() => 0);
  week.forEach((day, column) => {
    const stack = entries.filter((entry) => overlaps(entry, day)).sort((a, b) => stackRank[a.kind] - stackRank[b.kind] || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    hidden[column] = Math.max(0, stack.length - LANES);
    stack.slice(0, LANES).forEach((entry, lane) => segments.push({ entry, column, lane }));
  });
  return { segments, hidden };
}

export function FilingCalendar({ today, entries, highlights }: { today: string; entries: FilingCalendarEntry[]; highlights: FilingCalendarHighlight[] }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [direction, setDirection] = useState(0);
  const [view, setView] = useState<"month" | "list">("month");
  const [selected, setSelected] = useState(today);
  const [shown, setShown] = useState<Record<FilingCalendarKind, boolean>>(() => Object.fromEntries(layers.map((layer) => [layer, true])) as Record<FilingCalendarKind, boolean>);
  const grid = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);

  const visible = useMemo(() => entries.filter((entry) => shown[entry.kind]), [entries, shown]);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const highlightsOn = (day: string) => highlights.filter((highlight) => overlaps(highlight, day)).sort((a, b) => highlightOrder.indexOf(a.kind) - highlightOrder.indexOf(b.kind));
  const present = layers.filter((layer) => entries.some((entry) => entry.kind === layer));

  const goToMonth = (next: string) => {
    if (next === month) return;
    setDirection(next > month ? 1 : -1);
    setMonth(next);
  };
  const select = (day: string) => {
    setSelected(day);
    if (day.slice(0, 7) !== month) goToMonth(day.slice(0, 7));
  };

  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected, month]);

  const onCellKey = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekdayOf(day), End: 6 - weekdayOf(day) };
    if (!(event.key in moves)) return;
    event.preventDefault();
    focusAfterMove.current = true;
    select(addDays(day, moves[event.key]));
  };

  const dayEntries = visible.filter((entry) => overlaps(entry, selected));
  const dayHighlights = highlightsOn(selected);
  const parts = dateParts(selected);
  const monthEntries = visible.filter((entry) => entry.start <= `${month}-31` && entry.end >= `${month}-01`);
  const monthHighlights = highlights.filter((highlight) => highlight.start <= `${month}-31` && highlight.end >= `${month}-01`);

  return (
    <div className="cal pp-cal">
      <header className="cal-head">
        <div className="cal-head-title">
          <p className="portal-eyebrow">Calendar</p>
          <TitleWithInfo className="cal-month-title" info="Political Party Registration and Filing of Candidacy while your units take them, your units’ events, and your own campaign schedule and requests, over the days the Comelec marks: no-campaign days, holidays and university events. Pick a day to see what’s on it; open an item to change it where it’s kept.">{monthName.format(new Date(timeOf(`${month}-01`)))} <em>{month.slice(0, 4)}</em></TitleWithInfo>
        </div>
      </header>

      <div className="cal-body">
        <div className="cal-toolbar">
          <div className="cal-toolbar-navigation">
            <div className="cal-nav" role="group" aria-label="Month">
              <button type="button" onClick={() => goToMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={17} aria-hidden="true" /></button>
              <button type="button" className="cal-nav-today" onClick={() => { goToMonth(today.slice(0, 7)); setSelected(today); }}>Today</button>
              <button type="button" onClick={() => goToMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
            <SlidingFilterButtons items={[{ key: "month", label: "Month" }, { key: "list", label: "List" }]} active={view} label="View" onChange={setView} />
          </div>
        </div>

        <section className="cal-board" aria-label={`${monthName.format(new Date(timeOf(`${month}-01`)))} ${month.slice(0, 4)}`}>
          <div className="cal-board-head">
            <div className="cal-layers" role="group" aria-label="Show on the calendar">
              {(present.length ? present : layers).map((layer) => <button key={layer} type="button" data-layer={layer} aria-pressed={shown[layer]} onClick={() => setShown((current) => ({ ...current, [layer]: !current[layer] }))}><i aria-hidden="true" />{layerLabels[layer]}</button>)}
            </div>
          </div>
          {view === "month" ? (
            <div className="cal-month">
              <div className="cal-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => <span key={name}><b>{name}</b><i>{name.slice(0, 1)}</i></span>)}</div>
              <div key={month} ref={grid} className="cal-weeks" data-direction={direction} role="group" aria-label="Days">
                {weeks.map((week) => {
                  const { segments, hidden } = layoutWeek(week, visible);
                  return (
                    <div key={week[0]} className="cal-week">
                      {week.map((day, column) => {
                        const marks = highlightsOn(day);
                        const fill = marks[0];
                        const named = marks.find((mark) => mark.start === day || column === 0);
                        const onDay = visible.filter((entry) => overlaps(entry, day));
                        const label = [formatDayLabel(day), day === today && "today", ...marks.map((mark) => mark.label), onDay.length && plural(onDay.length, "item")].filter(Boolean).join(", ");
                        return (
                          <button key={day} type="button" className="cal-cell" style={{ gridColumn: column + 1 }} data-date={day} data-tone={fill?.kind} data-outside={day.slice(0, 7) !== month || undefined}
                            data-past={day < today || undefined} data-today={day === today || undefined} data-selected={day === selected || undefined} data-edge={day === selected ? "single" : undefined}
                            aria-pressed={day === selected} aria-current={day === today ? "date" : undefined} aria-label={label}
                            tabIndex={day === selected || (selected.slice(0, 7) !== month && day === `${month}-01`) ? 0 : -1}
                            onClick={() => select(day)} onKeyDown={(event) => onCellKey(event, day)}>
                            <span className="cal-cell-head">
                              <span className="cal-num">{day.endsWith("-01") && <span className="cal-num-month">{monthShort.format(new Date(timeOf(day)))}&nbsp;</span>}{Number(day.slice(8))}</span>
                              {named && <span className="cal-hl-name" data-tone={named.kind}>{named.label}</span>}
                            </span>
                            <span className="cal-dots" aria-hidden="true">{[...new Set(onDay.map((entry) => entry.kind))].map((kind) => <i key={kind} data-kind={kind} />)}</span>
                            <span className="cal-cell-foot" aria-hidden="true">{hidden[column] > 0 && <span className="cal-more">+{hidden[column]} more</span>}</span>
                          </button>
                        );
                      })}
                      {segments.map(({ entry, column, lane }) => (
                        <span key={`${entry.id}-${column}`} className="cal-bar" data-kind={entry.kind} data-cancelled={entry.cancelled || undefined} data-scheduled={entry.state === "waiting" && (entry.kind === "candidacy" || entry.kind === "party-registration") || undefined}
                          data-on-tone={highlightsOn(week[column]).length > 0 || undefined} style={{ gridColumn: column + 1, gridRow: LANES + 2 - lane }} title={`${entry.name} · ${rangeLabel(entry.start, entry.end)} · ${entry.unit}`} aria-hidden="true" />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pp-cal-list">
              {monthEntries.length || monthHighlights.length ? (
                <ul className="cal-rows">
                  {monthHighlights.map((highlight) => <Row key={highlight.id} highlight={highlight} />)}
                  {monthEntries.map((entry) => <Row key={entry.id} entry={entry} showDays />)}
                </ul>
              ) : <p className="cal-none">Nothing this month.</p>}
            </div>
          )}
        </section>

        <aside className="cal-side" aria-label="Picked day">
          <section className="cal-card cal-day">
            <header className="cal-day-head">
              <time className="cal-date-block" dateTime={selected} data-tone={dayHighlights[0]?.kind}><span>{parts.month}</span><strong>{parts.day}</strong><small>{parts.weekday}</small></time>
              <div>
                <h2>{formatDayLabel(selected)}</h2>
                <p className="cal-day-when" data-today={selected === today || undefined}>{selected === today ? "Today" : selected < today ? `${plural(Math.round((timeOf(today) - timeOf(selected)) / DAY), "day")} ago` : `In ${plural(Math.round((timeOf(selected) - timeOf(today)) / DAY), "day")}`}</p>
              </div>
            </header>
            <div className="cal-section">
              <h3>Schedule{dayEntries.length + dayHighlights.length > 0 && <span>{dayEntries.length + dayHighlights.length}</span>}</h3>
              {dayEntries.length || dayHighlights.length ? (
                <ul className="cal-rows">
                  {dayHighlights.map((highlight) => <Row key={highlight.id} highlight={highlight} />)}
                  {dayEntries.map((entry) => <Row key={entry.id} entry={entry} showDays={entry.start !== entry.end} />)}
                </ul>
              ) : <p className="cal-none">Nothing on the calendar this day.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ entry, highlight, showDays = false }: { entry?: FilingCalendarEntry; highlight?: FilingCalendarHighlight; showDays?: boolean }) {
  if (highlight) {
    return (
      <li className="cal-row is-highlight" data-tone={highlight.kind}>
        <i className="cal-swatch" aria-hidden="true" />
        <div>
          <strong>{highlight.label}</strong>
          <small>{highlight.kind === "moratorium" ? "No campaigning" : highlight.kind === "holiday" ? "No classes or offices" : "On the UST calendar"} · {rangeLabel(highlight.start, highlight.end)} · {highlight.unit}</small>
        </div>
      </li>
    );
  }
  if (!entry) return null;
  return (
    <li className="cal-row" data-kind={entry.kind} data-cancelled={entry.cancelled || undefined}>
      <i className="cal-swatch" aria-hidden="true" />
      <div>
        <small className="cal-row-kind">{layerLabels[entry.kind]}</small>
        <strong>{entry.name}</strong>
        {/* An event's times already name its days when it runs over several. */}
        <small>{showDays && entry.kind !== "event" ? `${rangeLabel(entry.start, entry.end)} · ` : ""}{entry.time}</small>
        <small>{entry.unit}</small>
        <small className="cal-row-status" data-state={entry.state}>{entry.status}</small>
      </div>
      {entry.href && (entry.external
        ? <a className="cal-row-link" href={entry.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${entry.name}`}>Open<ArrowUpRight size={14} aria-hidden="true" /></a>
        : <Link className="cal-row-link" href={entry.href} prefetch={false} aria-label={`Open ${entry.name}`}>Open<ArrowUpRight size={14} aria-hidden="true" /></Link>)}
    </li>
  );
}
