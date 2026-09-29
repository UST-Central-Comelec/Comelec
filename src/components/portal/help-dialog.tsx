"use client";

import { useRef, type ReactNode } from "react";
import { CircleQuestionMark, X } from "lucide-react";

/**
 * A "?" button with a label that opens a help modal. For pages whose guide text is too long for an
 * "i" tooltip. Built on <dialog>, so Escape, focus trapping and the backdrop come from the browser.
 */
export function HelpDialog({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="portal-help-button" onClick={() => dialog.current?.showModal()}>
        <CircleQuestionMark size={16} strokeWidth={1.8} aria-hidden="true" />
        {label}
      </button>
      <dialog
        ref={dialog}
        className="portal-help-dialog"
        aria-labelledby="portal-help-title"
        // A click on the backdrop lands on the <dialog> itself; clicks inside land on its content.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="portal-help-card">
          <header className="portal-help-head">
            <h2 id="portal-help-title">{title}</h2>
            <button type="button" className="portal-icon-button is-light" onClick={() => dialog.current?.close()} aria-label="Close help"><X size={16} /></button>
          </header>
          <div className="portal-help-body">{children}</div>
          <footer className="portal-help-foot">
            <button type="button" className="portal-button" onClick={() => dialog.current?.close()}>Got it</button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
