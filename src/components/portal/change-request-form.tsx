"use client";

import { useTransition } from "react";
import type { FormState } from "@/lib/portal/form";
import { Field, useHydrated, usePortalForm } from "./portal-form";

/**
 * Where a Central account asks a Local unit to change one of its events. With a request already
 * waiting on the unit (`current`), the same box updates it, and it can be taken back.
 */
export function ChangeRequestForm({ action, withdraw, current }: { action: (state: FormState, formData: FormData) => Promise<FormState>; withdraw: () => Promise<void>; current: string | null }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const [withdrawing, startWithdraw] = useTransition();
  const hydrated = useHydrated();

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <Field label={current ? "Your request" : "What should the unit change?"} hint="The unit sees this on the event until it marks it addressed, and its commissioners are emailed. Central accounts can’t edit a unit’s event themselves." error={errors.request}>
        {/* Keyed on the saved request, so the box follows it once it's sent or withdrawn. */}
        <textarea key={current ?? ""} name="request" rows={3} maxLength={1000} defaultValue={current ?? ""} placeholder="e.g. Please move the ingress to 12:30 PM, and name the room in the venue." required />
      </Field>
      {state?.error && !state.fieldErrors && <p className="portal-form-error" role="alert">{state.error}</p>}
      <div className="portal-form-actions">
        {current && <button className="portal-button is-ghost" type="button" disabled={withdrawing || pending} onClick={() => startWithdraw(() => withdraw())}>{withdrawing ? "Withdrawing…" : "Withdraw request"}</button>}
        <button className="portal-button" type="submit" disabled={pending || withdrawing || !hydrated}>{pending ? "Sending…" : current ? "Update request" : "Send request"}</button>
      </div>
    </form>
  );
}
