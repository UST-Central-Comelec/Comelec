"use client";

import { useState, type ReactNode } from "react";
import { audiences, registrationStatuses, registrationStatusHints, venueModes, type Audience, type CommissionEvent, type RegistrationStatus, type VenueMode } from "@/lib/events/options";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type Values = Pick<CommissionEvent, "name" | "summary" | "background" | "eventDate" | "ingressTime" | "startsTime" | "endsTime" | "egressTime" | "venueMode" | "venueDetails" | "openToStudents" | "openToExternals" | "openToAdmins" | "registrationStatus">;

/** Each participants checkbox: its form field, and who it means. */
const audienceFields: Record<Audience, { field: "openToStudents" | "openToExternals" | "openToAdmins"; hint: string }> = {
  students: { field: "openToStudents", hint: "Students of the University." },
  externals: { field: "openToExternals", hint: "Guests from outside the University." },
  admins: { field: "openToAdmins", hint: "University administrators, faculty and staff." },
};

const venuePlaceholders: Record<VenueMode, string> = {
  onsite: "Room and building, e.g. Auditorium, Tan Yan Kee Student Center",
  online: "Platform and how to get the link, e.g. Zoom, link emailed to registrants",
};

/**
 * The event form, for adding an event and editing one. The organizer isn't on it: it's the unit of
 * the account that adds the event. With `changeRequest` (an edit by a unit the Central Comelec asked
 * for changes), the request is shown at the top with a box to mark it addressed on save.
 */
export function EventForm({ action, initial, submitLabel, cancelHref, danger, changeRequest }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: Values;
  submitLabel: string;
  cancelHref: string;
  danger?: ReactNode;
  changeRequest?: string | null;
}) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const [venueMode, setVenueMode] = useState<VenueMode>(initial.venueMode);

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
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

      <fieldset className="portal-form-section">
        <legend>The event</legend>
        <div className="portal-form-grid">
          <Field label="Event name" error={errors.name} wide>
            <input name="name" defaultValue={initial.name} maxLength={140} required />
          </Field>
          <Field label="Short description" hint="Shown when the event is opened in the website’s list, and under its name on its own page. One or two sentences." error={errors.summary} wide>
            <textarea name="summary" rows={3} defaultValue={initial.summary} maxLength={300} required />
          </Field>
          <Field label="Event background" hint="What the event is about and what to expect, shown on its own page behind Read more. Separate paragraphs with a blank line. Optional." error={errors.background} wide>
            <textarea name="background" rows={9} defaultValue={initial.background} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="portal-form-section">
        <legend>Date and time</legend>
        <div className="portal-form-grid is-schedule">
          <Field label="Date" error={errors.eventDate}>
            <input name="eventDate" type="date" defaultValue={initial.eventDate} required />
          </Field>
          <Field label="Ingress" hint="When participants can start coming in. Optional." error={errors.ingressTime}>
            <input name="ingressTime" type="time" defaultValue={initial.ingressTime ?? ""} />
          </Field>
          <Field label="Activity starts" hint="The activity time: when the program itself begins and ends. Times are Manila time." error={errors.startsTime}>
            <input name="startsTime" type="time" defaultValue={initial.startsTime} required />
          </Field>
          <Field label="Activity ends" error={errors.endsTime}>
            <input name="endsTime" type="time" defaultValue={initial.endsTime} required />
          </Field>
          <Field label="Egress" hint="When participants should have left the venue. Optional." error={errors.egressTime}>
            <input name="egressTime" type="time" defaultValue={initial.egressTime ?? ""} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="portal-form-section">
        <legend>Venue</legend>
        <div className="portal-form-grid is-venue">
          <div className={`portal-field${errors.venueMode ? " has-error" : ""}`}>
            <span className="portal-field-label" id="event-venue-mode">Held</span>
            <div className="portal-segmented" role="radiogroup" aria-labelledby="event-venue-mode">
              {(Object.keys(venueModes) as VenueMode[]).map((mode) => (
                <label key={mode} className={`portal-segment${venueMode === mode ? " is-selected" : ""}`}>
                  <input type="radio" name="venueMode" value={mode} checked={venueMode === mode} onChange={() => setVenueMode(mode)} />
                  {venueModes[mode]}
                </label>
              ))}
            </div>
            {errors.venueMode && <span className="portal-field-error">{errors.venueMode}</span>}
          </div>
          <Field label={venueMode === "online" ? "Platform and link" : "Where"} error={errors.venueDetails}>
            <input name="venueDetails" defaultValue={initial.venueDetails} maxLength={300} placeholder={venuePlaceholders[venueMode]} required />
          </Field>
        </div>
      </fieldset>

      <fieldset className={`portal-form-section portal-field${errors.participants ? " has-error" : ""}`}>
        <legend>Participants</legend>
        <div className="portal-options">
          {(Object.keys(audiences) as Audience[]).map((audience) => (
            <label className="portal-check" key={audience}>
              <input name={audienceFields[audience].field} type="checkbox" defaultChecked={initial[audienceFields[audience].field]} />
              <span><strong>{audiences[audience]}</strong><small>{audienceFields[audience].hint}</small></span>
            </label>
          ))}
        </div>
        {errors.participants
          ? <span className="portal-field-error">{errors.participants}</span>
          : <span className="portal-field-hint">Tick everyone the event is open to. With only Students ticked, the website says “Students only”.</span>}
      </fieldset>

      <fieldset className={`portal-form-section portal-field${errors.registrationStatus ? " has-error" : ""}`}>
        <legend>Registration status</legend>
        <div className="portal-options">
          {(Object.keys(registrationStatuses) as RegistrationStatus[]).map((status) => (
            <label className="portal-check" key={status}>
              <input name="registrationStatus" type="radio" value={status} defaultChecked={initial.registrationStatus === status} />
              <span><strong>{registrationStatuses[status]}</strong><small>{registrationStatusHints[status]}</small></span>
            </label>
          ))}
        </div>
        {errors.registrationStatus && <span className="portal-field-error">{errors.registrationStatus}</span>}
      </fieldset>

      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} danger={danger} />
    </form>
  );
}
