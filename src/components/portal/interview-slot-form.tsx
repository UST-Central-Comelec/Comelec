"use client";

import { divisions, type DivisionId } from "@/lib/applications/options";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";

/** "Oct 5", or "Oct 5 – 9" / "Oct 30 – Nov 2" for a run of days. */
const shortDay = (day: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

function describeDays(days: string[]) {
  const consecutive = days.every((day, index) => index === 0 || Date.parse(`${day}T00:00:00Z`) - Date.parse(`${days[index - 1]}T00:00:00Z`) === 86_400_000);
  if (consecutive) return `${shortDay(days[0])} – ${shortDay(days[days.length - 1])}`;
  return days.length <= 4 ? days.map(shortDay).join(", ") : `${days.slice(0, 3).map(shortDay).join(", ")} and ${days.length - 3} more`;
}

/**
 * Adds an interview slot for one division on each of one or more days (`dates`, from the calendar
 * selection). Each slot is one applicant; the server fills in that default.
 */
export function InterviewSlotForm({ action, division, dates = [], layout }: { action: (state: FormState, formData: FormData) => Promise<FormState>; division?: DivisionId; dates?: string[]; layout?: "side" }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className={`portal-form-grid ${layout === "side" ? "is-side" : "is-3"}`}>
        <Field label="Division" error={errors.division} wide>
          <select name="division" defaultValue={division ?? ""} required>
            <option value="" disabled>Select division</option>
            {(Object.keys(divisions) as DivisionId[]).map((id) => <option key={id} value={id}>{divisions[id].label}</option>)}
          </select>
        </Field>
        {dates.length > 1 ? (
          <div className={`portal-field portal-dates${errors.date ? " has-error" : ""}`}>
            <span className="portal-field-label">Dates<InfoTip>Each day gets the same slots.</InfoTip></span>
            <p><strong>{dates.length} days</strong><span>{describeDays(dates)}</span></p>
            {dates.map((day) => <input key={day} type="hidden" name="date" value={day} />)}
            {errors.date && <span className="portal-field-error">{errors.date}</span>}
          </div>
        ) : (
          <Field label="Date" error={errors.date}>
            {/* Remounted when a calendar day is picked, so the new date shows. */}
            <input key={dates[0]} name="date" type="date" defaultValue={dates[0]} required />
          </Field>
        )}
        <Field label="Start time" error={errors.time}>
          <input name="time" type="time" step={300} defaultValue="09:00" required />
        </Field>
        <Field label="Length" error={errors.duration}>
          <select name="duration" defaultValue="30">
            {[15, 20, 30, 45, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
          </select>
        </Field>
        <Field label="Format" error={errors.mode}>
          <select name="mode" defaultValue="onsite">
            <option value="onsite">On-site</option>
            <option value="online">Online</option>
          </select>
        </Field>
      </div>
      {layout === "side" ? (
        <div className="portal-side-footer">
          {state?.error && <p className="portal-form-error" role="alert">{state.error}</p>}
          <button className="portal-button is-block" type="submit" disabled={pending}>{pending ? "Adding…" : dates.length > 1 ? `Add a slot to ${dates.length} days` : "Add slot"}</button>
        </div>
      ) : (
        <FormFooter state={state} pending={pending} submitLabel="Add slots" cancelHref="/portal" />
      )}
    </form>
  );
}
