"use client";

import { useState } from "react";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { useHydrated, usePortalForm } from "./portal-form";

/** Accounts → Expiration: the date commissioners' access ends. `today` is the earliest it can be, in Manila. */
export function ExpiryForm({ action, expiresOn: saved, today }: { action: (state: FormState, formData: FormData) => Promise<FormState>; expiresOn: string; today: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const hydrated = useHydrated();
  const [date, setDate] = useState(saved);
  const unchanged = date === saved;

  return (
    <form className="portal-settings-form" onSubmit={onSubmit} noValidate>
      <div className={`portal-setting${errors.expiresOn ? " has-error" : ""}`}>
        <div className="portal-setting-label">
          <label htmlFor="expires-on">Expiry date</label>
          <InfoTip>Access ends at the end of this day, Philippine time. Change it any time before then; after the clean-up, a new date applies to accounts restored or added since.</InfoTip>
        </div>
        <div className="portal-setting-control">
          <input id="expires-on" className="portal-input portal-expiry-date" type="date" name="expiresOn" value={date} min={today} onChange={(event) => setDate(event.target.value)} required aria-invalid={Boolean(errors.expiresOn)} />
          {errors.expiresOn && <span className="portal-field-error">{errors.expiresOn}</span>}
        </div>
      </div>
      <footer className={`portal-settings-foot${unchanged ? "" : " is-dirty"}`}>
        {state?.error && !state.fieldErrors ? <p className="portal-form-error" role="alert">{state.error}</p> : <span className="portal-settings-dirty" aria-live="polite">{unchanged ? "" : "Unsaved changes"}</span>}
        <div className="portal-form-actions">
          {!unchanged && <button type="button" className="portal-button is-ghost" onClick={() => setDate(saved)} disabled={pending}>Discard</button>}
          <button className="portal-button" type="submit" disabled={pending || !hydrated || unchanged}>{pending ? "Saving…" : unchanged ? "Saved" : "Save date"}</button>
        </div>
      </footer>
    </form>
  );
}
