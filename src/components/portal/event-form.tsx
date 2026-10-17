"use client";

import { formValueStamp, useFormDirty } from "@/components/use-form-dirty";
import { defaultRsvpDefinition, type RsvpSettings } from "@/lib/events/rsvp";
import { useId, useRef, useState, type ReactNode } from "react";
import { registrationStatuses, registrationStatusHints, type EventDetails, type RegistrationStatus } from "@/lib/events/options";
import { defaultEvaluation, type EvaluationSettings } from "@/lib/events/evaluation";
import { SlidingFilterButtons } from "./sliding-filters";
import { EventRsvpForm } from "./event-rsvp-form";
import { EventEvaluationEditor } from "./event-evaluation-editor";
import type { EditGuardInfo } from "@/lib/portal/edit-conflict";
import type { FormState } from "@/lib/portal/form";
import { EditConflict, EditPresence } from "./edit-guard";
import { FormViewModeButton } from "./form-view-mode-button";
import { EventDetailsFields } from "./event-details-fields";
import { EventCapacityFields, EventCapacityTracker } from "./event-capacity";
import type { CalendarHighlight } from "@/lib/calendar/options";
import { InfoTip } from "./info-tip";
import { FormActions, FormFooter, usePortalForm } from "./portal-form";

type Values = EventDetails & { registrationStatus: RegistrationStatus; requireGoogle: boolean; minimumRegistrants?: number; maximumRegistrants?: number | null; registeredCount?: number };

/**
 * The event form, for adding an event and editing one. The organizer isn't on it: it's the unit of
 * the account that adds the event. With `changeRequest` (an edit by a unit the Central Comelec asked
 * for changes), the request is shown at the top with a box to mark it addressed on save.
 */
