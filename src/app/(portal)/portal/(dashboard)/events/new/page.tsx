import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/portal/event-form";
import { OrganizerTag } from "@/components/portal/event-tags";
import { isLocal, requirePortalUser } from "@/lib/auth/session";
import { manilaToday } from "@/lib/events/format";
import { createEvent } from "@/lib/portal/event-actions";

export const metadata: Metadata = { title: "Add event" };

export default async function NewEventPage() {
  const user = await requirePortalUser();
  // The event belongs to the unit of whoever adds it.
  const organizer = isLocal(user) ? { organizer: "local" as const, college: user.college } : { organizer: "central" as const, college: null };

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/events">← Events</Link>
          <h1>Add event</h1>
          <p className="portal-organizer-line portal-muted">Organized by <OrganizerTag event={organizer} /></p>
        </div>
      </header>
      <section className="portal-card">
        <EventForm
          action={createEvent}
          submitLabel="Add event"
          cancelHref="/portal/events"
          initial={{ name: "", summary: "", background: "", eventDate: manilaToday(), ingressTime: null, startsTime: "13:00", endsTime: "15:00", egressTime: null, venueMode: "onsite", venueDetails: "", openToStudents: true, openToExternals: false, openToAdmins: false, registrationStatus: "closed" }}
        />
      </section>
    </main>
  );
}
