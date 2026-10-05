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

/** For `onInput` on a name field: capitals as it's typed, keeping the cursor where it was. Names are kept in capitals. */
export function uppercaseInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const { selectionStart, selectionEnd } = input;
  input.value = input.value.toUpperCase();
  input.setSelectionRange(selectionStart, selectionEnd);
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

/** `danger` is the destructive action (a delete button), kept at the far left, away from Cancel and Save. */
export function FormFooter({ state, pending, submitLabel, cancelHref, danger, beforeActions }: { state: FormState; pending: boolean; submitLabel: string; cancelHref: string; danger?: ReactNode; beforeActions?: ReactNode }) {
  const hydrated = useHydrated();

  return (
    <div className={`portal-form-footer${danger ? " has-danger" : ""}`}>
      {state?.error ? <p className="portal-form-error" role="alert">{state.error}</p> : !danger && <span />}
      {danger}
      <div className="portal-form-actions">
        {beforeActions}
        <Link className="portal-button is-ghost" href={cancelHref}>Cancel</Link>
        <button className="portal-button" type="submit" disabled={pending || !hydrated}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </div>
  );
}
