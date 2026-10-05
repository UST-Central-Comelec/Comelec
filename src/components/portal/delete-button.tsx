"use client";

import { useState, useTransition, type ReactNode } from "react";

type Props = {
  action: () => Promise<void>;
  label?: string;
  prompt?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Shown before the label. */
  icon?: ReactNode;
  /** "quiet" is a plain outlined button, for something that can be undone (revoking access); the confirm step is still red. */
  tone?: "danger" | "quiet" | "black";
};

/** Two-step destructive action: the first click arms the button, the second confirms. */
export function DeleteButton({ action, label = "Delete", prompt = "Delete permanently?", confirmLabel = "Yes, delete", pendingLabel = "Deleting…", icon, tone = "danger" }: Props) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return <button className={tone === "black" ? "portal-registrant-action-button" : `portal-button ${tone === "quiet" ? "is-ghost" : "is-danger-ghost"}`} type="button" onClick={() => setArmed(true)}>{icon}{label}</button>;
  }

  return (
    <span className="portal-confirm">
      <span>{prompt}</span>
      <button className={tone === "black" ? "portal-registrant-action-button" : "portal-button is-ghost"} type="button" disabled={pending} onClick={() => setArmed(false)}>Keep</button>
      <button className={tone === "black" ? "portal-registrant-action-button" : "portal-button is-danger"} type="button" disabled={pending} onClick={() => startTransition(() => action())}>
        {pending ? pendingLabel : confirmLabel}
      </button>
    </span>
  );
}

/** A one-step action as a plain button, for where a `<form>` of its own can't go (inside another form). */
export function ActionButton({ action, label, pendingLabel, icon }: { action: () => Promise<void>; label: string; pendingLabel: string; icon?: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return <button className="portal-button is-ghost" type="button" disabled={pending} onClick={() => startTransition(() => action())}>{icon}{pending ? pendingLabel : label}</button>;
}