export function EventForm({ action, initial, submitLabel, cancelHref, danger, changeRequest, rsvpSettings, evaluationSettings: initialEvaluation = defaultEvaluation, eventId, calendarHighlights = [], guard }: {
  calendarHighlights?: CalendarHighlight[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: Values;
  submitLabel: string;
  cancelHref: string;
  danger?: ReactNode;
  changeRequest?: string | null;
  rsvpSettings?: RsvpSettings | null;
  evaluationSettings?: EvaluationSettings;
  eventId?: string;
  guard?: EditGuardInfo;
}) {
  const [tab, setTab] = useState<"details" | "rsvp" | "evaluation">("details");
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [rsvpDefinition, setRsvpDefinition] = useState(rsvpSettings?.definition ?? defaultRsvpDefinition);
  // Whether each form was edited here: an untouched one isn't saved over someone else's (src/lib/portal/event-actions.ts).
  const [touched, setTouched] = useState({ rsvp: false, evaluation: false });
  const formId = useId();
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const details = useRef<HTMLDivElement>(null);
  const detailsDirty = useFormDirty(details);
  const rsvpDirty = formValueStamp(rsvpDefinition) !== formValueStamp(rsvpSettings?.definition ?? defaultRsvpDefinition);
  const evaluationDirty = formValueStamp(evaluation) !== formValueStamp(initialEvaluation);
  const hasEdits = !eventId || detailsDirty || rsvpDirty || evaluationDirty;
  const dateValidation = useRef<(() => boolean) | null>(null);
  // Each tab keeps its actions in the persistent footer; form editors include Reset on the left.
  const footerActions = <FormActions formId={formId} pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} cancelVisible={hasEdits} saveDisabled={!hasEdits} />;


  return (
    <div className="portal-event-editor">
      <div className="portal-event-editor-bar">
        <SlidingFilterButtons active={tab} label="Event editor tabs" items={[{ key: "details", label: "Details" }, { key: "rsvp", label: "RSVP Form" }, { key: "evaluation", label: "Evaluation Form" }]} onChange={setTab} />
        <div className="portal-event-editor-tools">
          <FormViewModeButton draft={tab === "details" ? { kind: "registration", name: initial.name || "This event", eventId: eventId ?? "preview" } : tab === "rsvp" ? { kind: "rsvp", name: initial.name || "This event", eventId: eventId ?? "preview", definition: rsvpDefinition } : { kind: "evaluation", name: initial.name || "This event", eventId: eventId ?? "preview", settings: evaluation }} />
        </div>
      </div>
      <form id={formId} className="portal-form" onSubmit={event => {
        if (!hasEdits) { event.preventDefault(); return; }
        if (dateValidation.current?.() === false) { event.preventDefault(); return; }
        onSubmit(event);
      }} noValidate>
        <input type="hidden" name="evaluationSettings" value={JSON.stringify(evaluation)} />
        <input type="hidden" name="rsvpDefinition" value={JSON.stringify(rsvpDefinition)} />
        <input type="hidden" name="rsvpTouched" value={touched.rsvp ? "on" : ""} />
        <input type="hidden" name="evaluationTouched" value={touched.evaluation ? "on" : ""} />
        <EditPresence guard={guard} />
        <EditConflict guard={guard} state={state} />
        <div ref={details} hidden={tab !== "details"}>
        {changeRequest && (
          <div className="portal-event-request is-pending portal-card">
            <p className="portal-eyebrow">Changes requested by the Central Comelec</p>
            <blockquote className="portal-request-text">{changeRequest}</blockquote>
            <label className="portal-check">
              <input name="requestAddressed" type="checkbox" defaultChecked />
              <span><strong>This edit makes those changes<InfoTip>Saving then clears the request, so the Central Comelec no longer sees it as waiting. Untick it to keep the request open.</InfoTip></strong></span>
            </label>
          </div>
        )}

        <EventDetailsFields initial={initial} errors={errors} calendarHighlights={calendarHighlights} dateValidation={dateValidation} hideRegistrationControls activity />
        <fieldset className="portal-form-section" disabled={pending}>
          <legend>Registration capacity</legend>
          <EventCapacityFields minimum={initial.minimumRegistrants ?? 1} maximum={initial.maximumRegistrants} errors={errors} />
          {eventId && <EventCapacityTracker registered={initial.registeredCount ?? 0} minimum={initial.minimumRegistrants ?? 1} maximum={initial.maximumRegistrants} />}
        </fieldset>

        {!eventId && <fieldset className="portal-form-section" disabled={pending} aria-describedby={errors.registrationStatus ? `${formId}-registration-status-error` : undefined}>
            <legend>Registration Status</legend>
            <div className="portal-options">{(Object.keys(registrationStatuses) as RegistrationStatus[]).map(status => <label className="portal-check" key={status}>
              <input type="radio" name="registrationStatus" value={status} defaultChecked={initial.registrationStatus === status} />
              <span><strong>{registrationStatuses[status]}</strong><small>{registrationStatusHints[status]}</small></span>
            </label>)}</div>
            {errors.registrationStatus && <p id={`${formId}-registration-status-error`} className="portal-field-error" role="alert">{errors.registrationStatus}</p>}
        </fieldset>}

        </div>
      </form>
      <div hidden={tab !== "rsvp"}>
        <EventRsvpForm settings={{ enabled: rsvpSettings?.enabled ?? false, committee_limit: rsvpSettings?.committee_limit ?? 2, invitation_token: rsvpSettings?.invitation_token ?? "", definition: rsvpDefinition }} editable={!pending} onChange={next => { setRsvpDefinition(next); setTouched(current => ({ ...current, rsvp: true })); }} actions={footerActions} resetDisabled={!hasEdits} />
        {errors.rsvpDefinition && <p className="portal-field-error" role="alert">{errors.rsvpDefinition}</p>}
      </div>
      <div hidden={tab !== "evaluation"}>
        <EventEvaluationEditor initial={evaluation} editable={!pending} embedded onChange={next => { setEvaluation(next); setTouched(current => ({ ...current, evaluation: true })); }} actions={footerActions} resetDisabled={!hasEdits} />
        {errors.evaluationSettings && <p className="portal-field-error" role="alert">{errors.evaluationSettings}</p>}
      </div>
      {tab === "details" && <FormFooter formId={formId} pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} danger={danger} cancelVisible={hasEdits} saveDisabled={!hasEdits} />}
    </div>
  );
}
