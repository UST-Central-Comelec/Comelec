import Link from "next/link";
import { SlidingSubtabs } from "./sliding-subtabs";
import { EventEvaluationEditor } from "@/components/portal/event-evaluation-editor";
import { EventAttendance } from "@/components/portal/event-attendance";
import { getEvaluationSettings, listEvaluationResponses } from "@/lib/events/evaluation-store";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, Check, Pencil } from "lucide-react";
import { ChangeRequestForm } from "@/components/portal/change-request-form";
import { EventAnalyticsView } from "@/components/portal/event-analytics";
import { EventStatusTag } from "@/components/portal/event-tags";
import { EventRegistrationLink } from "@/components/portal/event-registration-link";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { RegistrantsTable, type RegistrantRow } from "@/components/portal/registrants-table";
import { EventBackground } from "@/components/events/event-background";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/email/template";
import { analyze } from "@/lib/events/analytics";
import { canManageEvent, canRequestChanges, canSeeInside } from "@/lib/events/access";
import { formatEventDates, formatTime, scheduleRows } from "@/lib/events/format";
import { affiliationLabels, comelecUnit, describeAudience, requestKinds, sexes, venueModes, type RequestKind } from "@/lib/events/options";
import { getEvent } from "@/lib/events/queries";
import { affiliationDetails, participationDetails } from "@/lib/events/registration-details";
import { listRegistrations } from "@/lib/events/registrations";
import { markEventChangesAddressed, removeRegistration, resendAcknowledgement, requestEventChanges, saveRequestDecisions, withdrawEventChanges } from "@/lib/portal/event-actions";
import { settle } from "@/lib/portal/settle";

export type EventTab = "background" | "registrants" | "analytics" | "evaluation" | "attendance";

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** Label-and-value pairs, without the ones left empty. */
const given = (facts: Array<[string, string | null | undefined]>) => facts.filter((fact): fact is [string, string] => Boolean(fact[1]?.trim()));

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/**
 * One event in the portal: its background, everyone who signed up with their answers, and what
 * those answers add up to. The unit that organizes it can edit it and remove registrations; a
 * Central account reading a Local unit's event can ask the unit for changes instead (and the
 * Central Executive Board can do either). A Local account can open another unit's event, the
 * Central Comelec's included, for its background only: who signed up stays with the unit that
 * organizes it and the Central Comelec.
 */
