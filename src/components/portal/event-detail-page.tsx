import { LettersTracker } from "@/components/portal/letters-tracker";
import { EventBackLink } from "@/components/portal/event-back-link";
import { venueTypes } from "@/lib/events/activity-checklist";
import { eventChecklistNames } from "@/lib/events/document-numbering";
import { defaultSecretariatSettings } from "@/lib/letters/settings";
import { getSecretariatSettings } from "@/lib/letters/settings-store";
import { listLetters } from "@/lib/letters/store";
import { getEventDocumentNumberPreview, saveEventDocument, deleteEventDocument, setEventDocumentLabel } from "@/lib/portal/event-document-actions";
import { ViewIcon as ActionViewIcon } from "@/components/action-icons";
import { updateRsvpResponse, removeRsvpResponse, resendRsvpAcknowledgement, saveRsvpRequestDecisions } from "@/lib/events/rsvp-response-actions";
import { listEventEditRequests } from "@/lib/events/edit-requests";
import { addressResponseEdit } from "@/lib/events/edit-request-actions";
import { mergeParticipantRows } from "@/lib/events/participant-rows";
import Link from "next/link";
import { SlidingSubtabs } from "./sliding-subtabs";
import { EventCheckIn } from "@/components/portal/event-check-in";
import { getRsvpSettings, listRsvpResponses } from "@/lib/events/rsvp-store";
import { getEvaluationSettings, listEvaluationResponses } from "@/lib/events/evaluation-store";
import { notFound, redirect } from "next/navigation";
import { Check } from "lucide-react";
import { EditIcon as Pencil } from "@/components/action-icons";
import { ChangeRequestForm } from "@/components/portal/change-request-form";
import { EventAnalyticsView } from "@/components/portal/event-analytics";
import { EventStatusTag } from "@/components/portal/event-tags";
import { EventOverview } from "@/components/portal/event-overview";
import { getPendingDeployment } from "@/lib/events/deployment-store";
import { EventDeployment } from "@/components/portal/event-deployment";
import { getEventResponseCounts } from "@/lib/events/response-counts";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { EventResponsesTable, type EventResponseRow } from "@/components/portal/event-responses-table";
import { EventBackground } from "@/components/events/event-background";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/email/template";
import { analyze } from "@/lib/events/analytics";
import { canManageEvent, canRequestChanges, canSeeInside } from "@/lib/events/access";
import { formatEventDates, formatTime, scheduleRows } from "@/lib/events/format";
import { affiliationLabels, collaboratorLabel, comelecUnit, describeAudience, requestKinds, sexes, venueModes, type RequestKind } from "@/lib/events/options";
import { getEvent } from "@/lib/events/queries";
import { affiliationDetails, participationDetails } from "@/lib/events/registration-details";
import { listRegistrations } from "@/lib/events/registrations";
import { markEventChangesAddressed, removeRegistration, resendAcknowledgement, requestEventChanges, saveRequestDecisions, withdrawEventChanges } from "@/lib/portal/event-actions";
import { settle } from "@/lib/portal/settle";

export type EventTab = "event-details" | "deployment" | "responses" | "check-in" | "documentations" | "analytics" | "evaluation" | "rsvp";

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** Label-and-value pairs, without the ones left empty. */
const given = (facts: Array<[string, string | null | undefined]>) => facts.filter((fact): fact is [string, string] => Boolean(fact[1]?.trim()));

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/**
 * One event in the portal: its details, everyone who signed up with their answers, and what
 * those answers add up to. The unit that organizes it can edit it and remove registrations; a
 * Central account reading a Local unit's event can ask the unit for changes instead (and the
 * Central Executive Board can do either). A Local account can open another unit's event, the
 * Central Comelec's included, for its details only: who signed up stays with the unit that
 * organizes it and the Central Comelec.
 */
