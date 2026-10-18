"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDays, calendarTime, formatPortalDate, shiftCalendarDay, shiftCalendarMonth } from "@/lib/forms/calendar";
import { highlightKinds, type CalendarHighlight } from "@/lib/calendar/options";
import { dateConflicts, orderedDateRange } from "@/lib/calendar/date-conflicts";
import { formatBirthday, parseBirthday } from "@/lib/forms/birthday";
import "./date-picker.css";
export { formatPortalDate } from "@/lib/forms/calendar";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthName = (month: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(calendarTime(`${month}-01`));
type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/** A custom calendar dropdown with full-date labels and ISO form values. */
export function DatePicker({ name, value, defaultValue = "", onChange, onRangeChange, rangeEnd, highlights = [], min, max, required, invalid, id: inputId, label, describedBy, editable = false }: {
  name?: string;
  id?: string;
  label?: string;
  describedBy?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onRangeChange?: (start: string, end: string) => void;
  rangeEnd?: string;
  highlights?: CalendarHighlight[];
  min?: string;
  max?: string;
  required?: boolean;
  invalid?: boolean;
  /** A typed MM/DD/YYYY field alongside the shared calendar button. */
  editable?: boolean;
}) {
  const id = useId();
  const [ownValue, setOwnValue] = useState(defaultValue);
  const rawValue = value ?? ownValue;
  const chosen = editable ? parseBirthday(rawValue) : rawValue;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [month, setMonth] = useState("");
  const [pickerView, setPickerView] = useState<"days" | "years" | "months">("days");
  const [yearStart, setYearStart] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ start: string; end: string; pointerId?: number } | null>(null);
  const [preview, setPreview] = useState<{ start: string; end: string } | null>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);
  const clamp = (day: string) => min && day < min ? min : max && day > max ? max : day;

  const close = (focus = false) => {
    drag.current = null;
    setPreview(null);
    setOpen(false);
    if (focus) (editable ? textInput.current : button.current)?.focus();
  };
  const show = () => {
    const box = (editable ? textInput.current : button.current)?.getBoundingClientRect();
    if (!box || button.current?.matches(":disabled")) return;
    const day = clamp(formatPortalDate(chosen) ? chosen : today);
    setMonth(day.slice(0, 7));
    setActive(day);
    setPickerView("days");
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
    if (onRangeChange && day) {
      const range = preview ?? { start: day, end: day };
      onRangeChange(range.start, range.end);
    } else onChange?.(day);
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
  }, [open, active, pickerView]);

  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in offsets) {
      event.preventDefault();
      const next = clamp(shiftCalendarDay(day, offsets[event.key]));
      if (onRangeChange && event.shiftKey) {
        const anchor = drag.current?.start ?? day;
        drag.current = { start: anchor, end: next };
        setPreview(orderedDateRange(anchor, next));
      } else { drag.current = null; setPreview(null); }
      move(next);
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
  const range = preview ?? (onRangeChange && chosen ? orderedDateRange(chosen, rangeEnd || chosen) : null);
  const year = Number(active.slice(0, 4));
  const firstYear = Number(min?.slice(0, 4) ?? Number(today.slice(0, 4)) - 121);
  const lastYear = Number(max?.slice(0, 4) ?? today.slice(0, 4));

  return (
    <span className={`portal-dropdown is-field portal-calendar${editable ? " is-editable" : ""}${open ? " is-open" : ""}${invalid ? " is-invalid" : ""}`} onBlur={(event) => {
      const target = event.relatedTarget;
      if (target instanceof Node && (panel.current?.contains(target) || button.current?.contains(target) || textInput.current?.contains(target))) return;
      close();
    }}>
      {editable && <input ref={textInput} id={inputId} name={name} type="text" inputMode="numeric" autoComplete="bday" placeholder="MM/DD/YYYY" maxLength={10} pattern="[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}" required={required} aria-label={label} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={formatBirthday(rawValue)} onChange={(event) => {
        let next = event.target.value.replace(/[^0-9/]/g, "");
        if (next.length > formatBirthday(rawValue).length || /^\d{8}$/.test(next)) {
          next = next.replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{1,2}\/\d{2})(\d)/, "$1/$2");
        }
        if (value === undefined) setOwnValue(next);
        onChange?.(next);
      }} onKeyDown={(event) => {
        if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); show(); }
        else if (event.key === "Escape") close();
      }} />}
      <button ref={button} id={editable ? undefined : inputId} aria-label={editable ? `Choose ${label?.toLowerCase() || "date"}` : label} aria-describedby={describedBy} type="button" role={editable ? undefined : "combobox"} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-calendar` : undefined} aria-invalid={invalid || undefined} aria-required={editable ? undefined : required || undefined} onClick={() => open ? close() : show()} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); }
        else if (event.key === "Escape") close();
      }}>
        {!editable && <span className={chosen ? undefined : "is-placeholder"}>{formatPortalDate(chosen) || "Select date"}</span>}
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      {!editable && <input name={name} type="hidden" value={chosen} data-required={required || undefined} />}
      {open && place && <span ref={panel} id={`${id}-calendar`} className="portal-calendar-panel" role="dialog" aria-label="Choose date" popover="manual" style={place} onClick={(event) => event.preventDefault()} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
      }}>
        <span className="portal-calendar-head">
          <button type="button" aria-label={pickerView === "years" ? "Previous years" : pickerView === "months" ? "Previous year" : "Previous month"} disabled={pickerView === "years" ? yearStart <= firstYear : pickerView === "months" ? year <= firstYear : Boolean(min && previous < min.slice(0, 7))} onClick={() => pickerView === "years" ? setYearStart(yearStart - 12) : move(shiftCalendarMonth(active, pickerView === "months" ? -12 : -1))}><ChevronLeft size={16} /></button>
          {editable ? <button type="button" className="portal-calendar-month-button" aria-label="Choose month and year" onClick={() => { setYearStart(Math.floor(year / 12) * 12); setPickerView("years"); }}>{pickerView === "years" ? `${yearStart}–${yearStart + 11}` : pickerView === "months" ? year : monthName(month)}</button> : <span aria-live="polite">{monthName(month)}</span>}
          <button type="button" aria-label={pickerView === "years" ? "Next years" : pickerView === "months" ? "Next year" : "Next month"} disabled={pickerView === "years" ? yearStart + 11 >= lastYear : pickerView === "months" ? year >= lastYear : Boolean(max && next > max.slice(0, 7))} onClick={() => pickerView === "years" ? setYearStart(yearStart + 12) : move(shiftCalendarMonth(active, pickerView === "months" ? 12 : 1))}><ChevronRight size={16} /></button>
        </span>
        {pickerView === "years" && <span className="portal-calendar-jump" role="group" aria-label="Choose year">{Array.from({ length: 12 }, (_, index) => yearStart + index).map((option) => <button key={option} type="button" disabled={option < firstYear || option > lastYear} aria-pressed={option === year} onClick={() => { move(shiftCalendarMonth(active, (option - year) * 12)); setPickerView("months"); }}>{option}</button>)}</span>}
        {pickerView === "months" && <span className="portal-calendar-jump" role="group" aria-label="Choose month">{Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`).map((option, index) => <button key={option} type="button" disabled={Boolean((min && option < min.slice(0, 7)) || (max && option > max.slice(0, 7)))} aria-pressed={option === month} onClick={() => { move(shiftCalendarMonth(active, index - Number(active.slice(5, 7)) + 1)); setPickerView("days"); }}>{new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(calendarTime(`${option}-01`))}</button>)}</span>}
        {onRangeChange && <span className="portal-calendar-hint">Drag across days to set the start and end. Use Shift + arrow keys, then Enter, with a keyboard.</span>}
        <span hidden={pickerView !== "days"} className={`portal-calendar-grid${onRangeChange ? " is-range-picker" : ""}`} role="grid" aria-label={monthName(month)} onPointerDown={(event) => {
          if (!onRangeChange || event.button !== 0 || !(event.target instanceof Element)) return;
          const target = event.target.closest<HTMLButtonElement>("button[data-day]");
          const day = target?.dataset.day;
          if (!day || target?.disabled) return;
          event.preventDefault();
          drag.current = { start: day, end: day, pointerId: event.pointerId };
          setPreview({ start: day, end: day });
          event.currentTarget.setPointerCapture(event.pointerId);
        }} onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("button[data-day]");
          const day = target?.dataset.day;
          if (!day || target?.disabled || !event.currentTarget.contains(target)) return;
          drag.current.end = day;
          setPreview(orderedDateRange(drag.current.start, day));
        }} onPointerUp={(event) => {
          const selection = drag.current;
          if (!selection || selection.pointerId !== event.pointerId) return;
          event.preventDefault();
          const range = orderedDateRange(selection.start, selection.end);
          onRangeChange?.(range.start, range.end);
          close(true);
        }} onPointerCancel={() => { drag.current = null; setPreview(null); }} onLostPointerCapture={() => { drag.current = null; setPreview(null); }}>
          <span role="row">{weekdays.map((day) => <span role="columnheader" key={day}>{day}</span>)}</span>
          {Array.from({ length: 6 }, (_, row) => <span role="row" key={row}>
            {days.slice(row * 7, row * 7 + 7).map((day) => {
              const marked = dateConflicts(highlights, day, day);
              const selected = range ? day >= range.start && day <= range.end : day === chosen;
              const description = marked.map(highlight => `${highlightKinds[highlight.kind].label}${highlight.label ? `: ${highlight.label}` : ""}`).join("; ");
              return <span role="gridcell" aria-selected={selected} key={day}>
                <button type="button" data-day={day} data-calendar-kind={marked[0]?.kind} tabIndex={day === active ? 0 : -1} disabled={!allowed(day)} aria-label={`${formatPortalDate(day)}${description ? `. ${description}` : ""}`} title={description || undefined} aria-current={day === today ? "date" : undefined} className={`${day.slice(0, 7) !== month ? "is-outside " : ""}${selected ? "is-selected" : ""}`} onKeyDown={(event) => onDayKey(event, day)} onClick={() => pick(day)}>{Number(day.slice(8))}</button>
              </span>;
            })}
          </span>)}
        </span>
        {highlights.some(highlight => highlight.kind !== "custom") && <span className="portal-calendar-legend">{(["moratorium", "holiday", "university"] as const).map(kind => <span key={kind}><i data-calendar-kind={kind} aria-hidden="true" />{highlightKinds[kind].label}</span>)}</span>}
        <span className="portal-calendar-foot">
          <button type="button" disabled={!allowed(today)} onClick={() => pick(today)}>Today</button>
          {!required && <button type="button" onClick={() => pick("")}>Clear</button>}
          <button type="button" onClick={() => close(true)}>Done</button>
        </span>
      </span>}
    </span>
  );
}
