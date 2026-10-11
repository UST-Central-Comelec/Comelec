import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/portal/event-form";
import { ActingAs } from "@/components/portal/event-tags";
import { requireEditor } from "@/lib/auth/session";
import { isCalendarDay } from "@/lib/calendar/options";
import { listCalendarHighlights } from "@/lib/calendar/store";
import { settle } from "@/lib/portal/settle";
import { unitOfAccount } from "@/lib/events/access";
import { manilaToday } from "@/lib/events/format";
import { blankDetails } from "@/lib/events/options";
import { createEvent } from "@/lib/portal/event-actions";

export const metadata: Metadata = { title: "Add event" };

export default async function NewEventPage({ searchParams }: PageProps<"/portal/events/new">) {
  const [user, { date, from }] = await Promise.all([requireEditor("events"), searchParams]);
  // Secretariat → Calendar's Add event sends the day picked there, and Cancel leads back to it.
  const back = from === "calendar" ? { href: "/portal/secretariat/calendar", label: "← Calendar" } : { href: "/portal/events", label: "← Events" };
  const day = isCalendarDay(date) ? date : manilaToday();
  // The event belongs to the unit of whoever adds it: nobody adds one for another unit.
  const unit = unitOfAccount(user);
  const highlights = unit ? await settle(listCalendarHighlights({ college: unit.college })) : { value: [], error: null };

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href={back.href}>{back.label}</Link>
          <h1>Add event</h1>
        </div>
      </header>
      {unit ? (
        <>
          <ActingAs unit={unit}>You’re adding this event as</ActingAs>
          <section className="portal-card">
            {highlights.error && <p className="portal-form-error" role="alert">Calendar conflict checks are unavailable. {highlights.error}</p>}
            <EventForm calendarHighlights={highlights.value ?? []} action={createEvent} submitLabel="Add event" cancelHref={back.href} initial={{ ...blankDetails(day), registrationStatus: "closed", requireGoogle: true }} />
          </section>
        </>
      ) : (
        <p className="portal-form-error" role="alert">Your account has no college set, so there’s no unit to add this event for. Ask the Central Executive Board to set it under Accounts.</p>
      )}
    </main>
  );
}
