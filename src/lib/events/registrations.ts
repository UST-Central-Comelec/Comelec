import "server-only";

import { yearLevels } from "@/lib/applications/options";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { sexes, type RegistrationKind, type Sex } from "./options";

// Who registered for an event, or joined its waitlist, with the answers they gave. Stored in
// public.event_registrations (supabase/migrations/0019_events.sql), one entry per email per event.

export type Registration = {
  id: string;
  eventId: string;
  status: RegistrationKind;
  lastName: string;
  firstName: string;
  /** Empty for someone without a middle name. */
  middleInitial: string;
  /** "JUAN P. DELA CRUZ". */
  name: string;
  studentNumber: string;
  email: string;
  sex: Sex;
  college: string;
  program: string;
  /** "2", "swis": what the form saves. */
  yearLevel: string;
  /** "2nd year", "SWIS". */
  yearLevelLabel: string;
  organizations: string[];
  /** 1 (not interested) to 5 (extremely interested). */
  interest: number;
  registeredAt: string;
};

type Row = {
  id: string;
  event_id: string;
  status: string;
  last_name: string;
  first_name: string;
  middle_initial: string | null;
  student_number: string;
  email: string;
  sex: string;
  college: string;
  program: string;
  year_level: string;
  organizations: string[] | null;
  interest: number;
  created_at: string;
};

/** "JUAN P. DELA CRUZ", or "JUAN DELA CRUZ" without a middle initial. */
export const fullName = (firstName: string, middleInitial: string, lastName: string) => [firstName, middleInitial && `${middleInitial}.`, lastName].filter(Boolean).join(" ");

function toRegistration(row: Row): Registration {
  const middleInitial = row.middle_initial ?? "";
  return {
    id: row.id,
    eventId: row.event_id,
    status: row.status === "waitlisted" ? "waitlisted" : "registered",
    lastName: row.last_name,
    firstName: row.first_name,
    middleInitial,
    name: fullName(row.first_name, middleInitial, row.last_name),
    studentNumber: row.student_number,
    email: row.email,
    sex: row.sex in sexes ? (row.sex as Sex) : "undisclosed",
    college: row.college,
    program: row.program,
    yearLevel: row.year_level,
    yearLevelLabel: yearLevels[row.year_level as keyof typeof yearLevels] ?? row.year_level,
    organizations: Array.isArray(row.organizations) ? row.organizations : [],
    interest: row.interest,
    registeredAt: row.created_at,
  };
}

/** Supabase returns at most this many rows per request, so longer lists are read a page at a time. */
const PAGE = 1000;
/** A ceiling on those pages, far past any event the commission runs. */
const MAX_PAGES = 20;

/** Everyone who registered for an event or joined its waitlist, newest first. */
export async function listRegistrations(eventId: string): Promise<Registration[]> {
  if (!isSupabaseConfigured()) return [];
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await createAdminClient()
      .from("event_registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`Couldn’t load the registrations: ${error.message}`);
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return rows.map(toRegistration);
}

export type RegistrationCounts = { registered: number; waitlisted: number };

/** Registered and waitlisted per event id, for the portal's Events list. Events with nobody yet are left out. */
export async function countRegistrations(): Promise<Record<string, RegistrationCounts>> {
  if (!isSupabaseConfigured()) return {};
  const { data, error } = await createAdminClient().from("event_registration_counts").select("event_id, registered, waitlisted");
  if (error) throw new Error(`Couldn’t count the registrations: ${error.message}`);
  return Object.fromEntries(data.map((row) => [row.event_id as string, { registered: Number(row.registered) || 0, waitlisted: Number(row.waitlisted) || 0 }]));
}

/** The entry this email already has for an event, if any. */
export async function findRegistration(eventId: string, email: string): Promise<Registration | null> {
  const { data, error } = await createAdminClient().from("event_registrations").select("*").eq("event_id", eventId).eq("email", email).maybeSingle();
  if (error) throw new Error(`Couldn’t look up the registration: ${error.message}`);
  return data ? toRegistration(data as Row) : null;
}

export async function getRegistration(id: string): Promise<Registration | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createAdminClient().from("event_registrations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn’t load the registration: ${error.message}`);
  return data ? toRegistration(data as Row) : null;
}

export async function deleteRegistration(id: string) {
  const { error } = await createAdminClient().from("event_registrations").delete().eq("id", id);
  if (error) throw new Error(`Couldn’t remove the registration: ${error.message}`);
}
