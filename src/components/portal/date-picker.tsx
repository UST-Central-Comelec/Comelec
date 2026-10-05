"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDays, calendarTime, formatPortalDate, shiftCalendarDay, shiftCalendarMonth } from "@/lib/forms/calendar";
export { formatPortalDate } from "@/lib/forms/calendar";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthName = (month: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(calendarTime(`${month}-01`));
type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/** A custom calendar dropdown with full-date labels and ISO form values. */
export function DatePicker({ name, value, defaultValue = "", onChange, min, max, required, invalid }: {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  const id = useId();
  const [ownValue, setOwnValue] = useState(defaultValue);
  const chosen = value ?? ownValue;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [month, setMonth] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);
  const clamp = (day: string) => min && day < min ? min : max && day > max ? max : day;

  const close = (focus = false) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const show = () => {
    const box = button.current?.getBoundingClientRect();
    if (!box || button.current?.disabled) return;
    const day = clamp(formatPortalDate(chosen) ? chosen : today);
    setMonth(day.slice(0, 7));
    setActive(day);
    const width = Math.min(320, window.innerWidth - 24);
    const below = window.innerHeight - box.bottom - 18;
    const above = box.top - 18;
    const up = below < 350 && above > below;
    setPlace({ left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)), width, maxHeight: Math.max(120, up ? above : below), ...(up ? { bottom: window.innerHeight - box.top + 6 } : { top: box.bottom + 6 }) });
    setOpen(true);
  };
  const pick = (day: string) => {
    if (day && !allowed(day)) return;
    if (value === undefined) setOwnValue(day);
    onChange?.(day);
    close(true);
  };
  const move = (day: string) => {
    const next = clamp(day);
    setActive(next);
    setMonth(next.slice(0, 7));
  };

  useEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    if (typeof element.showPopover === "function" && !element.matches(":popover-open")) element.showPopover();
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    const moved = (event: Event) => {
      if (event.target instanceof Node && element.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
    };
  }, [open]);
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)?.focus({ preventScroll: true });
  }, [open, active]);

  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in offsets) {
      event.preventDefault();
      move(shiftCalendarDay(day, offsets[event.key]));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      move(shiftCalendarMonth(day, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1)));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const weekday = new Date(calendarTime(day)).getUTCDay();
      move(shiftCalendarDay(day, event.key === "Home" ? -weekday : 6 - weekday));
    }
  };
  const days = month ? calendarDays(month) : [];
  const previous = month ? shiftCalendarMonth(`${month}-01`, -1).slice(0, 7) : "";
  const next = month ? shiftCalendarMonth(`${month}-01`, 1).slice(0, 7) : "";

  return (
    <span className={`portal-dropdown is-field portal-calendar${open ? " is-open" : ""}${invalid ? " is-invalid" : ""}`} onBlur={(event) => {
      const target = event.relatedTarget;
      if (target instanceof Node && (panel.current?.contains(target) || button.current?.contains(target))) return;
      close();
    }}>
      <button ref={button} type="button" role="combobox" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-calendar` : undefined} aria-invalid={invalid || undefined} aria-required={required || undefined} onClick={() => open ? close() : show()} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); }
        else if (event.key === "Escape") close();
      }}>
        <span className={chosen ? undefined : "is-placeholder"}>{formatPortalDate(chosen) || "Select date"}</span>
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      <input name={name} type="hidden" value={chosen} />
      {open && place && <span ref={panel} id={`${id}-calendar`} className="portal-calendar-panel" role="dialog" aria-label="Choose date" popover="manual" style={place} onClick={(event) => event.preventDefault()} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
      }}>
        <span className="portal-calendar-head">
          <button type="button" aria-label="Previous month" disabled={Boolean(min && previous < min.slice(0, 7))} onClick={() => move(shiftCalendarMonth(active, -1))}><ChevronLeft size={16} /></button>
          <span aria-live="polite">{monthName(month)}</span>
          <button type="button" aria-label="Next month" disabled={Boolean(max && next > max.slice(0, 7))} onClick={() => move(shiftCalendarMonth(active, 1))}><ChevronRight size={16} /></button>
        </span>
        <span className="portal-calendar-grid" role="grid" aria-label={monthName(month)}>
          <span role="row">{weekdays.map((day) => <span role="columnheader" key={day}>{day}</span>)}</span>
          {Array.from({ length: 6 }, (_, row) => <span role="row" key={row}>
            {days.slice(row * 7, row * 7 + 7).map((day) => <span role="gridcell" aria-selected={day === chosen} key={day}>
              <button type="button" data-day={day} tabIndex={day === active ? 0 : -1} disabled={!allowed(day)} aria-label={formatPortalDate(day)} aria-current={day === today ? "date" : undefined} className={`${day.slice(0, 7) !== month ? "is-outside " : ""}${day === chosen ? "is-selected" : ""}`} onKeyDown={(event) => onDayKey(event, day)} onClick={() => pick(day)}>{Number(day.slice(8))}</button>
            </span>)}
          </span>)}
        </span>
        <span className="portal-calendar-foot">
          <button type="button" disabled={!allowed(today)} onClick={() => pick(today)}>Today</button>
          {!required && <button type="button" onClick={() => pick("")}>Clear</button>}
          <button type="button" onClick={() => close(true)}>Done</button>
        </span>
      </span>}
    </span>
  );
}
