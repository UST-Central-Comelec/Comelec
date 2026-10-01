import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { EventForm } from "@/components/portal/event-form";
import { OrganizerTag } from "@/components/portal/event-tags";
import { withPortalUser } from "@/lib/auth/session";
import { canManageEvent } from "@/lib/events/access";
import { getEvent } from "@/lib/events/queries";
import { countRegistrations } from "@/lib/events/registrations";
import { deleteEvent, updateEvent } from "@/lib/portal/event-actions";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/portal/events/[id]/edit">) {
  const { id } = await params;
  const [user, [event, counts]] = await withPortalUser(Promise.all([getEvent(id), countRegistrations().catch(() => null)]));
  // Only the unit that organizes an event edits it; a Central account reading a Local unit's event has no edit page.
  if (!event || !canManageEvent(user, event)) notFound();

  const count = counts?.[event.id];
  const signUps = count ? count.registered + count.waitlisted : 0;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href={`/portal/events/${event.id}`}>← {event.name}</Link>
          <h1>Edit event</h1>
          <p className="portal-organizer-line portal-muted">Organized by <OrganizerTag event={event} /></p>
        </div>
      </header>
      <section className="portal-card">
        <EventForm
          action={updateEvent.bind(null, event.id)}
          submitLabel="Save changes"
          cancelHref={`/portal/events/${event.id}`}
          initial={{ name: event.name, summary: event.summary, background: event.background, eventDate: event.eventDate, ingressTime: event.ingressTime, startsTime: event.startsTime, endsTime: event.endsTime, egressTime: event.egressTime, venueMode: event.venueMode, venueDetails: event.venueDetails, openToStudents: event.openToStudents, openToExternals: event.openToExternals, openToAdmins: event.openToAdmins, registrationStatus: event.registrationStatus }}
          changeRequest={event.changeRequest}
          danger={
            <DeleteButton
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
