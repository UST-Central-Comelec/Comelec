"use client";

import { useEffect } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";
import type { ErrorProps } from "@/components/fallback/error-screen";

// Shown inside the portal's shell when a page fails to render, so the sidebar stays usable. The
// same look as not-found.tsx beside it.

export default function DashboardError({ error, retry }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="portal-page portal-lost">
      <span className="portal-lost-code" aria-hidden="true">500</span>
      <p className="portal-eyebrow">Something went wrong</p>
      <h1>Signal <em>interrupted.</em></h1>
      <p className="portal-muted">A problem on our end stopped this page from loading. Nothing you entered elsewhere was affected. Try again in a moment.{error.digest && <> If it keeps happening, report it with the reference <code>{error.digest}</code>.</>}</p>
      <div className="portal-lost-actions">
        <button className="portal-button" type="button" onClick={retry}><RotateCw size={15} aria-hidden="true" /> Try again</button>
        {/* A full page load, in case the shell's own data is what went stale. */}
        <a className="portal-button is-ghost" href="/portal"><ArrowLeft size={15} aria-hidden="true" /> Back to the portal</a>
      </div>
    </main>
  );
}
