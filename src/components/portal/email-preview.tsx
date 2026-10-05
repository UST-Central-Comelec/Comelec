"use client";

import { useEffect, useRef } from "react";

/**
 * An email as its recipients will see it. The email's own HTML is drawn inside a shadow root, so
 * the portal's styles don't reach it and its styles don't reach the portal. `html` is built by
 * src/lib/email/body.ts from text, never typed in. Its links don't lead anywhere from here.
 */
export function EmailPreview({ html, from, to, subject }: { html: string; from: string; to: string; subject: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    (element.shadowRoot ?? element.attachShadow({ mode: "open" })).innerHTML = html;
  }, [html]);

  return (
    <div className="email-preview">
      <dl className="email-preview-head">
        <div><dt>From</dt><dd>{from}</dd></div>
        <div><dt>To</dt><dd>{to}</dd></div>
        <div><dt>Subject</dt><dd>{subject || <span className="portal-muted">No subject yet</span>}</dd></div>
      </dl>
      <div ref={host} className="email-preview-body" onClick={(event) => event.preventDefault()} />
    </div>
  );
}
