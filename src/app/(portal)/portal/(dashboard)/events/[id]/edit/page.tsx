import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { EventForm } from "@/components/portal/event-form";
import { ActingAs } from "@/components/portal/event-tags";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { canManageEvent, isOwn } from "@/lib/events/access";
import { getEvent } from "@/lib/events/queries";
import { countRegistrations } from "@/lib/events/registrations";
import { deleteEvent, updateEvent } from "@/lib/portal/event-actions";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/portal/events/[id]/edit">) {
  const { id } = await params;
  const [user, [event, counts]] = await withPortalUser(Promise.all([getEvent(id), countRegistrations().catch(() => null)]), allowed("events"));
  // The unit that organizes an event edits it, and so can the Central Executive Board; any other Central account reading a Local unit's event has no edit page.
  if (!event || !canManageEvent(user, event)) notFound();

  const count = counts?.[event.id];
  const signUps = count ? count.registered + count.waitlisted : 0;

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
        <EventForm
          action={updateEvent.bind(null, event.id)}
          submitLabel="Save changes"
          cancelHref={`/portal/events/${event.id}`}
          initial={{ name: event.name, summary: event.summary, background: event.background, eventDate: event.eventDate, endDate: event.endDate, ingressTime: event.ingressTime, startsTime: event.startsTime, endsTime: event.endsTime, egressTime: event.egressTime, venueMode: event.venueMode, venueDetails: event.venueDetails, openToStudents: event.openToStudents, openToExternals: event.openToExternals, openToAdmins: event.openToAdmins, registrationStatus: event.registrationStatus, requireGoogle: event.requireGoogle }}
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
