import type { Metadata } from "next";
import { SecretariatCalendar } from "@/components/portal/secretariat-calendar";
import { canOpen, isLocal, requireAccess, type PortalUser } from "@/lib/auth/session";
import { unitAbbreviations } from "@/lib/applications/options";
import type { CalendarEntry } from "@/lib/calendar/options";
import { listCalendar } from "@/lib/calendar/store";
import { isOwn, unitOfAccount } from "@/lib/events/access";
import { formatEventTimes, manilaToday } from "@/lib/events/format";
import { listingLink } from "@/lib/events/listing-link";
import { comelecUnit, isOver, registrationStatuses, type Listing } from "@/lib/events/options";
import { getEvents, getPeriodListings } from "@/lib/events/queries";
import { periodKinds } from "@/lib/periods/kinds";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Calendar" };

/** A unit's short name, as the website's event cards print it: "CICS", or "Central Comelec". */
function shortUnit(event: Listing) {
  if (event.organizer === "central") return "Central Comelec";
  const college = event.college ?? "";
  return unitAbbreviations[college] ?? (college === "Graduate School" ? "GS" : college === "Graduate School of Law" ? "GSL" : college ? college.split(/\s+/).map((word) => word[0]).join("").toUpperCase() : "Local");
}

function statusOf(event: Listing, now: number) {
  if (event.period) return event.period.opensAt ? "Scheduled to open" : periodKinds[event.period.kind].openLabel;
  if (event.registrationStatus === "cancelled") return "Cancelled";
  if (isOver(event, now)) return "Ended";
  return event.registrationStatus === "closed" ? "Registration closed" : `Registration ${registrationStatuses[event.registrationStatus].toLowerCase()}`;
}

/** Events and open or scheduled periods as the calendar draws them, soonest first; `now` decides what's over. */
function toEntries(user: PortalUser, listed: Listing[], now = Date.now()): CalendarEntry[] {
  return listed.map((event): CalendarEntry => ({
    id: event.id,
    kind: event.period?.kind ?? "event",
    name: event.name,
    start: event.eventDate,
    end: event.endDate < event.eventDate ? event.eventDate : event.endDate,
    time: formatEventTimes(event),
    unit: shortUnit(event),
    unitName: comelecUnit(event.organizer, event.college),
    organizer: event.organizer === "central" ? "central" : "local",
    own: isOwn(user, event),
    status: statusOf(event, now),
    cancelled: !event.period && event.registrationStatus === "cancelled",
    scheduled: Boolean(event.period?.opensAt),
    link: listingLink(user, event),
  })).sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.name.localeCompare(b.name));
}

export default async function PortalCalendarPage() {
  const user = await requireAccess("secretariat/calendar");
  const local = isLocal(user);
  // Every unit's events, and every unit's Recruitment, Political Party Registration and Filing of
  // Candidacy while it's open or scheduled to open, as the Events tab lists them.
  const [events, listings, saved] = await Promise.all([
    settle(getEvents()),
    getPeriodListings({ withScheduled: true }),
    local && !user.college ? Promise.resolve({ value: null, error: "Your account has no college set, so there’s no unit calendar to show notes, to-dos and highlights for. Ask the Central Executive Board to set it under Accounts." }) : settle(listCalendar({ college: local ? user.college : null })),
  ]);
  const unit = unitOfAccount(user);

  return (
    <main className="portal-page is-wide cal-page">
      <SecretariatCalendar
        today={manilaToday()}
        entries={toEntries(user, [...(events.value ?? []), ...listings])}
        data={saved.value ?? { notes: [], todos: [], highlights: [] }}
        unitName={unit ? comelecUnit(unit.organizer, unit.college) : "Your unit"}
        local={local}
        readOnly={user.readOnly || Boolean(saved.error)}
        canAddEvent={canOpen(user, "events") && !user.readOnly && Boolean(unit)}
        // The events' own message already reads "Couldn’t load events: …".
        loadError={[events.error, saved.error].filter(Boolean).join(" ") || null}
      />
    </main>
  );
}
