import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/portal/event-form";
import { ActingAs } from "@/components/portal/event-tags";
import { requireEditor } from "@/lib/auth/session";
import { unitOfAccount } from "@/lib/events/access";
import { manilaToday } from "@/lib/events/format";
import { blankDetails } from "@/lib/events/options";
import { createEvent } from "@/lib/portal/event-actions";

export const metadata: Metadata = { title: "Add event" };

export default async function NewEventPage() {
  const user = await requireEditor("events");
  // The event belongs to the unit of whoever adds it: nobody adds one for another unit.
  const unit = unitOfAccount(user);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/events">← Events</Link>
          <h1>Add event</h1>
        </div>
      </header>
      {unit ? (
        <>
          <ActingAs unit={unit}>You’re adding this event as</ActingAs>
          <section className="portal-card">
            <EventForm action={createEvent} submitLabel="Add event" cancelHref="/portal/events" initial={{ ...blankDetails(manilaToday()), registrationStatus: "closed", requireGoogle: true }} />
          </section>
        </>
      ) : (
        <p className="portal-form-error" role="alert">Your account has no college set, so there’s no unit to add this event for. Ask the Central Executive Board to set it under Accounts.</p>
      )}
    </main>
  );
}
