import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { affiliationChoices, isRequestKind, requestStatuses, sexes, type AffiliationChoice, type AttendingChoice, type RegistrationKind, type RequestEntry, type Requests, type Sex } from "./options";

// Who registered for an event, or joined its waitlist, with the answers they gave. Stored in
// public.event_registrations (supabase/migrations/0019_events.sql), one entry per email per event.

export type Registration = {
  id: string;
  referenceCode: string;
  eventId: string;
  status: RegistrationKind;
  lastName: string;
  firstName: string;
  /** Empty for someone without a middle name. Registrations before 0029 have only its initial. */
  middleName: string;
  /** "JUAN PEDRO DELA CRUZ". */
  name: string;
  email: string;
  /** The email was verified through UST Google sign-in. */
  verified: boolean;
  sex: Sex;
  age: number | null;
  affiliation: AffiliationChoice;
  /** A UST student's. */
  college: string | null;
  program: string | null;
  yearLevel: string | null;
  /** UST faculty or staff: their college, faculty or office. */
  office: string | null;
  /** Another institution, or what an independent participant gave (often N/A). */
  institution: string | null;
  attendingAs: AttendingChoice;
  organizationName: string | null;
  organizationCommittee: string | null;
  organizationPosition: string | null;
  requests: Requests;
  registeredAt: string;
  studentNumber: string | null;
  attendanceConfirmedAt: string | null;
};

type Row = {
  id: string;
  reference_code: string;
  event_id: string;
  status: string;
  last_name: string;
  first_name: string;
  middle_initial: string | null;
  middle_name?: string | null;
  email: string;
  verified?: boolean | null;
  sex: string;
  age?: number | null;
  affiliation?: string | null;
  college: string | null;
  program: string | null;
  year_level: string | null;
  office?: string | null;
  institution?: string | null;
  attending_as?: string | null;
  organization_name?: string | null;
  organization_committee?: string | null;
  organization_position?: string | null;
  organizations?: string[] | null;
  requests?: unknown;
  created_at: string;
  student_number?: string | null;
  attendance_confirmed_at?: string | null;
};

/** "JUAN PEDRO DELA CRUZ", "JUAN P. DELA CRUZ" from an older registration's initial, or "JUAN DELA CRUZ". */
export const fullName = (firstName: string, middleName: string, lastName: string) => [firstName, middleName.length === 1 ? `${middleName}.` : middleName, lastName].filter(Boolean).join(" ");

/** Only the requests the form offers, each with an answer. */
function requestsOf(value: unknown): Requests {
  if (!value || typeof value !== "object") return {};
  const requests: Requests = {};
  for (const [kind, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!isRequestKind(kind) || !entry || typeof entry !== "object") continue;
    const item = entry as RequestEntry;
    requests[kind] = { ...item, status: item.status in requestStatuses ? item.status : "pending" };
  }
  return requests;
}

function toRegistration(row: Row): Registration {
  const middleName = row.middle_name || row.middle_initial || "";
  // Before 0029 only UST students registered, and someone in an organization listed it.
  const legacyOrganization = row.organizations?.[0] ?? null;
  return {
    id: row.id,
    referenceCode: row.reference_code,
    eventId: row.event_id,
    status: row.status === "waitlisted" ? "waitlisted" : "registered",
    lastName: row.last_name,
    firstName: row.first_name,
    middleName,
    name: fullName(row.first_name, middleName, row.last_name),
    email: row.email,
    verified: row.verified !== false,
    sex: row.sex in sexes ? (row.sex as Sex) : "undisclosed",
    age: typeof row.age === "number" ? row.age : null,
    affiliation: row.affiliation && row.affiliation in affiliationChoices ? (row.affiliation as AffiliationChoice) : "ust-student",
    college: row.college ?? null,
    program: row.program ?? null,
    yearLevel: row.year_level ?? null,
    office: row.office ?? null,
    institution: row.institution ?? null,
    attendingAs: row.attending_as === "representative" || (!row.attending_as && legacyOrganization) ? "representative" : "independent",
    organizationName: row.organization_name ?? legacyOrganization,
    organizationCommittee: row.organization_committee ?? null,
    organizationPosition: row.organization_position ?? null,
    requests: requestsOf(row.requests),
    registeredAt: row.created_at,
    studentNumber: row.student_number ?? null,
    attendanceConfirmedAt: row.attendance_confirmed_at ?? null,
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

/** A confirmed registration identified by its reference, scoped to the event being evaluated. */
export async function findEventRegistrationByReference(eventId: string, referenceCode: string): Promise<Registration | null> {
  const { data, error } = await createAdminClient().from("event_registrations").select("*").eq("event_id", eventId).eq("reference_code", referenceCode).eq("status", "registered").maybeSingle();
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

/** Records the unit's answer to one thing a registrant asked for. False when the registration or the request is gone. */
export async function setRequestStatuses(registration: Registration, statuses: Partial<Record<keyof Requests, RequestEntry["status"]>>) {
  const requests = { ...registration.requests };
  for (const [kind, status] of Object.entries(statuses) as Array<[keyof Requests, RequestEntry["status"]]>) {
    const current = requests[kind];
    if (current) requests[kind] = { ...current, status };
  }
  const { data, error } = await createAdminClient().from("event_registrations").update({ requests, updated_at: new Date().toISOString() }).eq("id", registration.id).select("id");
  if (error) throw new Error(`Couldn’t save the answer: ${error.message}`);
  return data.length > 0;
}

/** Public tracking requires both the public reference and an exact surname match. */
export async function findRegistrationByReference(referenceCode: string, lastNamePattern: string): Promise<Registration | null> {
  const { data, error } = await createAdminClient().from("event_registrations").select("*").eq("reference_code", referenceCode).ilike("last_name", lastNamePattern).maybeSingle();
  if (error) throw new Error(`Couldn’t track the registration: ${error.message}`);
  return data ? toRegistration(data as Row) : null;
}
