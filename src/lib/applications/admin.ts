import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { describeSlot, type InterviewMode } from "./interview-format";
import { isConflictId, preferredBodies, retentionCutoff, yearLevels, type DeclaredConflict } from "./options";

export type PreferredBody = keyof typeof preferredBodies;

// Applications as the portal sees them: everything the applicant sent, including contact details.
// Stored in public.applications (supabase/migrations/0004, 0005, 0013 and 0014).

export const applicationStatuses = {
  pending: "Pending review",
  reviewing: "Under review",
  accepted: "Accepted",
  declined: "Rejected",
} as const;

export type ApplicationStatus = keyof typeof applicationStatuses;

/** portal-tag colour per status. */
export const statusTag: Record<ApplicationStatus, string> = { pending: "is-gold", reviewing: "is-gold", accepted: "is-ok", declined: "is-warn" };

export const isApplicationStatus = (value: unknown): value is ApplicationStatus => typeof value === "string" && value in applicationStatuses;

export type ApplicationRecord = {
  id: string;
  referenceCode: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  name: string;
  studentNumber: string;
  email: string;
  contactNumber: string | null;
  facebookUrl: string;
  college: string;
  program: string;
  yearLevel: string;
  preferredBody: string;
  /** "central" or "local": which body they want to serve in. */
  preferredBodyId: string;
  division: string;
  position: string;
  positionId: string;
  cvUrl: string;
  endorsementUrl: string | null;
  portfolioUrl: string | null;
  /** Conflicts the applicant pledged to resolve. Null when they applied before the form asked. */
  conflicts: DeclaredConflict[] | null;
  interview: string | null;
  status: ApplicationStatus;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  submittedAt: string;
};

type Row = Record<string, unknown>;

const withInterview = "*, interview_slots(starts_at, duration_minutes, mode, location)";

function interviewOf(slot: unknown) {
  const row = (Array.isArray(slot) ? slot[0] : slot) as { starts_at: string; duration_minutes: number; mode: InterviewMode; location: string | null } | null | undefined;
  return row ? describeSlot({ startsAt: row.starts_at, durationMinutes: row.duration_minutes, mode: row.mode, location: row.location }) : null;
}

function conflictsOf(value: unknown): DeclaredConflict[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item) => isConflictId(item?.type)).map((item) => ({ type: item.type, detail: typeof item.detail === "string" ? item.detail : "" }));
}

function toRecord(row: Row): ApplicationRecord {
  const value = (key: string) => (row[key] ?? "") as string;
  return {
    id: value("id"),
    referenceCode: value("reference_code"),
    lastName: value("last_name"),
    firstName: value("first_name"),
    middleInitial: value("middle_initial"),
    name: `${value("first_name")} ${value("middle_initial")}. ${value("last_name")}`,
    studentNumber: value("student_number"),
    email: value("email"),
    contactNumber: (row.contact_number as string | null) || null,
    facebookUrl: value("facebook_url"),
    college: value("college"),
    program: value("program"),
    yearLevel: yearLevels[value("year_level") as keyof typeof yearLevels] ?? value("year_level"),
    preferredBody: preferredBodies[value("preferred_body") as keyof typeof preferredBodies] ?? value("preferred_body"),
    preferredBodyId: value("preferred_body"),
    division: value("division"),
    position: value("position"),
    positionId: value("position_id"),
    cvUrl: value("cv_url"),
    endorsementUrl: (row.endorsement_url as string | null) ?? null,
    portfolioUrl: (row.portfolio_url as string | null) ?? null,
    conflicts: conflictsOf(row.conflicts),
    interview: interviewOf(row.interview_slots),
    status: isApplicationStatus(row.status) ? row.status : "pending",
    statusUpdatedAt: (row.status_updated_at as string | null) ?? null,
    statusUpdatedBy: (row.status_updated_by as string | null) ?? null,
    submittedAt: value("created_at"),
  };
}

/**
 * Newest first. Optionally only one status, only applicants who want to serve in one body
 * (Central or Local Comelec), or only one college's applicants (what a Local account sees).
 */
export async function listApplications({ status, body, college }: { status?: ApplicationStatus; body?: PreferredBody; college?: string } = {}): Promise<ApplicationRecord[]> {
  if (!isSupabaseConfigured()) return [];
  // Past the retention period an application is treated as deleted, even before the nightly job runs.
  let query = createAdminClient().from("applications").select(withInterview).gte("created_at", retentionCutoff()).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (body) query = query.eq("preferred_body", body);
  if (college !== undefined) query = query.eq("college", college);
  const { data, error } = await query;
  if (error) throw new Error(`Couldn’t load applications: ${error.message}`);
  return data.map(toRecord);
}

export async function getApplication(id: string): Promise<ApplicationRecord | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createAdminClient().from("applications").select(withInterview).eq("id", id).gte("created_at", retentionCutoff()).maybeSingle();
  if (error) throw new Error(`Couldn’t load the application: ${error.message}`);
  return data ? toRecord(data) : null;
}

/**
 * Accepting takes one of the position's recruitment slots and un-accepting gives it back, in the
 * database (supabase/migrations/0009_automatic_slot_counts.sql). Returns false when accepting was
 * refused because the position has no slots left.
 */
export async function setApplicationStatus(id: string, status: ApplicationStatus, author: string) {
  const { error } = await createAdminClient()
    .from("applications")
    .update({ status, status_updated_at: new Date().toISOString(), status_updated_by: author })
    .eq("id", id);
  if (error?.message.includes("recruitment_slots_full")) return false;
  if (error) throw new Error(`Couldn’t update the application: ${error.message}`);
  return true;
}

/**
 * Deletes an application before its 60 days are up, as the nightly job would. Its interview place
 * frees up with it; an accepted applicant's slot stays taken, as with the nightly job (0009).
 */
export async function deleteApplication(id: string) {
  const { error } = await createAdminClient().from("applications").delete().eq("id", id);
  if (error) throw new Error(`Couldn’t delete the application: ${error.message}`);
}
