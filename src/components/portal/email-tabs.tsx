import Link from "next/link";
import { Inbox, PenLine, Zap } from "lucide-react";

/**
 * The Email Sender's own subtabs: writing an email, the Outbox of what's scheduled and what was
 * sent, and the emails the site sends by itself. `compose` is false for Advisers and Admins, who
 * read and don't write.
 */
export function EmailTabs({ current, waiting = 0, compose = true }: { current: "compose" | "outbox" | "automatic"; waiting?: number; compose?: boolean }) {
  return (
    <nav className="portal-subtabs" aria-label="Email Sender">
      {compose && <Link href="/portal/apps/email" aria-current={current === "compose" ? "page" : undefined}><PenLine size={15} strokeWidth={1.8} aria-hidden="true" /> Compose</Link>}
      <Link href="/portal/apps/email/outbox" aria-current={current === "outbox" ? "page" : undefined}>
        <Inbox size={15} strokeWidth={1.8} aria-hidden="true" /> Outbox{waiting > 0 && <span className="portal-tag is-gold">{waiting} scheduled</span>}
      </Link>
      <Link href="/portal/apps/email/automatic" aria-current={current === "automatic" ? "page" : undefined}><Zap size={15} strokeWidth={1.8} aria-hidden="true" /> Automatic</Link>
    </nav>
  );
}
