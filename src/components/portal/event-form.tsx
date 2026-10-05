"use client";

import type { ReactNode } from "react";
import { registrationStatuses, registrationStatusHints, type EventDetails, type RegistrationStatus } from "@/lib/events/options";
import type { FormState } from "@/lib/portal/form";
import { EventDetailsFields } from "./event-details-fields";
import { InfoTip } from "./info-tip";
import { FormFooter, usePortalForm } from "./portal-form";

type Values = EventDetails & { registrationStatus: RegistrationStatus; requireGoogle: boolean };

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

      <EventDetailsFields initial={initial} errors={errors} requireGoogle={initial.requireGoogle} />

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
