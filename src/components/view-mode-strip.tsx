"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteThemeToggle } from "@/components/site-theme";

/**
 * Stands in for the site header in view mode. Exiting closes the tab the portal opened it in, or,
 * when the browser won't allow that, goes back to the portal.
 */
export function ViewModeStrip() {
  const pathname = usePathname();
  return (
    <div className="view-mode-strip">
      <Link className="view-mode-exit" href={pathname.startsWith("/forms/") ? "/portal" : "/portal/recruitment"} title="Click to exit" onClick={() => window.close()}>
        <ArrowLeft size={15} aria-hidden="true" />Exit
      </Link>
      <div className="view-mode-strip-inner">
        <p><strong>You’re in view mode.</strong> Nothing you enter is saved.</p>
      </div>
      <SiteThemeToggle className="view-mode-theme" />
    </div>
  );
}
