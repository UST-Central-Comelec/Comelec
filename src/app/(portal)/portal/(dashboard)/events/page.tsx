import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EventStatusTag, OrganizerTag } from "@/components/portal/event-tags";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { canOpen, isLocal, requireAccess, type PortalUser } from "@/lib/auth/session";
import { canManageEvent, canSeeInside } from "@/lib/events/access";
import { formatEventDateShort, formatTimeRange } from "@/lib/events/format";
import { comelecUnit, isOver, type Listing } from "@/lib/events/options";
import { getEvents, getPeriodListings, withPeriodListings } from "@/lib/events/queries";
import { countRegistrations } from "@/lib/events/registrations";
import { periodKinds, settingsHref } from "@/lib/periods/kinds";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Events" };

/** Whose events the list shows, and which kind: every unit's and every kind to begin with. */
const units = { all: "All units", central: "Central Comelec", local: "Local units" } as const;
type UnitFilter = keyof typeof units;
const kinds = { all: "All events", recruitment: "Recruitment", "party-registration": "Political Party", candidacy: "Filing of Candidacy" } as const;
type KindFilter = keyof typeof kinds;
const isUnitFilter = (value: unknown): value is UnitFilter => typeof value === "string" && Object.hasOwn(units, value);
const isKindFilter = (value: unknown): value is KindFilter => typeof value === "string" && Object.hasOwn(kinds, value);

/** The list's address with one filter changed, keeping the other. */
function filterHref({ unit, kind }: { unit: UnitFilter; kind: KindFilter }) {
  const params = new URLSearchParams();
  if (unit !== "all") params.set("unit", unit);
  if (kind !== "all") params.set("type", kind);
  const query = params.toString();
  return `/portal/events${query ? `?${query}` : ""}`;
}

/** What's still to come first, soonest at the top; then what's over, most recent first. */
function inListOrder(events: Listing[], now = Date.now()) {
  const upcoming = events.filter((event) => !isOver(event, now));
  const past = events.filter((event) => isOver(event, now)).reverse();
  return [...upcoming, ...past];
}

/**
 * Where a row leads, and what its link says. An event opens in the portal. A unit's Recruitment,
 * Political Party Registration or Filing of Candidacy is listed here while it's open, and is
 * managed from its Settings: the row leads there for whoever may open them, and to its page on the
 * website for everyone else.
 */
function rowLink(user: PortalUser, event: Listing): { href: string; label: string; external?: boolean } | null {
  const manages = canManageEvent(user, event);
  if (!event.period) return { href: `/portal/events/${event.id}`, label: manages ? "Manage" : "View" };
  if (canOpen(user, periodKinds[event.period.kind].tab) && canSeeInside(user, event)) return { href: settingsHref(event.period.kind, event), label: manages ? "Manage" : "View" };
  // Scheduled but not open yet: it has no page on the website until it opens.
  if (event.period.opensAt) return null;
  return { href: `/events/${event.id}`, label: "View", external: true };
}

