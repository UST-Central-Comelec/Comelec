"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { CopyIcon as Copy } from "@/components/action-icons";
import { toast } from "./toast";

export function EventRegistrationLink({ href, label = "Registration", boxed = false }: { href: string; label?: string; boxed?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => {
        setCopied(false);
        copiedTimer.current = null;
      }, 2000);
      toast(`${label} link copied.`);
    } catch {
      toast("Couldn’t copy. Select the link and copy it manually.", "error");
    }
  }

  if (boxed) return (
    <div className="portal-event-form-link">
      <span className="portal-event-form-link-icon"><Link2 size={18} aria-hidden="true" /></span>
      <div className="portal-event-form-link-content">
        <span>{label} link</span>
        <a href={href} target="_blank" rel="noreferrer">{href}</a>
      </div>
      <button type="button" className="portal-button is-ghost is-small" onClick={copy} aria-label={copied ? `${label} link copied` : `Copy ${label.toLowerCase()} link`}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}<span aria-live="polite">{copied ? "Copied." : "Copy link"}</span>
      </button>
    </div>
  );

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
