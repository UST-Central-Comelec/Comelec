"use client";

import Link from "next/link";
import { Eye, X } from "lucide-react";

/**
 * Stands in for the site header in view mode. Exiting closes the tab the portal opened it in, or,
 * when the browser won't allow that, goes back to the portal.
 */
export function ViewModeStrip() {
  return (
    <Link className="view-mode-strip" href="/portal/recruitment" onClick={() => window.close()}>
      <Eye size={16} aria-hidden="true" />
      <span><strong>You’re in view mode.</strong> Nothing you enter is saved.</span>
      <span className="view-mode-exit">Click to exit <X size={15} aria-hidden="true" /></span>
    </Link>
  );
}
