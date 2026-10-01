import { ArrowUpRight, CalendarDays, Clock, DoorClosed, DoorOpen, MapPin, Users, Video, type LucideIcon } from "lucide-react";
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
export function StatusTag({ event }: { event: Pick<EventView, "status" | "ended"> }) {
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
 * Register, or Join the waitlist while registration hasn't opened: either starts Google sign-in for a
 * UST account, then lands on the event's form. A plain link, so nothing prefetches it. When the
 * event isn't taking sign-ups, a line saying why instead.
 */
export function SignUp({ event, small, block }: { event: Pick<EventView, "id" | "status" | "ended" | "signUp">; small?: boolean; block?: boolean }) {
  const note = signUpNote(event);
  if (note) return <p className="ev-note">{note}</p>;
  return (
    <a className={`ev-button is-primary${small ? " is-small" : ""}${block ? " is-block" : ""}`} href={`/events/${event.id}/register/start`} rel="nofollow">
      {event.signUp === "waitlist" ? "Join the waitlist" : "Register"}
      <ArrowUpRight size={small ? 15 : 16} aria-hidden="true" />
    </a>
  );
}
