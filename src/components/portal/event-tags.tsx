import { comelecUnit, hasEnded, registrationStatuses, type CommissionEvent, type RegistrationStatus } from "@/lib/events/options";

// The two tags an event wears across the portal's Events tab: its registration status, and the
// unit that organizes it.

/** portal-tag colour per status. Closed is the plain grey tag. */
const statusTone: Record<RegistrationStatus, string> = { closed: "", open: "is-ok", waitlist: "is-gold", cancelled: "is-warn", rescheduled: "is-gold" };

/** The registration status as set on the event. Once the event is over it reads "Ended" instead, unless it was cancelled. */
export function EventStatusTag({ event, large }: { event: Pick<CommissionEvent, "registrationStatus" | "eventDate" | "endsTime">; large?: boolean }) {
  const size = large ? " portal-status-tag" : "";
  if (event.registrationStatus !== "cancelled" && hasEnded(event)) return <span className={`portal-tag${size}`}>Ended</span>;
  return <span className={`portal-tag ${statusTone[event.registrationStatus]}${size}`}>{registrationStatuses[event.registrationStatus]}</span>;
}

/** "Central Comelec" in gold, or a college's unit in blue: the same colours as the website's organizer banner. */
export function OrganizerTag({ event }: { event: Pick<CommissionEvent, "organizer" | "college"> }) {
  return <span className={`portal-tag ${event.organizer === "local" ? "is-local" : "is-gold"}`}>{comelecUnit(event.organizer, event.college)}</span>;
}
