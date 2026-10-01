import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, Pencil } from "lucide-react";
import { ChangeRequestForm } from "@/components/portal/change-request-form";
import { EventAnalyticsView } from "@/components/portal/event-analytics";
import { EventStatusTag, OrganizerTag } from "@/components/portal/event-tags";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { RegistrantsTable, type RegistrantRow } from "@/components/portal/registrants-table";
import { withPortalUser } from "@/lib/auth/session";
import { analyze } from "@/lib/events/analytics";
import { canManageEvent, canRequestChanges, canViewEvent } from "@/lib/events/access";
import { formatEventDate, scheduleRows } from "@/lib/events/format";
import { comelecUnit, describeAudience, sexes, venueModes } from "@/lib/events/options";
import { getEvent } from "@/lib/events/queries";
import { listRegistrations } from "@/lib/events/registrations";
import { markEventChangesAddressed, removeRegistration, requestEventChanges, withdrawEventChanges } from "@/lib/portal/event-actions";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Event" };

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/**
 * One event in the portal: its background, everyone who signed up with their answers, and what
 * those answers add up to. The unit that organizes it can edit it and remove registrations; a
 * Central account reading a Local unit's event can ask the unit for changes instead.
 */
export default async function PortalEventPage({ params, searchParams }: PageProps<"/portal/events/[id]">) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const [user, [event, registrations]] = await withPortalUser(Promise.all([getEvent(id), settle(listRegistrations(id))]));
  // A Local account can't open the Central Comelec's events, or another college's.
  if (!event || !canViewEvent(user, event)) notFound();

  const manages = canManageEvent(user, event);
  const asksForChanges = canRequestChanges(user, event);
  const unit = comelecUnit(event.organizer, event.college);
  const people = registrations.value ?? [];
  const rows: RegistrantRow[] = people.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    studentNumber: person.studentNumber,
    sex: sexes[person.sex],
    college: person.college,
    program: person.program,
    yearLevel: person.yearLevelLabel,
    organizations: person.organizations,
    interest: person.interest,
    status: person.status,
    signedUp: formatWhen(person.registeredAt),
  }));
  const paragraphs = event.background.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const requested = event.changeRequest && event.changeRequestedAt ? `Asked by ${event.changeRequestedBy ?? "the Central Comelec"} on ${formatWhen(event.changeRequestedAt)}.` : null;

  return (
    // Wide: the registrants table has an answer in every column.
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href={event.organizer === "local" && user.affiliation === "central" ? "/portal/events?unit=local" : "/portal/events"}>← Events</Link>
          <p className="portal-eyebrow">{unit}</p>
          <h1>{event.name}</h1>
          <p className="portal-muted">{formatEventDate(event.eventDate)} · {venueModes[event.venueMode]}, {event.venueDetails}</p>
        </div>
        <div className="portal-head-actions">
          <EventStatusTag event={event} large />
          <a className="portal-button is-ghost" href={`/events/${event.id}`} target="_blank" rel="noreferrer">View on website <ArrowUpRight size={15} aria-hidden="true" /></a>
          {manages && <Link className="portal-button" href={`/portal/events/${event.id}/edit`}><Pencil size={15} aria-hidden="true" /> Edit event</Link>}
        </div>
      </header>
      <Notice notice={notice} />

      {/* The unit's side of a request: what was asked, and the two ways to settle it. */}
      {manages && event.changeRequest && (
        <section className="portal-card portal-event-request is-pending" aria-label="Changes requested by the Central Comelec">
          <p className="portal-eyebrow">Changes requested by the Central Comelec</p>
          <blockquote className="portal-request-text">{event.changeRequest}</blockquote>
          {requested && <p className="portal-muted">{requested}</p>}
          <div className="portal-form-actions">
            <form action={markEventChangesAddressed.bind(null, event.id)}>
              <button className="portal-button is-ghost" type="submit"><Check size={15} aria-hidden="true" /> Mark as addressed</button>
            </form>
            <Link className="portal-button" href={`/portal/events/${event.id}/edit`}><Pencil size={15} aria-hidden="true" /> Edit event</Link>
          </div>
        </section>
      )}

      {/* The Central Comelec's side: ask, change what was asked, or take it back. */}
      {asksForChanges && (
        <section className={`portal-card portal-event-request${event.changeRequest ? " is-pending" : ""}`} aria-labelledby="request-title">
          <header className="portal-card-head">
            <TitleWithInfo as="h2" className="portal-card-title" id="request-title" info={`This event belongs to the ${unit}, which manages it. You can read everything here, and ask the unit to change something.`}>Request changes</TitleWithInfo>
            {event.changeRequest && <span className="portal-tag is-gold">Waiting on the unit</span>}
          </header>
          {requested && <p className="portal-muted">{requested}</p>}
          <ChangeRequestForm action={requestEventChanges.bind(null, event.id)} withdraw={withdrawEventChanges.bind(null, event.id)} current={event.changeRequest} />
        </section>
      )}

      <nav className="portal-filters portal-anchors" aria-label="On this page">
        <a href="#background">Background</a>
        <a href="#registrants">Registrants<small>{people.length}</small></a>
        <a href="#analytics">Analytics</a>
      </nav>

      <section className="portal-card portal-event-section" id="background" aria-labelledby="background-title">
        <header className="portal-card-head">
          <h2 className="portal-card-title" id="background-title">Event background</h2>
          <OrganizerTag event={event} />
        </header>
        <div className="portal-event-background">
          <dl className="portal-details">
            <Detail label="Date">{formatEventDate(event.eventDate)}</Detail>
            {scheduleRows(event).map(([label, value]) => <Detail key={label} label={label}>{value}</Detail>)}
            <Detail label="Venue">{venueModes[event.venueMode]} · {event.venueDetails}</Detail>
            <Detail label="Participants">{describeAudience(event)}</Detail>
            <Detail label="Registration"><EventStatusTag event={event} /></Detail>
            <Detail label="Last updated">{formatWhen(event.updatedAt)} by {event.updatedBy}</Detail>
          </dl>
          <div className="portal-event-copy">
            <h3>Short description</h3>
            <p>{event.summary}</p>
            <h3>Background</h3>
            {paragraphs.length > 0 ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="portal-muted">None written. The event’s page shows the short description instead.</p>}
          </div>
        </div>
      </section>

      <section className="portal-card is-flush portal-event-section" id="registrants" aria-labelledby="registrants-title">
        <header className="portal-settings-head">
          <TitleWithInfo as="h2" className="portal-card-title" id="registrants-title" info={manages
            ? "Everyone who registered or joined the waitlist, with the answers they gave on the form, newest first. Remove a registration if it’s a duplicate, a mistake, or someone asks for their details to be deleted."
            : "Everyone who registered or joined the waitlist, with the answers they gave on the form, newest first. Only the organizing unit can remove a registration."}>Registrants</TitleWithInfo>
          <span className="portal-index">{people.length === 1 ? "1 sign-up" : `${people.length} sign-ups`}</span>
        </header>
        {registrations.error ? (
          <p className="portal-form-error" role="alert">Couldn’t load the registrations. ({registrations.error})</p>
        ) : (
          <RegistrantsTable rows={rows} remove={manages ? removeRegistration.bind(null, event.id) : undefined} />
        )}
      </section>

      <EventAnalyticsView analytics={analyze(people)} />
    </main>
  );
}