export async function EventDetailPage({ id, notice, tab }: { id: string; notice?: string | string[]; tab: EventTab }) {
  const [user, event] = await withPortalUser(getEvent(id), allowed("events"));
  if (!event) notFound();

  // Sign-ups hold students' details, so they're only loaded for those who may read them.
  const seesInside = canSeeInside(user, event);
  if (tab === "rsvp" || tab === "evaluation") redirect(canManageEvent(user, event) ? `/portal/events/${id}/edit` : `/portal/events/${id}`);
  if (tab !== "event-details" && !seesInside) redirect(`/portal/events/${id}`);
  const [documents, documentSettings] = tab === "documentations" ? await Promise.all([
    settle(listLetters({ local: event.organizer === "local", college: event.college, eventId: event.id })),
    settle(getSecretariatSettings()),
  ]) : [null, null];
  const scheduledDeployment = tab === "deployment" || tab === "event-details" ? await settle(getPendingDeployment(id)) : null;
  const responseCounts = tab === "deployment" ? await settle(getEventResponseCounts(id)) : null;
  const registrations = seesInside && (tab === "responses" || tab === "analytics") ? await settle(listRegistrations(id)) : { value: [], error: null };
  const manages = canManageEvent(user, event);
  const asksForChanges = canRequestChanges(user, event);
  const unit = comelecUnit(event.organizer, event.college);
  const people = registrations.value ?? [];
  const evaluation = seesInside && tab === "responses" ? await settle(listEvaluationResponses(id)) : { value: [], error: null };
  const evaluationSettings = seesInside && (tab === "responses" || tab === "deployment") ? await settle(getEvaluationSettings(id)) : null;
  const [rsvpSettings, rsvpResponses] = await Promise.all([
    seesInside && (tab === "responses" || tab === "deployment") ? settle(getRsvpSettings(id)) : null,
    seesInside && tab === "responses" ? settle(listRsvpResponses(id)) : null,
  ]);
  const editRequests = seesInside && tab === "responses" ? await settle(listEventEditRequests(id)) : null;
  const responses = evaluation.value ?? [];
  const responseByRegistrant = new Map(responses.filter(r => r.registration_id && !r.anonymous).map(r => [r.registration_id, r]));
  const rows: EventResponseRow[] = (tab === "responses" ? people : []).map((person) => ({
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
    dateOfBirth: person.dateOfBirth,
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
    submittedAt: person.registeredAt,
  }));
  const requested = event.changeRequest && event.changeRequestedAt ? `Asked by ${event.changeRequestedBy ?? "the Central Comelec"} on ${formatWhen(event.changeRequestedAt)}.` : null;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <EventBackLink />
          <h1>{event.name}</h1>

        </div>
        <div className="portal-head-actions">
          <a className="portal-button is-ghost" href={`/events/${event.id}`} target="_blank" rel="noreferrer">View on website <ActionViewIcon size={15} aria-hidden="true" /></a>
          {manages && <Link className="portal-button" href={`/portal/events/${event.id}/edit`}><Pencil size={15} aria-hidden="true" /> Edit event</Link>}
        </div>
      </header>
      <Notice notice={notice} />

      <SlidingSubtabs
        active={tab}
        label="Event sections"
        scope={`event:${id}`}
        className="event-detail-tabs"
        keepQuery={["from"]}
        items={[
          { key: "event-details", href: `/portal/events/${id}`, label: "Event Details" },
          ...(seesInside ? [
            { key: "deployment", href: `/portal/events/${id}/deployment`, label: "Deployment" },
            { key: "responses", href: `/portal/events/${id}/responses`, label: "Responses" },
            { key: "check-in", href: `/portal/events/${id}/check-in`, label: "Check-In" },
            { key: "documentations", href: `/portal/events/${id}/documentations`, label: "Documentations" },
            { key: "analytics", href: `/portal/events/${id}/analytics`, label: "Analytics" },
          ] : []),
        ]}
      />

      {tab === "event-details" && <EventOverview event={event} />}

      {evaluation.error && <p className="portal-form-error" role="alert">{evaluation.error}</p>}
      {evaluationSettings?.error && <p className="portal-form-error" role="alert">{evaluationSettings.error}</p>}
      {tab === "deployment" && (rsvpSettings?.error || evaluationSettings?.error || scheduledDeployment?.error
        ? <p className="portal-form-error" role="alert">{rsvpSettings?.error || evaluationSettings?.error || scheduledDeployment?.error}</p>
        : evaluationSettings?.value && <EventDeployment key={`${event.updatedAt}:${scheduledDeployment?.value?.error ?? ""}`} scheduled={scheduledDeployment?.value ?? null} eventId={id} eventName={event.name} baseUrl={siteUrl()} published={event.published ?? true} registrationStatus={event.registrationStatus} minimumRegistrants={event.minimumRegistrants} maximumRegistrants={event.maximumRegistrants} registeredCount={event.registeredCount} responseCounts={responseCounts?.value ?? null} requireGoogle={event.requireGoogle} rsvp={rsvpSettings?.value ?? null} evaluation={evaluationSettings.value} editable={manages} />)}
      {tab === "check-in" && (manages ? <EventCheckIn eventId={id} /> : <section className="portal-card"><p>Only officers who manage this event can record attendance.</p></section>)}

      {/* The unit's side of a request: what was asked, and the two ways to settle it. */}
      {tab === "event-details" && manages && !asksForChanges && event.changeRequest && (
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
      {tab === "event-details" && asksForChanges && (
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

      {tab === "event-details" && <section className="portal-card portal-event-section" id="event-details" aria-labelledby="event-details-title">
        <header className="portal-card-head">
          <h2 className="portal-card-title" id="event-details-title">Event Details</h2>
        </header>
        <div className="portal-event-background">
          <dl className="portal-details">
            <Detail label="Name">{event.name}</Detail>
            <Detail label="Event control number">{event.controlNumber ?? "Awaiting automatic numbering"}</Detail>
            <Detail label={event.endDate !== event.eventDate ? "Dates" : "Date"}>{formatEventDates(event)}</Detail>
            {scheduleRows(event).map(([label, value]) => <Detail key={label} label={label}>{value}</Detail>)}
            <Detail label="Venue type">{event.venueType ? venueTypes[event.venueType] : venueModes[event.venueMode]}</Detail>
            <Detail label="Nature of activity">{event.natureOfActivity || "Not set"}</Detail>
            <Detail label="Venue details"><span className="portal-venue-lines">{event.venueDetails}</span></Detail>
            <Detail label="Participants">{describeAudience(event)}</Detail>
            {event.openToInternal && <Detail label="Collaborators">{[...(event.collaborators ?? []).map(collaboratorLabel), ...(event.otherCollaborators ?? [])].join(", ") || "None added"}</Detail>}
            <Detail label="Organizer">{unit}</Detail>
            <Detail label="Registration"><EventStatusTag event={event} building={!!scheduledDeployment?.value && !scheduledDeployment.value.error} /></Detail>
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

      {tab === "responses" && (
          <section className="portal-card is-flush portal-event-section" id="responses" aria-labelledby="responses-title">
            <h2 id="responses-title" className="portal-visually-hidden">Event participants and responses</h2>
            {editRequests?.error && <p className="portal-form-error" role="alert">{editRequests.error}</p>}
            {rsvpResponses?.error && <p className="portal-form-error" role="alert">{rsvpResponses.error}</p>}
            {registrations.error ? (
              <p className="portal-form-error" role="alert">Couldn’t load the registrations. ({registrations.error})</p>
            ) : (
              <EventResponsesTable maximumRegistrants={event.maximumRegistrants} rsvpActions={manages ? { update: updateRsvpResponse.bind(null, event.id), logistics: saveRsvpRequestDecisions.bind(null, event.id), remove: removeRsvpResponse.bind(null, event.id), resend: resendRsvpAcknowledgement.bind(null, event.id) } : undefined} rows={mergeParticipantRows(rows, rsvpResponses?.value ?? [], responses, editRequests?.value ?? [])} addressEdit={manages ? addressResponseEdit.bind(null, event.id) : undefined} evaluationQuestions={evaluationSettings?.value?.questions} resend={manages ? resendAcknowledgement.bind(null, event.id) : undefined} remove={manages ? removeRegistration.bind(null, event.id) : undefined} save={manages ? saveRequestDecisions.bind(null, event.id) : undefined} />
            )}
          </section>

      )}

      {tab === "documentations" && <LettersTracker rows={documents?.value ?? []} settings={documentSettings?.value?.settings ?? defaultSecretariatSettings} eventControlNumber={event.controlNumber} eventChecklist={eventChecklistNames(event)} readOnly={!manages} loadError={documents?.error || documentSettings?.error ? "Couldn’t load event documents. Apply the event_documentations migration and check the Secretariat setup, then reload." : null} preparerName={user.name || user.email} eventActions={{ previewNumber: getEventDocumentNumberPreview.bind(null, id), saveRecord: saveEventDocument.bind(null, id), deleteRecord: deleteEventDocument.bind(null, id), labelRecord: setEventDocumentLabel.bind(null, id) }} />}

      {tab === "analytics" && (registrations.error
        ? <p className="portal-form-error" role="alert">Couldn’t load the analytics. ({registrations.error})</p>
        : <EventAnalyticsView analytics={analyze(people)} />)}

      {!seesInside && (
        <p className="portal-muted">This event belongs to the {unit}, which manages it. Who signed up, and how they answered, is for {event.organizer === "central" ? "the Central Comelec" : "that unit and the Central Comelec"} to see.</p>
      )}
    </main>
  );
}