export async function EventDetailPage({ id, notice, tab }: { id: string; notice?: string | string[]; tab: EventTab }) {
  const [user, event] = await withPortalUser(getEvent(id), allowed("events"));
  if (!event) notFound();

  // Sign-ups hold students' details, so they're only loaded for those who may read them.
  const seesInside = canSeeInside(user, event);
  if (tab !== "background" && !seesInside) redirect(`/portal/events/${id}`);
  const registrations = seesInside && (tab === "registrants" || tab === "analytics") ? await settle(listRegistrations(id)) : { value: [], error: null };
  const manages = canManageEvent(user, event);
  const asksForChanges = canRequestChanges(user, event);
  const unit = comelecUnit(event.organizer, event.college);
  const people = registrations.value ?? [];
  const evaluation = seesInside && (tab === "evaluation" || tab === "registrants") ? await settle(listEvaluationResponses(id)) : { value: [], error: null };
  const evaluationSettings = seesInside && (tab === "evaluation" || tab === "registrants") ? await settle(getEvaluationSettings(id)) : null;
  const responses = evaluation.value ?? [];
  const responseByRegistrant = new Map(responses.filter(r => r.registration_id).map(r => [r.registration_id, r]));
  const rows: RegistrantRow[] = (tab === "registrants" ? people : []).map((person) => ({
    id: person.id,
    attendanceConfirmedAt: person.attendanceConfirmedAt,
    evaluation: responseByRegistrant.get(person.id) ?? null,
    referenceCode: person.referenceCode,
    name: person.name,
    lastName: person.lastName,
    firstName: person.firstName,
    middleName: person.middleName,
    email: person.email,
    verified: person.verified,
    sex: sexes[person.sex],
    age: person.age,
    studentNumber: person.studentNumber,
    affiliation: affiliationLabels[person.affiliation],
    // In the list row, a student is placed by their college or faculty.
    affiliationSummary: person.affiliation === "ust-student" && person.college ? person.college : affiliationLabels[person.affiliation],
    affiliationFacts: affiliationDetails(person).facts,
    attending: participationDetails(person),
    // In the form's order, whatever order the database keeps them in.
    requests: (Object.keys(requestKinds) as RequestKind[]).filter((kind) => person.requests[kind]).map((kind) => {
      const entry = person.requests[kind]!;
      const facts: Array<[string, string | undefined]> = kind === "parking"
        ? [["Plate", entry.plate], ["Car", [entry.color, entry.model].filter(Boolean).join(" ")], ["Arriving", entry.arrival && formatTime(entry.arrival)]]
        : kind === "dietary" ? [["Allergens", entry.allergens]] : [];
      return { kind, label: requestKinds[kind].short, facts: given(facts), status: entry.status };
    }),
    status: person.status,
    signedUp: formatWhen(person.registeredAt),
  }));
  const requested = event.changeRequest && event.changeRequestedAt ? `Asked by ${event.changeRequestedBy ?? "the Central Comelec"} on ${formatWhen(event.changeRequestedAt)}.` : null;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/events">← Events</Link>
          <h1>{event.name}</h1>
          <EventRegistrationLink href={`${siteUrl()}/events/${event.id}/register`} />
          <EventRegistrationLink label="Evaluation form" href={`${siteUrl()}/events/${event.id}/evaluate`} />
        </div>
        <div className="portal-head-actions">
          <a className="portal-button is-ghost" href={`/events/${event.id}`} target="_blank" rel="noreferrer">View on website <ArrowUpRight size={15} aria-hidden="true" /></a>
          {manages && <Link className="portal-button" href={`/portal/events/${event.id}/edit`}><Pencil size={15} aria-hidden="true" /> Edit event</Link>}
        </div>
      </header>
      <Notice notice={notice} />

      <SlidingSubtabs
        active={tab}
        label="Event sections"
        scope={`event:${id}`}
        className="event-detail-tabs"
        items={[
          { key: "background", href: `/portal/events/${id}`, label: "Background" },
          ...(seesInside ? [
            { key: "registrants", href: `/portal/events/${id}/registrants`, label: "Registrants" },
            { key: "attendance", href: `/portal/events/${id}/attendance`, label: "Attendance" },
            { key: "evaluation", href: `/portal/events/${id}/evaluation`, label: "Evaluation Form" },
            { key: "analytics", href: `/portal/events/${id}/analytics`, label: "Analytics" },
          ] : []),
        ]}
      />

      {evaluation.error && <p className="portal-form-error" role="alert">{evaluation.error}</p>}
      {evaluationSettings?.error && <p className="portal-form-error" role="alert">{evaluationSettings.error}</p>}
      {tab === "evaluation" && evaluationSettings?.value && <EventEvaluationEditor eventId={id} initial={evaluationSettings.value} editable={manages} responses={responses} />}
      {tab === "attendance" && (manages ? <EventAttendance eventId={id} /> : <section className="portal-card"><p>Only officers who manage this event can record attendance.</p></section>)}

      {/* The unit's side of a request: what was asked, and the two ways to settle it. */}
      {tab === "background" && manages && !asksForChanges && event.changeRequest && (
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
      {tab === "background" && asksForChanges && (
        <section className={`portal-card portal-event-request${event.changeRequest ? " is-pending" : ""}`} aria-labelledby="request-title">
          <header className="portal-card-head">
            <TitleWithInfo as="h2" className="portal-card-title" id="request-title" info={manages
              ? `This event belongs to the ${unit}. As Central Executive Board you can edit it yourself, or ask the unit to change something.`
              : `This event belongs to the ${unit}, which manages it. You can read everything here, and ask the unit to change something.`}>Request changes</TitleWithInfo>
            {event.changeRequest && <span className="portal-tag is-gold">Waiting on the unit</span>}
          </header>
          {requested && <p className="portal-muted">{requested}</p>}
          <ChangeRequestForm action={requestEventChanges.bind(null, event.id)} withdraw={withdrawEventChanges.bind(null, event.id)} current={event.changeRequest} />
        </section>
      )}

      {tab === "background" && <section className="portal-card portal-event-section" id="background" aria-labelledby="background-title">
        <header className="portal-card-head">
          <h2 className="portal-card-title" id="background-title">Event background</h2>
        </header>
        <div className="portal-event-background">
          <dl className="portal-details">
            <Detail label="Name">{event.name}</Detail>
            <Detail label={event.endDate !== event.eventDate ? "Dates" : "Date"}>{formatEventDates(event)}</Detail>
            {scheduleRows(event).map(([label, value]) => <Detail key={label} label={label}>{value}</Detail>)}
            <Detail label="Venue type">{venueModes[event.venueMode]}</Detail>
            <Detail label="Venue details">{event.venueDetails}</Detail>
            <Detail label="Participants">{describeAudience(event)}</Detail>
            <Detail label="Organizer">{unit}</Detail>
            <Detail label="Registration"><EventStatusTag event={event} /></Detail>
            <Detail label="Last updated time">{formatWhen(event.updatedAt)}</Detail>
            <Detail label="Last updated by">{event.updatedBy}</Detail>
          </dl>
          <div className="portal-event-copy">
            <h3>Short description</h3>
            <p>{event.summary}</p>
            <h3>Background</h3>
            <EventBackground value={event.background} fallback={<p className="portal-muted">None written. The event’s page shows the short description instead.</p>} />
          </div>
        </div>
      </section>}

      {tab === "registrants" && (
          <section className="portal-card is-flush portal-event-section" id="registrants" aria-labelledby="registrants-title">
            <header className="portal-settings-head">
              <TitleWithInfo as="h2" className="portal-card-title" id="registrants-title" info={manages
                ? "Everyone who registered or joined the waitlist, newest first. Open a registrant for the answers they gave on the form, and answer what they asked for under Logistics: pick Approve or Decline for each, then Save, which emails them every answer that changed. Remove a registration if it’s a duplicate, a mistake, or someone asks for their details to be deleted."
                : "Everyone who registered or joined the waitlist, newest first. Open a registrant for the answers they gave on the form. Only the organizing unit can remove a registration or answer what was asked for under Logistics."}>Registrants</TitleWithInfo>
              <span className="portal-index">{people.length === 1 ? "1 sign-up" : `${people.length} sign-ups`}</span>
            </header>
            {registrations.error ? (
              <p className="portal-form-error" role="alert">Couldn’t load the registrations. ({registrations.error})</p>
            ) : (
              <RegistrantsTable rows={rows} evaluationQuestions={evaluationSettings?.value?.questions} resend={manages ? resendAcknowledgement.bind(null, event.id) : undefined} remove={manages ? removeRegistration.bind(null, event.id) : undefined} save={manages ? saveRequestDecisions.bind(null, event.id) : undefined} />
            )}
          </section>

      )}

      {tab === "analytics" && (registrations.error
        ? <p className="portal-form-error" role="alert">Couldn’t load the analytics. ({registrations.error})</p>
        : <EventAnalyticsView analytics={analyze(people)} />)}

      {!seesInside && (
        <p className="portal-muted">This event belongs to the {unit}, which manages it. Who signed up, and how they answered, is for {event.organizer === "central" ? "the Central Comelec" : "that unit and the Central Comelec"} to see.</p>
      )}
    </main>
  );
}
