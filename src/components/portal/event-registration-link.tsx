"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "./toast";

export function EventRegistrationLink({ href, label = "Registration" }: { href: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      toast(`${label} link copied.`);
    } catch {
      toast("Couldn’t copy. Select the link and copy it manually.", "error");
    }
  }

  return (
    <div className="portal-event-registration-link">
      <span>{label}:</span>
      <a href={href} target="_blank" rel="noreferrer">{href}</a>
      <button type="button" className="portal-event-copy-link" onClick={copy} aria-label={copied ? `${label} link copied` : `Copy ${label.toLowerCase()} link`} title={`Copy ${label.toLowerCase()} link`}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
