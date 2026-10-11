"use client";

import { defaultRsvpDefinition, type RsvpSettings } from "@/lib/events/rsvp";
import { useId, useRef, useState, type ReactNode } from "react";
import { registrationStatuses, registrationStatusHints, type EventDetails, type RegistrationStatus } from "@/lib/events/options";
import { defaultEvaluation, type EvaluationSettings } from "@/lib/events/evaluation";
import { SlidingFilterButtons } from "./sliding-filters";
import { EventRsvpForm } from "./event-rsvp-form";
import { EventEvaluationEditor } from "./event-evaluation-editor";
import { EventFormLinks } from "./event-form-links";
import type { FormState } from "@/lib/portal/form";
import { FormEditorViewToggle, useFormEditorMode } from "./event-form-editor";
import { EventDetailsFields } from "./event-details-fields";
import type { CalendarHighlight } from "@/lib/calendar/options";
import { InfoTip } from "./info-tip";
import { FormActions, FormFooter, usePortalForm } from "./portal-form";

type Values = EventDetails & { registrationStatus: RegistrationStatus; requireGoogle: boolean };

/**
 * The event form, for adding an event and editing one. The organizer isn't on it: it's the unit of
 * the account that adds the event. With `changeRequest` (an edit by a unit the Central Comelec asked
 * for changes), the request is shown at the top with a box to mark it addressed on save.
 */
export function EventForm({ action, initial, submitLabel, cancelHref, danger, changeRequest, rsvpSettings, evaluationSettings: initialEvaluation = defaultEvaluation, eventId, baseUrl, calendarHighlights = [] }: {
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
  baseUrl?: string;
}) {
  const [tab, setTab] = useState<"details" | "rsvp" | "evaluation">("details");
  const { mode, pickMode } = useFormEditorMode();
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [rsvpDefinition, setRsvpDefinition] = useState(rsvpSettings?.definition ?? defaultRsvpDefinition);
  const formId = useId();
  const { pending, onSubmit, errors } = usePortalForm(action);
  const dateValidation = useRef<(() => boolean) | null>(null);
  // On the two form editors, Cancel and Save sit at the top beside Reset; the Details tab keeps its footer and its Delete.
  const topActions = <FormActions formId={formId} pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} small />;

  return (
    <div className="portal-event-editor">
      <div className="portal-event-editor-bar">
        <SlidingFilterButtons active={tab} label="Event editor tabs" items={[{ key: "details", label: "Details" }, { key: "rsvp", label: "RSVP Form" }, { key: "evaluation", label: "Evaluation Form" }]} onChange={setTab} />
        {eventId && baseUrl && <EventFormLinks eventId={eventId} eventName={initial.name} baseUrl={baseUrl} form={tab === "details" ? "registration" : tab} />}
        {tab !== "details" && <div className="portal-event-editor-view"><FormEditorViewToggle mode={mode} onChange={pickMode} /></div>}
      </div>
      <form id={formId} className="portal-form" onSubmit={event => {
        if (dateValidation.current?.() === false) { event.preventDefault(); return; }
        onSubmit(event);
      }} noValidate>
        <input type="hidden" name="evaluationSettings" value={JSON.stringify(evaluation)} />
        <input type="hidden" name="rsvpDefinition" value={JSON.stringify(rsvpDefinition)} />
        <div hidden={tab !== "details"}>
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

        <EventDetailsFields initial={initial} errors={errors} calendarHighlights={calendarHighlights} dateValidation={dateValidation} hideRegistrationControls allowBothVenue />

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
        <EventRsvpForm eventId={eventId} eventName={initial.name || "This event"} settings={{ enabled: rsvpSettings?.enabled ?? false, committee_limit: rsvpSettings?.committee_limit ?? 2, invitation_token: rsvpSettings?.invitation_token ?? "", definition: rsvpDefinition }} editable={!pending} onChange={setRsvpDefinition} actions={topActions} viewMode={mode} />
        {errors.rsvpDefinition && <p className="portal-field-error" role="alert">{errors.rsvpDefinition}</p>}
      </div>
      <div hidden={tab !== "evaluation"}>
        <EventEvaluationEditor eventId={eventId} eventName={initial.name || "This event"} initial={evaluation} editable={!pending} embedded onChange={setEvaluation} actions={topActions} viewMode={mode} />
        {errors.evaluationSettings && <p className="portal-field-error" role="alert">{errors.evaluationSettings}</p>}
      </div>
      {tab === "details" && <FormFooter formId={formId} pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} danger={danger} />}
    </div>
  );
}
