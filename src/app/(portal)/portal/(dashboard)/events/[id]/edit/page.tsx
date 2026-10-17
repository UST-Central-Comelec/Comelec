import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { EventForm } from "@/components/portal/event-form";
import { ActingAs } from "@/components/portal/event-tags";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { listCalendarHighlights } from "@/lib/calendar/store";
import { settle } from "@/lib/portal/settle";
import { canManageEvent, isOwn } from "@/lib/events/access";
import { getEvaluationSettings } from "@/lib/events/evaluation-store";
import { stampFor } from "@/lib/data/edit-guard";
import { defaultRsvpDefinition } from "@/lib/events/rsvp";
import { getRsvpSettings } from "@/lib/events/rsvp-store";
import { ensureQrCodes } from "@/lib/events/qr-codes";
import { getEvent } from "@/lib/events/queries";
import { countRegistrations } from "@/lib/events/registrations";
import { deleteEvent, updateEvent } from "@/lib/portal/event-actions";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/portal/events/[id]/edit">) {
  const { id } = await params;
  const [user, [event, counts]] = await withPortalUser(Promise.all([getEvent(id), countRegistrations().catch(() => null)]), allowed("events"));
  // The unit that organizes an event edits it, and so can the Central Executive Board; any other Central account reading a Local unit's event has no edit page.
  if (!event || !canManageEvent(user, event)) notFound();

  // Opening the editor also makes any of the event's form QR codes that don't exist yet.
  const [rsvpSettings, evaluationSettings] = await Promise.all([getRsvpSettings(id), getEvaluationSettings(id), ensureQrCodes(id).catch(() => undefined)]);
  const count = counts?.[event.id];
  const signUps = count ? count.registered + count.waitlisted : 0;
  const highlights = await settle(listCalendarHighlights({ college: event.organizer === "local" ? event.college : null }));

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href={`/portal/events/${event.id}`}>← {event.name}</Link>
          <h1>Edit event</h1>
        </div>
      </header>
      <ActingAs unit={event}>{isOwn(user, event) ? "You’re editing this event as" : "You’re editing an event of the"}</ActingAs>
      <section className="portal-card">
        {highlights.error && <p className="portal-form-error" role="alert">Calendar conflict checks are unavailable. {highlights.error}</p>}
        <EventForm
          calendarHighlights={highlights.value ?? []}
          action={updateEvent.bind(null, event.id)}
          submitLabel="Save changes"
          cancelHref={`/portal/events/${event.id}`}
          initial={{ name: event.name, summary: event.summary, background: event.background, eventDate: event.eventDate, endDate: event.endDate, ingressTime: event.ingressTime, startsTime: event.startsTime, endsTime: event.endsTime, egressTime: event.egressTime, venueMode: event.venueMode, venueType: event.venueType ?? (event.venueMode === "online" ? "online" : "in-campus"), natureOfActivity: event.natureOfActivity ?? "", venueDetails: event.venueDetails, openToStudents: event.openToStudents, openToExternals: event.openToExternals, openToAdmins: event.openToAdmins, openToInternal: event.openToInternal, collaborators: event.collaborators, otherCollaborators: event.otherCollaborators, minimumRegistrants: event.minimumRegistrants, maximumRegistrants: event.maximumRegistrants, registeredCount: event.registeredCount, registrationStatus: event.registrationStatus, requireGoogle: event.requireGoogle }}
          eventId={id}
          evaluationSettings={evaluationSettings}
          rsvpSettings={rsvpSettings}
          changeRequest={event.changeRequest}
          guard={{ stamp: stampFor(event.updatedAt, { ...event, rsvpDefinition: rsvpSettings?.definition ?? defaultRsvpDefinition, evaluation: evaluationSettings }), record: `events/${event.id}` }}
          danger={
            <DeleteButton
              key="delete-event"
              action={deleteEvent.bind(null, event.id)}
              label="Delete event"
              prompt={signUps > 0 ? `Delete it, and the ${signUps === 1 ? "registration" : `${signUps} registrations`} for it?` : "Delete permanently?"}
            />
          }
        />
      </section>
    </main>
  );
}
