"use client";

import { useState, useTransition } from "react";

type Props = {
  action: () => Promise<void>;
  label?: string;
  prompt?: string;
  confirmLabel?: string;
  pendingLabel?: string;
};

/** Two-step destructive action: the first click arms the button, the second confirms. */
export function DeleteButton({ action, label = "Delete", prompt = "Delete permanently?", confirmLabel = "Yes, delete", pendingLabel = "Deleting…" }: Props) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return <button className="portal-button is-danger-ghost" type="button" onClick={() => setArmed(true)}>{label}</button>;
  }

  return (
    <span className="portal-confirm">
      <span>{prompt}</span>
      <button className="portal-button is-ghost" type="button" disabled={pending} onClick={() => setArmed(false)}>Keep</button>
      <button className="portal-button is-danger" type="button" disabled={pending} onClick={() => startTransition(() => action())}>
        {pending ? pendingLabel : confirmLabel}
      </button>
    </span>
  );
}
