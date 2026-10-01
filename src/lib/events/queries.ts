import "server-only";

import { store } from "@/lib/data/store";
import { createAdminClient } from "@/lib/supabase/server";
import type { CommissionEvent } from "./options";

// Events as the website and the portal read them, from public.events
// (supabase/migrations/0019_events.sql) through the content store.

/** Postgres hands times back as "13:00:00"; the app works in "13:00". */
const hoursAndMinutes = (time: string | null | undefined) => (time ? time.slice(0, 5) : null);

function normalize(event: CommissionEvent): CommissionEvent {
  return {
    ...event,
    background: event.background ?? "",
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
