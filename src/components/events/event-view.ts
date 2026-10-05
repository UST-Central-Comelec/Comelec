import { formatClosing } from "@/lib/applications/period";
import type { Affiliation } from "@/lib/data/types";
import { formatEventDates, formatEventTimes, formatTime } from "@/lib/events/format";
import { comelecUnit, describeAudience, isOver, signUpMode, venueModes, type Listing, type RegistrationStatus, type SignUpMode } from "@/lib/events/options";
import { applyHref, periodKinds, type PeriodKind } from "@/lib/periods/kinds";

// An event as the website shows it: its day and times already in words, and what a visitor can do
// about it, worked out on the server so every visitor's browser draws the same thing.

export type EventView = {
  id: string;
  name: string;
  summary: string;
  /** YYYY-MM-DD, for the calendar and the date block: the day it starts. */
  date: string;
  /** The day it ends: the calendar marks every day between. */
  endDate: string;
  /** "Tuesday, October 20, 2026", or "October 20 – 22, 2026". */
  dateLabel: string;
  /** "12:30 PM", when the event has one. */
  ingress: string | null;
  /** "1:00 – 4:00 PM", or "Oct 20, 1:00 PM – Oct 22, 5:00 PM". */
  time: string;
  egress: string | null;
  venueMode: keyof typeof venueModes;
  venue: string;
  /** "Students only". */
  audience: string;
  organizer: Affiliation;
  /** The local organizer’s faculty, college or school; null for Central Comelec. */
  college: string | null;
  /** "Central Comelec", or "Faculty of Pharmacy Comelec Unit". */
  unit: string;
  status: RegistrationStatus;
  /** The activity's end time has passed. */
  ended: boolean;
  /** Whether a visitor can register or join the waitlist right now. */
  signUp: SignUpMode | null;
  /**
   * Set for a unit's Recruitment, Political Party Registration or Filing of Candidacy, listed while
   * it's open: its button leads to its own page instead of the event form, its tag says what's
   * open, and it says until when.
   */
  period: { kind: PeriodKind; href: string; action: string; openLabel: string; fine: string; /** "October 29, 2026, 11:59 PM"; null with no closing date. */ closes: string | null } | null;
};

/** `now` decides whether the event is over and whether it's taking sign-ups: the moment the page is rendered, unless given. */
export function toEventView(event: Listing, now = Date.now()): EventView {
  const kind = event.period ? periodKinds[event.period.kind] : null;
  return {
    id: event.id,
    name: event.name,
    summary: event.summary,
    date: event.eventDate,
    endDate: event.endDate,
    dateLabel: formatEventDates(event),
    ingress: event.ingressTime ? formatTime(event.ingressTime) : null,
    time: formatEventTimes(event),
    egress: event.egressTime ? formatTime(event.egressTime) : null,
    venueMode: event.venueMode,
    venue: event.venueDetails,
    audience: describeAudience(event),
    organizer: event.organizer,
    college: event.college,
    unit: comelecUnit(event.organizer, event.college),
    status: event.registrationStatus,
    ended: isOver(event, now),
    // A unit's period is only listed while it's open.
    signUp: event.period ? "register" : signUpMode(event, now),
    period: event.period && kind ? { kind: event.period.kind, href: applyHref(event.period.kind, event), action: kind.action, openLabel: kind.openLabel, fine: kind.fine, closes: event.period.closesAt === null ? null : formatClosing(new Date(event.period.closesAt).toISOString()) } : null,
  };
}

/** How an event's sign-ups read on the website. `tone` picks the tag's colour. */
export function statusOf({ status, ended, period }: Pick<EventView, "status" | "ended" | "period">): { tone: "open" | "waitlist" | "closed" | "cancelled" | "rescheduled" | "ended"; label: string } {
  if (period) return { tone: "open", label: period.openLabel };
  // A cancelled event stays cancelled after its date; anything else that's over has simply ended.
  if (status === "cancelled") return { tone: "cancelled", label: "Cancelled" };
  if (ended) return { tone: "ended", label: "Ended" };
  if (status === "open") return { tone: "open", label: "Registration open" };
  if (status === "waitlist") return { tone: "waitlist", label: "Waitlist open" };
  if (status === "rescheduled") return { tone: "rescheduled", label: "Rescheduled" };
  return { tone: "closed", label: "Registration closed" };
}

/** Why there's no button to sign up, in a sentence. Null while there is one. */
export function signUpNote({ status, ended, signUp }: Pick<EventView, "status" | "ended" | "signUp">) {
  if (signUp) return null;
  if (status === "cancelled") return "This event was cancelled.";
  if (ended) return "This event has ended.";
  if (status === "rescheduled") return "This event was rescheduled. Sign-ups are paused for now.";
  return "Registration is closed.";
}
