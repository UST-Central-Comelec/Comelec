import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EventStatusTag } from "@/components/portal/event-tags";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { isLocal, requirePortalUser } from "@/lib/auth/session";
import { canManageEvent, canViewEvent } from "@/lib/events/access";
import { formatEventDateShort, formatTimeRange } from "@/lib/events/format";
import { comelecUnit, hasEnded, venueModes, type CommissionEvent } from "@/lib/events/options";
import { getEvents } from "@/lib/events/queries";
import { countRegistrations } from "@/lib/events/registrations";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Events" };

/** Whose events a Central account is looking at. It starts on its own; Local accounts only ever see their unit's. */
const scopes = { central: "Central Comelec", local: "Local units", all: "All units" } as const;
type Scope = keyof typeof scopes;
const isScope = (value: unknown): value is Scope => typeof value === "string" && value in scopes;

const scopeHref = (scope: Scope) => (scope === "central" ? "/portal/events" : `/portal/events?unit=${scope}`);

/** What's still to come first, soonest at the top; then what's over, most recent first. */
function inListOrder(events: CommissionEvent[], now = Date.now()) {
  const upcoming = events.filter((event) => !hasEnded(event, now));
  const past = events.filter((event) => hasEnded(event, now)).reverse();
  return [...upcoming, ...past];
}

export default async function PortalEventsPage({ searchParams }: PageProps<"/portal/events">) {
  const [user, { unit, notice }] = await Promise.all([requirePortalUser(), searchParams]);
  const local = isLocal(user);
  const scope: Scope = isScope(unit) ? unit : "central";

  const { value, error: loadError } = await settle(Promise.all([getEvents(), countRegistrations()]));
  const [all, counts] = value ?? [[], {}];
  // A Local account sees only its own college's events; a Central account, the units it picked.
  const events = inListOrder(all.filter((event) => canViewEvent(user, event) && (local || scope === "all" || event.organizer === scope)));
  const waiting = local ? 0 : all.filter((event) => event.organizer === "local" && event.changeRequest).length;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info={local
            ? `${comelecUnit("local", user.college)}’s events and activities, as listed on the website’s Events page under your unit’s banner. Open one for its details, who signed up and how they answered. The Central Comelec can see your events and may ask you to change one.`
            : "Events and activities listed on the website’s Events page. Central accounts manage the Central Comelec’s events. Every Local unit manages its own: you can open them to see who signed up, and ask the unit for changes."}>Events</TitleWithInfo>
          {local && <p className="portal-muted">{comelecUnit("local", user.college)}</p>}
        </div>
        <Link className="portal-button" href="/portal/events/new"><Plus size={16} /> Add event</Link>
      </header>
      <Notice notice={notice} />

      {!local && (
        <nav className="portal-filters" aria-label="Filter by organizer">
          {(Object.keys(scopes) as Scope[]).map((value) => (
            <Link key={value} href={scopeHref(value)} className={scope === value ? "is-active" : undefined}>{scopes[value]}</Link>
          ))}
        </nav>
      )}
      {waiting > 0 && scope === "central" && (
        <p className="portal-muted">{waiting === 1 ? "One Local unit’s event has" : `${waiting} Local units’ events have`} changes you asked for still waiting. <Link href={scopeHref("local")}>See Local units</Link></p>
      )}

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load events. Run <code>supabase/migrations/0019_events.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      ) : (
        <section className="portal-card is-flush">
          {events.length === 0 ? (
            <p className="portal-empty">
              {local || scope === "central" ? <>No events yet. <Link href="/portal/events/new">Add the first one.</Link></> : scope === "local" ? "No Local unit has added an event yet." : "No events yet."}
            </p>
          ) : (
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Event</th><th>Date</th><th>Venue</th><th>Status</th><th>Registrants</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const count = counts[event.id] ?? { registered: 0, waitlisted: 0 };
                    const href = `/portal/events/${event.id}`;
                    return (
                      <tr key={event.id}>
                        <td>
                          <Link className="portal-row-title" href={href}>{event.name}</Link>
                          {event.changeRequest && <span className="portal-tag is-gold">Changes requested</span>}
                          {/* The organizer only needs saying where more than one unit's events are listed. */}
                          {!local && scope !== "central" && <small className="portal-muted">{comelecUnit(event.organizer, event.college)}</small>}
                        </td>
                        <td className="is-nowrap">{formatEventDateShort(event.eventDate)}<small className="portal-muted">{formatTimeRange(event.startsTime, event.endsTime)}</small></td>
                        <td>{venueModes[event.venueMode]}<small className="portal-muted">{event.venueDetails}</small></td>
                        <td><EventStatusTag event={event} /></td>
                        <td className="is-nowrap">
                          <span className="portal-event-count">{count.registered}</span>
                          {count.waitlisted > 0 && <small className="portal-muted">{count.waitlisted} on the waitlist</small>}
                        </td>
                        <td className="portal-row-actions"><Link href={href}>{canManageEvent(user, event) ? "Manage" : "View"}</Link></td>
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
