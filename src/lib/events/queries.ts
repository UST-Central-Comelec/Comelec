import "server-only";

import { closingTime, isAccepting, isUpcoming } from "@/lib/applications/period";
import { store } from "@/lib/data/store";
import { listingId, parseListingId } from "@/lib/periods/kinds";
import { listUnitPeriodsForSite, type UnitPeriod } from "@/lib/periods/store";
import { createAdminClient } from "@/lib/supabase/server";
import type { CommissionEvent, Listing } from "./options";

// Events as the website and the portal read them, from public.events
// (supabase/migrations/0019_events.sql) through the content store.

/** Postgres hands times back as "13:00:00"; the app works in "13:00". */
const hoursAndMinutes = (time: string | null | undefined) => (time ? time.slice(0, 5) : null);

function normalize(event: CommissionEvent): CommissionEvent {
  return {
    ...event,
    background: event.background ?? "",
    // Before supabase/migrations/0028 an event has one date: it ends the day it starts.
    endDate: event.endDate ?? event.eventDate,
    // Before supabase/migrations/0029 every event verified its registrants.
    requireGoogle: event.requireGoogle ?? true,
    ingressTime: hoursAndMinutes(event.ingressTime),
    startsTime: hoursAndMinutes(event.startsTime) ?? "00:00",
    endsTime: hoursAndMinutes(event.endsTime) ?? "23:59",
    egressTime: hoursAndMinutes(event.egressTime),
    college: event.college ?? null,
    changeRequest: event.changeRequest ?? null,
    changeRequestedBy: event.changeRequestedBy ?? null,
    changeRequestedAt: event.changeRequestedAt ?? null,
  };
}

const startOf = (event: CommissionEvent) => `${event.eventDate}T${event.startsTime}`;

/** Soonest first; events at the same time go by name. */
export const byStart = (a: CommissionEvent, b: CommissionEvent) => startOf(a).localeCompare(startOf(b)) || a.name.localeCompare(b.name);

/** Every event, soonest first. */
export async function getEvents() {
  return (await store.list("events")).map(normalize).sort(byStart);
}

export async function getEvent(id: string) {
  const event = await store.get("events", id);
  return event ? normalize(event) : null;
}

/**
 * For the website: an events hiccup (or a database that hasn't had 0019 run yet) shows no events
 * rather than taking the page down.
 */
export async function getEventsForSite() {
  try {
    return await getEvents();
  } catch (error) {
    console.error(error);
    return [];
  }
}

// A unit's open periods, listed with the events -------------------------------------------------

/**
 * A unit's Recruitment, Political Party Registration or Filing of Candidacy as a listing, under the
 * event details the unit gave it. Null while it's closed, and until it has those details. One that's
 * scheduled but hasn't opened yet is only listed `withScheduled`: the portal shows it, the website
 * waits until it opens.
 */
function toListing(period: UnitPeriod, now: number, withScheduled = false): Listing | null {
  const scheduled = isUpcoming(period, now);
  if (!period.details || !(isAccepting(period, now) || (withScheduled && scheduled))) return null;
  const savedAt = period.detailsUpdatedAt ?? period.updatedAt ?? new Date(now).toISOString();
  const savedBy = period.detailsUpdatedBy ?? period.updatedBy ?? "system";
  return {
    ...period.details,
    id: listingId(period.kind, period.unit),
    createdAt: savedAt,
    createdBy: savedBy,
    updatedAt: savedAt,
    updatedBy: savedBy,
    registrationStatus: "open",
    // Their own forms always verify Thomasians.
    requireGoogle: true,
    organizer: period.unit.organizer,
    college: period.unit.college,
    changeRequest: null,
    changeRequestedBy: null,
    changeRequestedAt: null,
    period: { kind: period.kind, closesAt: closingTime(period), opensAt: scheduled && period.opensAt ? Date.parse(period.opensAt) : null },
  };
}

/**
 * Every unit's open Recruitment, Political Party Registration and Filing of Candidacy, as listings,
 * and `withScheduled` (for the portal) those scheduled to open later too. Never throws: one that
 * can't be read just isn't listed.
 */
export async function getPeriodListings({ now = Date.now(), withScheduled = false }: { now?: number; withScheduled?: boolean } = {}): Promise<Listing[]> {
  return (await listUnitPeriodsForSite()).flatMap((period) => toListing(period, now, withScheduled) ?? []);
}

/** The events with those listings among them, soonest first. */
export const withPeriodListings = (events: CommissionEvent[], listings: Listing[]): Listing[] => [...events, ...listings].sort(byStart);

/** Everything the website's Events page lists: every unit's events, and what each unit has open. */
export async function getListingsForSite(): Promise<Listing[]> {
  const [events, listings] = await Promise.all([getEventsForSite(), getPeriodListings()]);
  return withPeriodListings(events, listings);
}

/** One listing by its id, for its own page on the website: an event, or a unit's open period. */
export async function getListingForSite(id: string): Promise<Listing | null> {
  const named = parseListingId(id);
  if (!named) return getEventForSite(id);
  const period = (await listUnitPeriodsForSite(named.kind)).find((candidate) => named.matches(candidate.unit));
  return period ? toListing(period, Date.now()) : null;
}

/** For an event's own page on the website: one that can't be loaded reads as not found. */
export async function getEventForSite(id: string) {
  try {
    return await getEvent(id);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Records the changes the Central Comelec asked a Local unit to make to its event, or clears them
 * (null) once they're addressed or withdrawn. Written on its own, so asking for changes doesn't count
 * as the last edit to the event. False when the event is gone.
 */
export async function setChangeRequest(id: string, request: { text: string; by: string } | null) {
  const { data, error } = await createAdminClient()
    .from("events")
    .update({ change_request: request?.text ?? null, change_requested_by: request?.by ?? null, change_requested_at: request ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn’t save the request: ${error.message}`);
  return data.length > 0;
}
