"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { AlertTriangle } from "lucide-react";
import { dateConflicts } from "@/lib/calendar/date-conflicts";
import { highlightKinds, type CalendarHighlight } from "@/lib/calendar/options";
import { DatePicker, formatPortalDate } from "./date-picker";
import { Field } from "./portal-form";

export type DateValidation = RefObject<(() => boolean) | null>;
type Selection = { start: string; end: string; target: "start" | "end" | "submit" };

export function EventScheduleFields({ start, end, onChange, errors, highlights, validationRef }: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  errors: Record<string, string>;
  highlights: CalendarHighlight[];
  validationRef?: DateValidation;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const fields = useRef<HTMLDivElement>(null);
  const acknowledged = useRef<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const conflicts = selection ? dateConflicts(highlights, selection.start, selection.end) : [];
  const signature = (start: string, end: string) => JSON.stringify([start, end, dateConflicts(highlights, start, end)]);

  const choose = (start: string, end: string, target: Selection["target"]) => {
    acknowledged.current = null;
    if (dateConflicts(highlights, start, end).length) setSelection({ start, end, target });
    else onChange(start, end);
  };

  useEffect(() => {
    if (selection && !dialog.current?.open) dialog.current?.showModal();
  }, [selection]);

  useEffect(() => {
    if (!validationRef) return;
    validationRef.current = () => {
      if (!dateConflicts(highlights, start, end).length || acknowledged.current === signature(start, end)) return true;
      setSelection({ start, end, target: "submit" });
      return false;
    };
    return () => { validationRef.current = null; };
  });

  const changeDate = () => {
    const target = selection?.target === "end" ? "end" : "start";
    dialog.current?.close();
    setSelection(null);
    fields.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${id}-${target}`)}`)?.click();
  };
  const proceed = () => {
    if (!selection) return;
    acknowledged.current = signature(selection.start, selection.end);
    if (selection.target !== "submit") onChange(selection.start, selection.end);
    dialog.current?.close();
    setSelection(null);
    if (selection.target === "submit") fields.current?.closest("form")?.requestSubmit();
  };

  return (
    <>
      <div ref={fields} className="portal-event-date-fields">
        <Field label="Start date" hint="Drag across days to set both dates. The last day becomes the end date." error={errors.eventDate}>
          <DatePicker id={`${id}-start`} name="eventDate" value={start} rangeEnd={end} highlights={highlights} invalid={Boolean(errors.eventDate)} onRangeChange={(start, end) => choose(start, end, "start")} required />
        </Field>
        <Field label="End date" hint="The day the event ends." error={errors.endDate}>
          <DatePicker id={`${id}-end`} name="endDate" value={end} min={start} highlights={highlights} invalid={Boolean(errors.endDate)} onChange={end => choose(start, end, "end")} required />
        </Field>
      </div>
      <dialog ref={dialog} role="alertdialog" className="portal-registrant-confirmation portal-event-date-conflict" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onCancel={event => { event.preventDefault(); changeDate(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) changeDate(); } }}>
        <h2 id={`${id}-title`}><AlertTriangle size={22} aria-hidden="true" />Date conflict</h2>
        <p id={`${id}-message`}>Your event overlaps these calendar dates. Change the dates or proceed with the conflict.</p>
        <ul className="portal-event-date-conflicts">
          {conflicts.map(highlight => {
            const first = highlight.start > selection!.start ? highlight.start : selection!.start;
            const last = highlight.end < selection!.end ? highlight.end : selection!.end;
            return <li key={highlight.id}><strong>{highlightKinds[highlight.kind].label}{highlight.label ? `: ${highlight.label}` : ""}</strong><span>{formatPortalDate(first)}{last !== first ? ` – ${formatPortalDate(last)}` : ""}</span></li>;
          })}
        </ul>
        <div className="portal-registrant-confirmation-actions">
          <button type="button" className="portal-button is-ghost portal-change-event-date" autoFocus onClick={changeDate}>Change date</button>
          <button type="button" className="portal-button is-danger" onClick={proceed}>Proceed anyway</button>
        </div>
      </dialog>
    </>
  );
}
