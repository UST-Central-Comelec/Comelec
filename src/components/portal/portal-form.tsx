"use client";

import Link from "next/link";
import { startTransition, useActionState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Submits through `onSubmit` rather than `<form action>` so React doesn't reset the fields when
 * the server sends back validation errors — commissioners keep what they typed.
 */
export function usePortalForm(action: FormAction) {
  const [state, formAction, pending] = useActionState(action, undefined);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  return { state, pending, onSubmit, errors: state?.fieldErrors ?? {} };
}

const noopSubscribe = () => () => {};

/**
 * False until React has hydrated. Submit buttons stay disabled until then: before hydration the
 * browser would do a plain GET submit, putting the fields (and passwords) in the URL.
 */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** A labelled input. `hint` is guide text, shown behind an "i" icon beside the label; only errors show below. */
export function Field({ label, hint, error, children, wide }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`portal-field${wide ? " is-wide" : ""}${error ? " has-error" : ""}`}>
      <span className="portal-field-label">{label}{hint && <InfoTip>{hint}</InfoTip>}</span>
      {children}
      {error && <span className="portal-field-error">{error}</span>}
    </label>
  );
}

export function FormFooter({ state, pending, submitLabel, cancelHref }: { state: FormState; pending: boolean; submitLabel: string; cancelHref: string }) {
  const hydrated = useHydrated();

  return (
    <div className="portal-form-footer">
      {state?.error ? <p className="portal-form-error" role="alert">{state.error}</p> : <span />}
      <div className="portal-form-actions">
        <Link className="portal-button is-ghost" href={cancelHref}>Cancel</Link>
        <button className="portal-button" type="submit" disabled={pending || !hydrated}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </div>
  );
}
