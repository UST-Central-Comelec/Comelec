"use client";

import { useId, useState } from "react";
import { CalendarClock, Lock, LockOpen } from "lucide-react";
import { CLOSE_GRACE_MINUTES, describeTimeLeft, fromManilaInput, toManilaInput, type PeriodMode } from "@/lib/applications/period";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { useNow } from "./period-overview";
import { useHydrated, usePortalForm } from "./portal-form";

const options: Array<{ mode: PeriodMode; label: string; icon: typeof Lock }> = [
  { mode: "scheduled", label: "Scheduled", icon: CalendarClock },
  { mode: "open", label: "Always open", icon: LockOpen },
  { mode: "closed", label: "Closed", icon: Lock },
];

const submitLabels: Record<PeriodMode, string> = { scheduled: "Save schedule", open: "Open applications", closed: `Close in ${CLOSE_GRACE_MINUTES} minutes` };

export function ApplicationPeriodForm({
  action,
  mode: savedMode,
  closesAt,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mode: PeriodMode;
  closesAt: string | null;
}) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const hydrated = useHydrated();
  const now = useNow();
  const id = useId();
  const savedInput = closesAt ? toManilaInput(closesAt) : "";
  const [mode, setMode] = useState(savedMode);
  const [closesInput, setClosesInput] = useState(savedInput);

  const closing = fromManilaInput(closesInput);
  const left = closing && now !== null ? Date.parse(closing) - now : null;
  const unchanged = mode === savedMode && (mode !== "scheduled" || closesInput === savedInput);

  return (
    <form className="portal-settings-form" onSubmit={onSubmit} noValidate>
      <div className="portal-setting">
        <div className="portal-setting-label">
          <span id={`${id}-mode`}>Status</span>
          <InfoTip>
            <strong>Scheduled:</strong> open now, with a countdown on the Apply page; closes by itself at the time you set.{" "}
            <strong>Always open:</strong> no closing date or countdown.{" "}
            <strong>Closed:</strong> stops new applications after a {CLOSE_GRACE_MINUTES}-minute grace period, so anyone mid-application can finish; you can cancel until then. Track application keeps working.
          </InfoTip>
        </div>
        <div className="portal-setting-control">
          <div className="portal-segmented" role="radiogroup" aria-labelledby={`${id}-mode`}>
            {options.map(({ mode: option, label, icon: Icon }) => (
              <label key={option} className={`portal-segment is-${option}${mode === option ? " is-selected" : ""}`}>
                <input type="radio" name="mode" value={option} checked={mode === option} onChange={() => setMode(option)} />
                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {mode === "scheduled" ? (
        <div className={`portal-setting${errors.closesAt ? " has-error" : ""}`}>
          <div className="portal-setting-label">
            <label htmlFor={`${id}-closes`}>Closes at</label>
            <InfoTip>Manila time. Applications close at this exact minute; anyone who hasn’t submitted by then can’t.</InfoTip>
          </div>
          <div className="portal-setting-control">
            <div className="portal-setting-inline">
              <input id={`${id}-closes`} className="portal-input" name="closesAt" type="datetime-local" value={closesInput} onChange={(event) => setClosesInput(event.target.value)} required aria-invalid={Boolean(errors.closesAt)} />
              {left !== null && (
                <span className={`portal-chip${left <= 0 ? " is-danger" : ""}`} aria-live="polite">
                  {left > 0 ? <>in <strong>{describeTimeLeft(left)}</strong></> : "Already passed"}
                </span>
              )}
            </div>
            {errors.closesAt && <span className="portal-field-error">{errors.closesAt}</span>}
          </div>
        </div>
      ) : (
        // Kept so switching back to a schedule remembers the date.
        <input type="hidden" name="closesAt" value={closesInput} />
      )}
      <input type="hidden" name="loadedClosesAt" value={closesAt ?? ""} />

      <footer className={`portal-settings-foot${unchanged ? "" : " is-dirty"}`}>
        {state?.error ? (
          <p className="portal-form-error" role="alert">{state.error}</p>
        ) : (
          <span className="portal-settings-dirty" aria-live="polite">{unchanged ? "" : "Unsaved changes"}</span>
        )}
        <div className="portal-form-actions">
          {!unchanged && (
            <button type="button" className="portal-button is-ghost" onClick={() => { setMode(savedMode); setClosesInput(savedInput); }} disabled={pending}>Discard</button>
          )}
          <button className={`portal-button${mode === "closed" && savedMode !== "closed" ? " is-danger" : ""}`} type="submit" disabled={pending || !hydrated || unchanged}>
            {pending ? "Saving…" : unchanged ? "Saved" : submitLabels[mode]}
          </button>
        </div>
      </footer>
    </form>
  );
}
