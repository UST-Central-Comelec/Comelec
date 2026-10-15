"use client";

import { Field } from "./portal-form";
import { InfoTip } from "./info-tip";

export function EventCapacityFields({ minimum = 1, maximum = "", onMinimumChange, onMaximumChange, errors = {} }: { minimum?: number | string; maximum?: number | string | null; onMinimumChange?: (value: string) => void; onMaximumChange?: (value: string) => void; errors?: Record<string, string> }) {
  return <div className="portal-event-capacity-fields">
    <Field label="Minimum registrants" hint="The minimum target for this event. Defaults to 1." error={errors.minimumRegistrants}><input type="number" name="minimumRegistrants" min={1} max={2147483647} step={1} required {...(onMinimumChange ? { value: minimum, onChange: event => onMinimumChange(event.target.value) } : { defaultValue: minimum })} /></Field>
    <Field label="Maximum registrants" hint="Leave blank for unlimited capacity. Once confirmed registrants reach this limit, registration switches to Waitlist." error={errors.maximumRegistrants}><input type="number" name="maximumRegistrants" min={Math.max(1, Number(minimum) || 1)} max={2147483647} step={1} placeholder="Unlimited" {...(onMaximumChange ? { value: maximum ?? "", onChange: event => onMaximumChange(event.target.value) } : { defaultValue: maximum ?? "" })} /></Field>
  </div>;
}

export function EventCapacityTracker({ registered, minimum = 1, maximum = null }: { registered: number; minimum?: number; maximum?: number | null }) {
  const full = maximum !== null && registered >= maximum;
  return <div className="portal-event-capacity-tracker">
    <div className="portal-event-capacity-head"><h3>Capacity tracker<InfoTip>Counts confirmed registrants only. Waitlisted people, RSVP responses and evaluation responses don’t use capacity. The minimum is a target; registration switches to Waitlist at the maximum.</InfoTip></h3><span>{registered.toLocaleString()}{maximum !== null ? ` / ${maximum.toLocaleString()}` : " registered"}</span></div>
    {maximum !== null && <progress value={Math.min(registered, maximum)} max={maximum} aria-label="Registered capacity" />}
    <div className="portal-event-capacity-meta"><span className={`portal-tag${registered >= minimum ? " is-ok" : ""}`}>{registered >= minimum ? "Minimum reached" : `${Math.max(0, minimum - registered).toLocaleString()} to reach minimum`}</span><span>{maximum === null ? "Unlimited capacity" : full ? "Capacity reached" : `${Math.max(0, maximum - registered).toLocaleString()} slots remaining`}</span></div>
  </div>;
}
