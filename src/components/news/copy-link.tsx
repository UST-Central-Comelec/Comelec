"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";

/**
 * Copies the page's address, saying so for a couple of seconds. With `hash`, the address points at
 * that part of the page (one table on the Statistics page, say).
 */
export function CopyLink({ className, hash }: { className?: string; hash?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      const { origin, pathname, search, href } = window.location;
      await navigator.clipboard.writeText(hash ? `${origin}${pathname}${search}#${hash}` : href);
      setCopied(true);
    } catch {
      // Clipboard access refused (or unavailable): the address bar still has it.
    }
  };

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
