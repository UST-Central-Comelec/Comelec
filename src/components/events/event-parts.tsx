import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock, DoorClosed, DoorOpen, Hourglass, MapPin, Users, Video, type LucideIcon } from "lucide-react";
import { venueModes } from "@/lib/events/options";
import { signUpNote, statusOf, type EventView } from "./event-view";

// The pieces the Events page, an event's own page and its registration page share. Styled in
// src/app/(site)/events/events.css.

/**
 * The banner naming the unit behind an event: gold for the Central Comelec, blue for a college's
 * unit. Across the top of the event's card in the list; with `tag`, a tag on its own.
 */
export function Organizer({ event, tag }: { event: Pick<EventView, "organizer" | "unit">; tag?: boolean }) {
  return (
    <span className={`ev-organizer is-${event.organizer}${tag ? " is-tag" : ""}`}>
      <i aria-hidden="true" />
      <span className="ev-organizer-label">Organized by</span>{" "}
      <strong>{event.unit}</strong>
    </span>
  );
}

/** Whether sign-ups are open, as a tag. The dot pulses while they are. */
export function StatusTag({ event }: { event: Pick<EventView, "status" | "ended" | "period"> }) {
  const { tone, label } = statusOf(event);
  return <span className={`ev-status is-${tone}`}><i aria-hidden="true" />{label}</span>;
}

/** The event form's schedule and venue, one fact per cell. */
export function Facts({ event, className }: { event: EventView; className?: string }) {
  // `extra` marks the facts a small screen can do without where the form is the point.
  const facts: Array<{ icon: LucideIcon; label: string; value: string; detail?: string; extra?: boolean }> = [
    { icon: CalendarDays, label: "Date", value: event.dateLabel },
    ...(event.ingress ? [{ icon: DoorOpen, label: "Ingress", value: event.ingress, extra: true }] : []),
    { icon: Clock, label: "Activity time", value: event.time },
    ...(event.egress ? [{ icon: DoorClosed, label: "Egress", value: event.egress, extra: true }] : []),
    { icon: event.venueMode === "online" ? Video : MapPin, label: "Venue", value: venueModes[event.venueMode], detail: event.venue },
    { icon: Users, label: "Open to", value: event.audience, extra: true },
    // A unit's Recruitment, Political Party Registration or Filing of Candidacy: when it stops taking submissions.
    ...(event.period ? [{ icon: Hourglass, label: "Open until", value: event.period.closes ?? "Further notice" }] : []),
  ];
  return (
    <dl className={`ev-facts${className ? ` ${className}` : ""}`}>
      {facts.map(({ icon: Icon, label, value, detail, extra }) => (
        <div key={label} className={extra ? "is-extra" : undefined}>
          <dt><Icon size={13} strokeWidth={1.8} aria-hidden="true" />{label}</dt>
          <dd>{value}{detail && <small>{detail}</small>}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Register, or Join the waitlist while registration hasn't opened: either opens the event's form, where
 * UST students and staff verify their UST account when the event requires it. A client-side link, so the
 * site's loading screen doesn't play again, and not prefetched, since the form reads a cookie. When the
 * event isn't taking sign-ups, a line saying why instead. A unit's Recruitment, Political Party
 * Registration or Filing of Candidacy leads to its own page.
 */
export function SignUp({ event, small, block }: { event: Pick<EventView, "id" | "status" | "ended" | "signUp" | "period">; small?: boolean; block?: boolean }) {
  const note = signUpNote(event);
  if (note) return <p className="ev-note">{note}</p>;
  return (
    <Link className={`ev-button is-primary${small ? " is-small" : ""}${block ? " is-block" : ""}`} href={event.period ? event.period.href : `/events/${event.id}/register`} prefetch={false} rel={event.period ? undefined : "nofollow"}>
      {event.period ? event.period.action : event.signUp === "waitlist" ? "Join the waitlist" : "Register"}
      <ArrowUpRight size={small ? 15 : 16} aria-hidden="true" />
    </Link>
  );
}
