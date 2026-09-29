"use client";

import { useState } from "react";
import { DocumentBody } from "@/components/document-body";
import { parseDocumentBody } from "@/lib/data/document-body";

/** Main text box with a live preview that uses the same rendering as the public document page. */
export function DocumentBodyField({ defaultValue }: { defaultValue: string }) {
  const [text, setText] = useState(defaultValue);
  const [showPreview, setShowPreview] = useState(false);
  const blocks = parseDocumentBody(text);
  const tables = blocks.filter((block) => block.type === "table").length;

  return (
    <>
      <textarea name="body" rows={14} defaultValue={defaultValue} onChange={(event) => setText(event.target.value)} />
      <span className="portal-body-tools">
        {/* How to write it is in the "i" beside the Main text label (document-form.tsx). */}
        <span>{tables > 0 && <strong className="portal-file-status">{tables === 1 ? "1 table detected." : `${tables} tables detected.`}</strong>}</span>
        <button type="button" className="portal-button is-ghost is-small" onClick={() => setShowPreview((shown) => !shown)} aria-expanded={showPreview}>
          {showPreview ? "Hide preview" : "Preview"}
        </button>
      </span>
      {showPreview && (
        <div className="portal-body-preview" aria-label="Preview of the main text as it will appear on the website">
          {blocks.length ? <DocumentBody blocks={blocks} /> : <p className="portal-muted">Nothing to preview yet.</p>}
        </div>
      )}
    </>
  );
}
