"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { DocumentBody } from "@/components/document-body";
import { parseDocumentBody } from "@/lib/data/document-body";
import { DocumentEditor } from "./document-editor";

function BodyWindow({ title, children, onClose, editing = false }: { title: string; children: ReactNode; onClose: () => void; editing?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return createPortal(
    <dialog ref={dialog} className="document-body-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <header className="document-body-dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="portal-icon-button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="document-body-dialog-content">{children}</div>
      <footer className="document-body-dialog-foot">
        {editing && <span className="portal-muted">Changes are kept in your draft.</span>}
        <button type="button" className="portal-button" onClick={onClose}>{editing ? "Done" : "Close preview"}</button>
      </footer>
    </dialog>,
    document.body,
  );
}

/** The inline and expanded editors share the form's draft; only one editor is mounted at a time. */
export function DocumentBodyField({ value, onChange, readOnly = false, invalid }: { value: string; onChange: (body: string) => void; readOnly?: boolean; invalid?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const labelId = useId();
  const blocks = parseDocumentBody(value);
  const tables = blocks.filter(block => block.type === "table" || block.type === "grid").length;

  return (
    <>
      <input type="hidden" name="body" value={value} />
      <span id={labelId} className="document-editor-label">Main text editor</span>
      {!expanded && <DocumentEditor initialBody={value} onChange={onChange} labelledBy={labelId} invalid={invalid} readOnly={readOnly} />}
      <div className="portal-body-tools">
        <span>{tables > 0 && <strong className="portal-file-status">{tables === 1 ? "1 table." : `${tables} tables.`}</strong>}</span>
        <button type="button" className="portal-button is-ghost is-small" onClick={() => setExpanded(true)} disabled={readOnly} aria-haspopup="dialog"><Maximize2 size={14} aria-hidden="true" /> Window</button>
      </div>
      {expanded && <BodyWindow title="Edit main text" editing onClose={() => setExpanded(false)}>
        <span id={`${labelId}-window`} className="document-editor-label">Main text editor</span>
        <DocumentEditor initialBody={value} onChange={onChange} labelledBy={`${labelId}-window`} invalid={invalid} />
      </BodyWindow>}
    </>
  );
}

export function DocumentBodyPreview({ value, onClose }: { value: string; onClose: () => void }) {
  const blocks = parseDocumentBody(value);
  return <BodyWindow title="Main text preview" onClose={onClose}>
    <div className="portal-body-preview" aria-label="Main text as it will appear on the website">
      {blocks.length ? <DocumentBody blocks={blocks} /> : <p className="portal-muted">Nothing to preview yet.</p>}
    </div>
  </BodyWindow>;
}
