"use client";

import { divisions, divisionIdsForBody, type DivisionId } from "@/lib/applications/options";
import type { FormState } from "@/lib/portal/form";
import { DatePicker, formatPortalDate } from "./date-picker";
import { Dropdown } from "./dropdown";
import { TimePicker } from "./time-picker";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";
import { UnitSwitcher } from "./unit-switcher";

function describeDays(days: string[]) {
  const consecutive = days.every((day, index) => index === 0 || Date.parse(`${day}T00:00:00Z`) - Date.parse(`${days[index - 1]}T00:00:00Z`) === 86_400_000);
  if (consecutive) return `${formatPortalDate(days[0])} – ${formatPortalDate(days[days.length - 1])}`;
  return days.length <= 4 ? days.map(formatPortalDate).join(", ") : `${days.slice(0, 3).map(formatPortalDate).join(", ")} and ${days.length - 3} more`;
}

/**
 * Adds an interview slot for one division on each of one or more days (`dates`, from the calendar
 * selection). Each slot is one applicant; the server fills in that default.
 */
export function InterviewSlotForm({ action, division, dates = [], layout, unit = "", unitOptions, rangeMode, minDate, onDateRangeChange }: { action: (state: FormState, formData: FormData) => Promise<FormState>; division?: DivisionId; dates?: string[]; layout?: "side"; unit?: string; unitOptions?: readonly string[]; rangeMode?: boolean; minDate?: string; onDateRangeChange: (start: string, end: string) => void }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const isRange = rangeMode || (dates.length > 1 && dates.every((day, index) => index === 0 || Date.parse(`${day}T00:00:00Z`) - Date.parse(`${dates[index - 1]}T00:00:00Z`) === 86_400_000));
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  return (
    <form onSubmit={onSubmit} noValidate>
      <input name="unit" type="hidden" value={unit} />
      <div className={`portal-form-grid ${layout === "side" ? "is-side" : "is-3"}`}>
        {unitOptions && (
          <Field label="Comelec unit" wide>
            <UnitSwitcher units={unitOptions} value={unit} size="field" />
          </Field>
        )}
        <Field label="Division" error={errors.division} wide>
          <Dropdown key={division ?? "all"} name="division" defaultValue={division ?? ""} placeholder="Select division" options={divisionIdsForBody(unit ? "local" : "central").map((id) => ({ value: id, label: divisions[id].label }))} />
        </Field>
        {isRange ? (
          <div className="portal-date-range">
            <Field label="Start Date" hint="Each day gets the same slots.">
              <DatePicker name="startDate" value={startDate} min={minDate} required onChange={(day) => onDateRangeChange(day, day > endDate ? day : endDate)} />
            </Field>
            <Field label="End date" error={errors.date}>
              <DatePicker name="endDate" value={endDate} min={minDate} invalid={Boolean(errors.date)} required onChange={(day) => onDateRangeChange(day < startDate ? day : startDate, day)} />
            </Field>
            {dates.map((day) => <input key={day} type="hidden" name="date" value={day} />)}
          </div>
        ) : dates.length > 1 ? (
          <div className={`portal-field portal-dates${errors.date ? " has-error" : ""}`}>
            <span className="portal-field-label">Dates<InfoTip>Each day gets the same slots.</InfoTip></span>
            <p><strong>{dates.length} days</strong><span>{describeDays(dates)}</span></p>
            {dates.map((day) => <input key={day} type="hidden" name="date" value={day} />)}
            {errors.date && <span className="portal-field-error">{errors.date}</span>}
          </div>
        ) : (
          <Field label="Date" error={errors.date}>
            <DatePicker name="date" value={startDate} min={minDate} onChange={(day) => onDateRangeChange(day, day)} invalid={Boolean(errors.date)} required />
          </Field>
        )}
        <Field label="Start time" error={errors.time}>
          <TimePicker name="time" defaultValue="09:00" invalid={Boolean(errors.time)} label="Start time" />
        </Field>
        <Field label="Length" error={errors.duration}>
          <Dropdown name="duration" defaultValue="30" options={[15, 20, 30, 45, 60, 90].map((minutes) => ({ value: String(minutes), label: `${minutes} minutes` }))} />
        </Field>
        <Field label="Format" error={errors.mode}>
          <Dropdown name="mode" defaultValue="onsite" options={[{ value: "onsite", label: "On-site" }, { value: "online", label: "Online" }]} />
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
