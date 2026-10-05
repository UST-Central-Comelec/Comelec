"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function EventRegistrationLink({ href, label = "Registration" }: { href: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="portal-event-registration-link">
      <span>{label}:</span>
      <a href={href} target="_blank" rel="noreferrer">{href}</a>
      <button type="button" className="portal-event-copy-link" onClick={copy} aria-label={status === "copied" ? `${label} link copied` : `Copy ${label.toLowerCase()} link`} title={`Copy ${label.toLowerCase()} link`}>
        {status === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
      <span role="status">{status === "copied" ? "Copied" : status === "failed" ? "Couldn’t copy. Select the link and copy it manually." : ""}</span>
    </div>
  );
}
