"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ReviewActionIcon } from "./review-action-icon";

type Props = {
  action: () => Promise<void>;
  label?: string;
  prompt?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Shown before the label. */
  icon?: ReactNode;
  animatedIcon?: boolean;
  /** "quiet" is a plain outlined button, for something that can be undone (revoking access); the confirm step shares the destructive hover style. */
  tone?: "danger" | "quiet" | "black";
};

/** Two-step destructive action: the first click arms the button, the second confirms. */
export function DeleteButton({ action, label = "Delete", prompt = "Delete permanently?", confirmLabel = "Yes, delete", pendingLabel = "Deleting…", icon, animatedIcon = true, tone = "danger" }: Props) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return <button className={`portal-destructive-button ${tone === "black" ? "portal-registrant-action-button" : `portal-button ${tone === "quiet" ? "is-ghost" : "is-danger-ghost"}`}`} type="button" onClick={() => setArmed(true)}>{animatedIcon ? <ReviewActionIcon kind="remove" /> : icon}{label}</button>;
  }

  return (
    <span className="portal-confirm">
      <span>{prompt}</span>
      <button className={tone === "black" ? "portal-registrant-action-button" : "portal-button is-ghost"} type="button" disabled={pending} onClick={() => setArmed(false)}>Keep</button>
      <button className={`portal-destructive-button ${tone === "black" ? "portal-registrant-action-button" : "portal-button is-danger"}`} type="button" disabled={pending} onClick={() => startTransition(() => action())}>
        {animatedIcon && <ReviewActionIcon kind="remove" disabled={pending} />}
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
