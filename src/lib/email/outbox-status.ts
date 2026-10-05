import { formatClosing } from "@/lib/applications/period";
import { isStalled, type OutboxEmail } from "./outbox";

// How an email in the Outbox stands, in words, for its list and its own page.

export type OutboxState = { label: string; tone: "is-gold" | "is-ok" | "is-warn" | ""; when: string };

export function describeOutbox(email: OutboxEmail): OutboxState {
  if (isStalled(email)) return { label: "Interrupted", tone: "is-warn", when: `Stopped after ${email.sentCount} of ${email.recipientCount}` };
  switch (email.status) {
    case "scheduled":
      // "Send now" is a schedule for this moment: it starts within seconds.
      return email.scheduled ? { label: "Scheduled", tone: "is-gold", when: `Goes out ${formatClosing(email.sendAt)}` } : { label: "Starting", tone: "is-gold", when: "About to send" };
    case "sending":
      return { label: "Sending", tone: "is-gold", when: email.recipientCount ? `${email.sentCount} of ${email.recipientCount} sent so far` : "Working out the recipients" };
    case "sent":
      return { label: "Sent", tone: "is-ok", when: formatClosing(email.finishedAt ?? email.sendAt) };
    case "failed":
      return { label: "Failed", tone: "is-warn", when: formatClosing(email.finishedAt ?? email.sendAt) };
    case "cancelled":
      return { label: "Cancelled", tone: "", when: `Was set for ${formatClosing(email.sendAt)}` };
  }
}

/** Whether it's on its way, or about to be: the page keeps itself up to date while it is. */
export const isMoving = (email: OutboxEmail, now = Date.now()) => !isStalled(email, now) && (email.status === "sending" || (email.status === "scheduled" && Date.parse(email.sendAt) - now < 90_000));
