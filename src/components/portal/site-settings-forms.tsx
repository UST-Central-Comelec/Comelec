"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Radio, RotateCcw, Wrench } from "lucide-react";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { useHydrated, usePortalForm } from "./portal-form";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** A settings card's footer: "Unsaved changes", Discard and the submit button, as on the period settings. */
function SettingsFoot({ error, unchanged, pending, onDiscard, submitLabel, danger }: { error?: string; unchanged: boolean; pending: boolean; onDiscard: () => void; submitLabel: string; danger?: boolean }) {
  const hydrated = useHydrated();
  return (
    <footer className={`portal-settings-foot${unchanged ? "" : " is-dirty"}`}>
      {error ? <p className="portal-form-error" role="alert">{error}</p> : <span className="portal-settings-dirty" aria-live="polite">{unchanged ? "" : "Unsaved changes"}</span>}
      <div className="portal-form-actions">
        {!unchanged && <button type="button" className="portal-button is-ghost" onClick={onDiscard} disabled={pending}>Discard</button>}
        <button className={`portal-button${danger ? " is-danger" : ""}`} type="submit" disabled={pending || !hydrated || unchanged}>{pending ? "Saving…" : unchanged ? "Saved" : submitLabel}</button>
      </div>
    </footer>
  );
}

/** Maintenance → Maintenance mode: take the public website offline or bring it back, and what the page says meanwhile. */
export function MaintenanceForm({ action, maintenance: saved, message: savedMessage, maxLength }: { action: FormAction; maintenance: boolean; message: string; maxLength: number }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const id = useId();
  const [maintenance, setMaintenance] = useState(saved);
  const [message, setMessage] = useState(savedMessage);
  const unchanged = maintenance === saved && message.trim() === savedMessage;
  const goingOffline = maintenance && !saved;

  return (
    <form className="portal-settings-form" onSubmit={onSubmit} noValidate>
      <div className="portal-setting">
        <div className="portal-setting-label">
          <span id={`${id}-status`}>Website</span>
          <InfoTip>
            <strong>Live:</strong> the website works as usual.{" "}
            <strong>Under maintenance:</strong> every public page shows the maintenance page instead, within about 10 seconds. Forms already open can’t be submitted. The portal stays up, so you can switch it back here.
          </InfoTip>
        </div>
        <div className="portal-setting-control">
          <div className="portal-segmented" role="radiogroup" aria-labelledby={`${id}-status`}>
            <label className={`portal-segment${maintenance ? "" : " is-selected"}`}>
              <input type="radio" name="status" value="live" checked={!maintenance} onChange={() => setMaintenance(false)} />
              <Radio size={15} strokeWidth={1.9} aria-hidden="true" />
              Live
            </label>
            <label className={`portal-segment is-closed${maintenance ? " is-selected" : ""}`}>
              <input type="radio" name="status" value="maintenance" checked={maintenance} onChange={() => setMaintenance(true)} />
              <Wrench size={15} strokeWidth={1.9} aria-hidden="true" />
              Under maintenance
            </label>
          </div>
        </div>
      </div>

      <div className={`portal-setting${errors.message ? " has-error" : ""}`}>
        <div className="portal-setting-label">
          <label htmlFor={`${id}-message`}>Message</label>
          <InfoTip>Optional. Shown on the maintenance page in place of the usual wording, for example when the website will be back. Leave it empty to use the usual wording.</InfoTip>
        </div>
        <div className="portal-setting-control">
          <textarea id={`${id}-message`} className="portal-input portal-setting-textarea" name="message" rows={3} maxLength={maxLength} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="The website is offline for a short while as we work on it." aria-invalid={Boolean(errors.message)} />
          <span className="portal-setting-count" aria-hidden="true">{message.length} / {maxLength}</span>
          {errors.message && <span className="portal-field-error">{errors.message}</span>}
        </div>
      </div>

      <SettingsFoot error={state?.error} unchanged={unchanged} pending={pending} onDiscard={() => { setMaintenance(saved); setMessage(savedMessage); }} submitLabel={goingOffline ? "Take website offline" : !maintenance && saved ? "Bring website back" : "Save"} danger={goingOffline} />
    </form>
  );
}

/** Maintenance → Cookie notice: whether the public website shows it. */
export function CookieNoticeForm({ action, shown: saved }: { action: FormAction; shown: boolean }) {
  const { state, pending, onSubmit } = usePortalForm(action);
  const id = useId();
  const [shown, setShown] = useState(saved);

  return (
    <form className="portal-settings-form" onSubmit={onSubmit} noValidate>
      <div className="portal-setting">
        <div className="portal-setting-label">
          <span id={`${id}-shown`}>Notice</span>
          <InfoTip>
            <strong>Shown:</strong> first-time visitors see a small card about cookies, once, until they dismiss it.{" "}
            <strong>Hidden:</strong> nobody sees it. The cookie policy page stays up either way.
          </InfoTip>
        </div>
        <div className="portal-setting-control">
          <div className="portal-segmented" role="radiogroup" aria-labelledby={`${id}-shown`}>
            <label className={`portal-segment${shown ? " is-selected" : ""}`}>
              <input type="radio" name="cookieNotice" value="shown" checked={shown} onChange={() => setShown(true)} />
              <Eye size={15} strokeWidth={1.9} aria-hidden="true" />
              Shown
            </label>
            <label className={`portal-segment${shown ? "" : " is-selected"}`}>
              <input type="radio" name="cookieNotice" value="hidden" checked={!shown} onChange={() => setShown(false)} />
              <EyeOff size={15} strokeWidth={1.9} aria-hidden="true" />
              Hidden
            </label>
          </div>
        </div>
      </div>
      <SettingsFoot error={state?.error} unchanged={shown === saved} pending={pending} onDiscard={() => setShown(saved)} submitLabel="Save" />
    </form>
  );
}

/** Submit button of the "Show again to everyone" form. */
export function ResetNoticeButton() {
  const { pending } = useFormStatus();
  const hydrated = useHydrated();
  return <button className="portal-button is-ghost" type="submit" disabled={pending || !hydrated}><RotateCcw size={15} aria-hidden="true" /> {pending ? "Resetting…" : "Show again to everyone"}</button>;
}
