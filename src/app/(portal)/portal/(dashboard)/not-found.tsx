import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Shown inside the portal's shell when a page calls notFound(): a post, document, member, account or
// application that was deleted, or that a Local account isn't allowed to open.

export default function PortalNotFound() {
  return (
    <main className="portal-page portal-lost">
      <span className="portal-lost-code" aria-hidden="true">404</span>
      <p className="portal-eyebrow">Not found</p>
      <h1>Signal <em>lost.</em></h1>
      <p className="portal-muted">That page isn’t in the portal. It may have been deleted, or the address may be mistyped.</p>
      <Link className="portal-button is-ghost" href="/portal"><ArrowLeft size={15} aria-hidden="true" /> Back to the portal</Link>
    </main>
  );
}
