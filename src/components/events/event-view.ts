import type { Affiliation } from "@/lib/data/types";
import { formatEventDate, formatTime, formatTimeRange } from "@/lib/events/format";
import { comelecUnit, describeAudience, hasEnded, signUpMode, venueModes, type CommissionEvent, type RegistrationStatus, type SignUpMode } from "@/lib/events/options";

// An event as the website shows it: its day and times already in words, and what a visitor can do
// about it, worked out on the server so every visitor's browser draws the same thing.

export type EventView = {
  id: string;
  name: string;
  summary: string;
  /** YYYY-MM-DD, for the calendar and the date block. */
  date: string;
  /** "Tuesday, October 20, 2026". */
  dateLabel: string;
  /** "12:30 PM", when the event has one. */
  ingress: string | null;
  /** "1:00 – 4:00 PM". */
  time: string;
  egress: string | null;
  venueMode: keyof typeof venueModes;
  venue: string;
  /** "Students only". */
  audience: string;
  organizer: Affiliation;
  /** "Central Comelec", or "Faculty of Pharmacy Comelec Unit". */
  unit: string;
  status: RegistrationStatus;
  /** The activity's end time has passed. */
  ended: boolean;
  /** Whether a visitor can register or join the waitlist right now. */
  signUp: SignUpMode | null;
};

/** `now` decides whether the event is over and whether it's taking sign-ups: the moment the page is rendered, unless given. */
export function toEventView(event: CommissionEvent, now = Date.now()): EventView {
  return {
    id: event.id,
    name: event.name,
    summary: event.summary,
    date: event.eventDate,
    dateLabel: formatEventDate(event.eventDate),
    ingress: event.ingressTime ? formatTime(event.ingressTime) : null,
    time: formatTimeRange(event.startsTime, event.endsTime),
    egress: event.egressTime ? formatTime(event.egressTime) : null,
    venueMode: event.venueMode,
    venue: event.venueDetails,
    audience: describeAudience(event),
    organizer: event.organizer,
    unit: comelecUnit(event.organizer, event.college),
    status: event.registrationStatus,
    ended: hasEnded(event, now),
    signUp: signUpMode(event, now),
  };
}

/** How an event's sign-ups read on the website. `tone` picks the tag's colour. */
export function statusOf({ status, ended }: Pick<EventView, "status" | "ended">): { tone: "open" | "waitlist" | "closed" | "cancelled" | "rescheduled" | "ended"; label: string } {
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
