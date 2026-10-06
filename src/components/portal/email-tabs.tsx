import { SlidingSubtabs } from "./sliding-subtabs";
import { Inbox, PenLine, Zap } from "lucide-react";

/**
 * The Email Sender's own subtabs: writing an email, the Outbox of what's scheduled and what was
 * sent, and the emails the site sends by itself. `compose` is false for Advisers and Admins, who
 * read and don't write.
 */
export function EmailTabs({ current, waiting = 0, compose = true }: { current: "compose" | "outbox" | "automatic"; waiting?: number; compose?: boolean }) {
  return (
    <SlidingSubtabs active={current} label="Email Sender" scope="email-sender" items={[
      ...(compose ? [{ key: "compose", href: "/portal/apps/email", label: <><PenLine size={15} strokeWidth={1.8} aria-hidden="true" /> Compose</> }] : []),
      { key: "outbox", href: "/portal/apps/email/outbox", label: <><Inbox size={15} strokeWidth={1.8} aria-hidden="true" /> Outbox{waiting > 0 && <span className="portal-tag is-gold">{waiting} scheduled</span>}</> },
      { key: "automatic", href: "/portal/apps/email/automatic", label: <><Zap size={15} strokeWidth={1.8} aria-hidden="true" /> Automatic</> },
    ]} />
  );
}
