import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { comelecUnit, isOver, registrationStatuses, type CommissionEvent, type Listing, type RegistrationStatus } from "@/lib/events/options";
import { unitAbbreviations } from "@/lib/applications/options";

// The tags an event wears across the portal's Events tab: its registration status, and the unit
// that organizes it; and the contextual line naming the unit an account is acting for.

/** "Oct 29, 11:59 PM", Manila time: when a unit's period closes, short enough for a table cell. */
const closing = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Status variants retain their meaning in text. */
const statusTone: Record<RegistrationStatus, string> = { closed: "", open: "is-ok", waitlist: "is-gold", cancelled: "is-warn", rescheduled: "is-gold" };

/**
 * The registration status as set on the event. Once the event is over it reads "Ended" instead,
 * unless it was cancelled. A unit's Recruitment, Political Party Registration or Filing of Candidacy
 * is only listed while it's open, and says until when.
 */
export function EventStatusTag({ event, large, compact }: { event: Pick<Listing, "registrationStatus" | "endDate" | "endsTime" | "period">; large?: boolean; /** The tag alone, without when it opens or closes. */ compact?: boolean }) {
  const size = large ? " portal-status-tag" : "";
  // Scheduled, not open yet: in the portal's list already, on the website once it opens.
  if (event.period?.opensAt) {
    return (
      <>
        <span className={`portal-tag is-gold${size}`}>Scheduled</span>
        {!compact && <small className="portal-muted">Opens {closing.format(event.period.opensAt)}</small>}
      </>
    );
  }
  if (event.period) {
    return (
      <>
        <span className={`portal-tag is-ok${size}`}>Open</span>
        {!compact && <small className="portal-muted">{event.period.closesAt === null ? "No closing date" : `Closes ${closing.format(event.period.closesAt)}`}</small>}
      </>
    );
  }
  if (event.registrationStatus !== "cancelled" && isOver(event)) return <span className={`portal-tag${size}`}>Ended</span>;
  return <span className={`portal-tag ${statusTone[event.registrationStatus]}${size}`}>{registrationStatuses[event.registrationStatus]}</span>;
}

/** "Central Comelec" in gold, or a college's unit in blue: the same colours as the website's organizer banner. */
export function OrganizerTag({ event, short }: { event: Pick<CommissionEvent, "organizer" | "college">; /** "Central" or the unit's abbreviation ("CICS"), with its full name on hover. */ short?: boolean }) {
  const name = comelecUnit(event.organizer, event.college);
  const label = short ? (event.organizer === "central" ? "Central" : (unitAbbreviations[event.college ?? ""] ?? name)) : name;
  return <span className={`portal-tag ${event.organizer === "local" ? "is-local" : "is-gold"}`} title={short ? name : undefined}>{label}</span>;
}


/**
 * The pill over a form that says which unit the account is acting for: "You’re adding this event as
 * Faculty of Pharmacy Comelec Unit". Gold for the Central Comelec, blue for a college's unit, like
 * the organizer tag.
 */
export function ActingAs({ unit, children, after }: { unit: Pick<CommissionEvent, "organizer" | "college">; /** What comes before the unit's name. */ children: ReactNode; after?: ReactNode }) {
  return (
    <p className={`portal-acting is-${unit.organizer}`}>
      <Building2 size={14} strokeWidth={1.6} aria-hidden="true" />
      <span>{children} <strong>{comelecUnit(unit.organizer, unit.college)}</strong>{after}</span>
    </p>
  );
}
