"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "../toast";
import "../filing-review.css";
import { Busy } from "@/components/busy";

type Result = { ok?: string; error?: string };

/**
 * A button that opens a confirmation dialog, for a step whose consequence needs saying first
 * (people are emailed, a registration ends): what will happen, an optional or required note the
 * filer will read, then Cancel and the action. What happened pops up on the header.
 */
export function ConfirmAction({ label, icon, buttonClassName = "portal-button is-ghost is-small", title, children, note, confirmLabel, pendingLabel, danger = false, action }: {
  label: string;
  icon?: ReactNode;
  buttonClassName?: string;
  title: string;
  /** What will happen, in a sentence or two. */
  children: ReactNode;
  /** A note to go with it, which the filer reads. */
  note?: { label: string; required: boolean; placeholder?: string };
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  action: (note: string) => Promise<Result>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const titleId = useId();
  const noteId = useId();

  const close = () => { if (!pending) dialog.current?.close(); };
  const confirm = () => startTransition(async () => {
    const result = await action(text);
    if (result.error) toast(result.error, "error");
    else {
      toast(result.ok ?? "Done.", "ok");
      setText("");
      dialog.current?.close();
    }
  });

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => dialog.current?.showModal()}>{icon}{label}</button>
      <dialog
        ref={dialog}
        className="portal-registrant-confirmation fr-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => { if (pending) event.preventDefault(); }}
        onClick={(event) => { if (event.target === dialog.current) close(); }}
      >
        <form method="dialog" onSubmit={(event) => { event.preventDefault(); confirm(); }}>
          <h2 id={titleId}>{title}</h2>
          <p>{children}</p>
          {note && (
            <label className="portal-field" htmlFor={noteId}>
              <span className="portal-field-label">{note.label}{!note.required && " (optional)"}</span>
              <textarea id={noteId} name="note" rows={3} maxLength={3000} value={text} onChange={(event) => setText(event.target.value)} required={note.required} placeholder={note.placeholder} />
            </label>
          )}
          <div className="portal-registrant-confirmation-actions">
            <button type="button" className="portal-button is-ghost" autoFocus disabled={pending} onClick={close}>Cancel</button>
            <button type="submit" className={`portal-button${danger ? " is-danger" : ""}`} disabled={pending}>{pending ? <Busy>{pendingLabel}</Busy> : confirmLabel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** A one-step action that can be undone or harms nothing (restore access, end sessions): the button, then a pop-up. */
export function QuickAction({ label, pendingLabel, icon, action, buttonClassName = "portal-button is-ghost is-small" }: { label: string; pendingLabel: string; icon?: ReactNode; action: () => Promise<Result>; buttonClassName?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className={buttonClassName} disabled={pending} onClick={() => startTransition(async () => {
      const result = await action();
      toast(result.error ?? result.ok ?? "Done.", result.error ? "error" : "ok");
    })}>{icon}{pending ? <Busy>{pendingLabel}</Busy> : label}</button>
  );
}
