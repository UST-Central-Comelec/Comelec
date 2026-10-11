"use client";

import Link from "next/link";
import { startTransition, useActionState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { useToast } from "./toast";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Submits through `onSubmit` rather than `<form action>` so React doesn't reset the fields when
 * the server sends back validation errors — commissioners keep what they typed. The action's
 * `error` pops up on the header (toast.tsx), so a form doesn't show it too.
 */
export function usePortalForm(action: FormAction) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // What went wrong pops up on the header; the fields' own errors stay beside them.
  useToast(state?.error, "error", state);

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
export function FormFooter({ pending, submitLabel, cancelHref, danger, beforeActions, formId }: { pending: boolean; submitLabel: string; cancelHref: string; danger?: ReactNode; beforeActions?: ReactNode; formId?: string }) {
  const hydrated = useHydrated();

  return (
    <div className={`portal-form-footer${danger ? " has-danger" : ""}`}>
      {!danger && <span />}
      {danger}
      <FormActions pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} formId={formId} hydrated={hydrated}>{beforeActions}</FormActions>
    </div>
  );
}

/** Cancel and Save on their own, for a form that keeps them somewhere other than its footer. */
export function FormActions({ pending, submitLabel, cancelHref, formId, hydrated, children, small }: { pending: boolean; submitLabel: string; cancelHref: string; formId?: string; hydrated?: boolean; children?: ReactNode; small?: boolean }) {
  const ready = useHydrated();
  const size = small ? " is-small" : "";
  return (
    <div className="portal-form-actions">
      {children}
      <Link className={`portal-button is-ghost${size}`} href={cancelHref}>Cancel</Link>
      <button className={`portal-button${size}`} type="submit" form={formId} disabled={pending || !(hydrated ?? ready)}>{pending ? "Saving…" : submitLabel}</button>
    </div>
  );
}