export default async function PortalEventsPage({ searchParams }: PageProps<"/portal/events">) {
  const [user, { unit: unitParam, type, notice }] = await Promise.all([requireAccess("events"), searchParams]);
  const local = isLocal(user);
  const filters = { unit: isUnitFilter(unitParam) ? unitParam : "all", kind: isKindFilter(type) ? type : "all" } as { unit: UnitFilter; kind: KindFilter };

  // What each unit has open is listed among the events; it's left out, not an error, when it can't be read.
  const [{ value, error: loadError }, listings] = await Promise.all([settle(Promise.all([getEvents(), countRegistrations()])), getPeriodListings({ withScheduled: true })]);
  const all = value?.[0] ?? [];
  const counts: Awaited<ReturnType<typeof countRegistrations>> = value?.[1] ?? {};
  // Recruitment, Political Party Registration and Filing of Candidacy are each unit's major events, listed while they're open.
  const events = inListOrder(withPeriodListings(all, listings).filter((event) => (filters.unit === "all" || event.organizer === filters.unit) && (filters.kind === "all" || event.period?.kind === filters.kind)));
  const waiting = local || user.readOnly ? 0 : all.filter((event) => event.organizer === "local" && event.changeRequest).length;
  const ownUnit = comelecUnit(local ? "local" : "central", user.college);

  return (
    // Wide: every unit's events are listed together, each with whose it is.
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info={local
            ? `Every unit’s events and activities, as the website’s Events page lists them: the Central Comelec’s and every Local unit’s. You add and manage events for the ${ownUnit} only. Open one of yours for its details, who signed up and how they answered. The Central Comelec can see your events and may ask you to change one. A unit’s Recruitment, Political Party Registration and Filing of Candidacy are listed here too once they’re scheduled, and on the website once they open.`
            : user.position === "executive-board"
              ? "Every unit’s events and activities, as the website’s Events page lists them. Central accounts add and manage the Central Comelec’s events, and every Local unit its own. As Central Executive Board you can open and edit a unit’s events too, or ask the unit for changes. A unit’s Recruitment, Political Party Registration and Filing of Candidacy are listed here too once they’re scheduled, and on the website once they open."
              : "Every unit’s events and activities, as the website’s Events page lists them. Central accounts add and manage the Central Comelec’s events. Every Local unit manages its own: you can open them to see who signed up, and ask the unit for changes. A unit’s Recruitment, Political Party Registration and Filing of Candidacy are listed here too once they’re scheduled, and on the website once they open."}>Events</TitleWithInfo>
          {local && <p className="portal-muted">{ownUnit}</p>}
        </div>
        {user.readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/events/new"><Plus size={16} /> Add event</Link>}
      </header>
      <Notice notice={notice} />

      {/* Whose, then which kind: side by side, wrapping onto a second row when there's no room. */}
      <div className="portal-filter-rows is-inline">
        <nav className="portal-filters" aria-label="Filter by unit">
          {(Object.keys(units) as UnitFilter[]).map((value) => (
            <Link key={value} href={filterHref({ ...filters, unit: value })} className={filters.unit === value ? "is-active" : undefined}>{units[value]}</Link>
          ))}
        </nav>
        <nav className="portal-filters" aria-label="Filter by kind">
          {(Object.keys(kinds) as KindFilter[]).map((value) => (
            <Link key={value} href={filterHref({ ...filters, kind: value })} className={filters.kind === value ? "is-active" : undefined}>{kinds[value]}</Link>
          ))}
        </nav>
      </div>
      {waiting > 0 && filters.unit !== "local" && filters.kind === "all" && (
        <p className="portal-muted">{waiting === 1 ? "One Local unit’s event has" : `${waiting} Local units’ events have`} changes you asked for still waiting. <Link href={filterHref({ unit: "local", kind: "all" })}>See Local units</Link></p>
      )}

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load events. Run <code>supabase/migrations/0019_events.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      ) : (
        <section className="portal-card is-flush">
          {events.length === 0 ? (
            <p className="portal-empty">
              {filters.kind !== "all"
                ? `No unit${filters.unit === "central" ? " of the Central Comelec" : filters.unit === "local" ? " among the Local units" : ""} has ${kinds[filters.kind]} open right now. It’s listed here while it is, and set under its Settings.`
                : filters.unit === "local" ? "No Local unit has added an event yet." : user.readOnly || (filters.unit === "central" && local) ? "No events yet." : <>No events yet. <Link href="/portal/events/new">Add the first one.</Link></>}
            </p>
          ) : (
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Event</th><th>Dates</th><th>Venue</th><th>Status</th><th>Registrants</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const count = counts[event.id] ?? { registered: 0, waitlisted: 0 };
                    const link = rowLink(user, event);
                    return (
                      <tr key={event.id}>
                        <td>
                          {link ? <Link className="portal-row-title" href={link.href} target={link.external ? "_blank" : undefined}>{event.name}</Link> : <span className="portal-row-title">{event.name}</span>}
                          {/* Every unit's events are listed together, so each says whose it is, by its short name. */}
                          <span className="portal-row-tags"><OrganizerTag event={event} short /></span>
                        </td>
                        <td className="is-nowrap">{formatEventDateShort(event.eventDate)}<small className="portal-muted">{formatEventDateShort(event.endDate)}</small></td>
                        <td className="portal-event-venue">{event.venueDetails}<small className="portal-muted">{formatTimeRange(event.startsTime, event.endsTime)}</small></td>
                        <td><EventStatusTag event={event} compact /></td>
                        {/* Sign-ups for a unit's Recruitment, Political Party or Filing of Candidacy go through their own pages, not the event form. */}
                        <td className="is-nowrap">{event.period ? <span className="portal-muted">—</span> : <span className="portal-event-count">{count.registered}</span>}</td>
                        <td className="portal-row-actions">{link && <Link href={link.href} target={link.external ? "_blank" : undefined}>{link.label}</Link>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
