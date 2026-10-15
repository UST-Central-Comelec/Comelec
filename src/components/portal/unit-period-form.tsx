"use client";

import { SaveIcon as ActionSaveIcon } from "@/components/action-icons";
import { SlidingSegments } from "./sliding-filters";

import { useState } from "react";
import { CalendarCogIcon } from "@/components/lucide-animated/calendar-cog";
import { LockOpenIcon } from "@/components/lucide-animated/lock-open";
import { CLOSE_GRACE_MINUTES, type PeriodMode } from "@/lib/applications/period";
import type { EventDetails } from "@/lib/events/options";
import type { FormState } from "@/lib/portal/form";
import { EventDetailsFields } from "./event-details-fields";
import { InfoTip } from "./info-tip";
import { useHydrated, usePortalForm } from "./portal-form";

const options: Array<{ mode: "scheduled" | "closed"; label: string; icon: typeof LockOpenIcon }> = [
  { mode: "scheduled", label: "Scheduled Open", icon: CalendarCogIcon },
  { mode: "closed", label: "Closed", icon: LockOpenIcon },
];

/**
 * A unit's Recruitment, Political Party Registration or Filing of Candidacy, under its Settings: one
 * form. Its event details are what it's listed under on the Events page while it's open, and their
 * start and end are when it opens and closes. Scheduled runs it on those dates; Closed stops it, after
 * a grace period for anyone partway through. `noun` is what people submit ("applications").
 */
export function UnitPeriodForm({ action, mode: savedMode, initial, noun, allowBothVenue = false, allowMultipleVenues = false, studentsOnly = false }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mode: PeriodMode;
  initial: EventDetails;
  noun: string;
  allowBothVenue?: boolean;
  allowMultipleVenues?: boolean;
  studentsOnly?: boolean;
}) {
  const { pending, onSubmit, errors } = usePortalForm(action);
  const hydrated = useHydrated();
  // A period saved as always open (before it had dates) shows as scheduled: saving gives it its end.
  const [mode, setMode] = useState<"scheduled" | "closed">(savedMode === "closed" ? "closed" : "scheduled");
  const closing = mode === "closed" && savedMode !== "closed";

  return (
    <form className="portal-form portal-period-form" onSubmit={onSubmit} noValidate>
      <fieldset className="portal-form-section">
        <legend>Status</legend>
        <div className="portal-setting-inline">
          <SlidingSegments active={mode} role="radiogroup" aria-label="Status">
            {options.map(({ mode: option, label, icon: Icon }) => (
              <label key={option} className={`portal-segment is-${option}${mode === option ? " is-selected" : ""}`}>
                <input type="radio" name="mode" value={option} checked={mode === option} onChange={() => setMode(option)} />
                <Icon size={15} aria-hidden="true" />
                {label}
              </label>
            ))}
          </SlidingSegments>
          <span className="portal-field-hint">
            <InfoTip>
              <strong>Scheduled Open:</strong> opens at the start date and time, closes at the end date and time; the public page counts down to the close.{" "}
              <strong>Closed:</strong> stops new {noun} after a {CLOSE_GRACE_MINUTES}-minute grace period, so anyone partway through can finish; you can cancel until then.
            </InfoTip>
          </span>
        </div>
      </fieldset>

      <EventDetailsFields studentsOnly={studentsOnly} allowBothVenue={allowBothVenue} allowMultipleVenues={allowMultipleVenues} initial={initial} errors={errors} what="listing" />

      <div className="portal-form-footer">
        <span />
        <div className="portal-form-actions">
          <button className={`portal-button${closing ? " is-danger" : ""}`} type="submit" disabled={pending || !hydrated}><ActionSaveIcon size={15} aria-hidden="true" />
            {pending ? "Saving…" : closing ? `Close in ${CLOSE_GRACE_MINUTES} minutes` : mode === "scheduled" ? "Save and schedule" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
