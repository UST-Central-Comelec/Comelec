import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { describeSlot, type InterviewMode } from "./interview-format";
import { preferredBodies, retentionCutoff, yearLevels } from "./options";

// Applications as the portal sees them: everything the applicant sent, including contact details.
// Stored in public.applications (supabase/migrations/0004 and 0005).

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
  contactNumber: string;
  facebookUrl: string;
  college: string;
  program: string;
  yearLevel: string;
  preferredBody: string;
  division: string;
  position: string;
  positionId: string;
  cvUrl: string;
  endorsementUrl: string | null;
  portfolioUrl: string | null;
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
    contactNumber: value("contact_number"),
    facebookUrl: value("facebook_url"),
    college: value("college"),
    program: value("program"),
    yearLevel: yearLevels[value("year_level") as keyof typeof yearLevels] ?? value("year_level"),
    preferredBody: preferredBodies[value("preferred_body") as keyof typeof preferredBodies] ?? value("preferred_body"),
    division: value("division"),
    position: value("position"),
    positionId: value("position_id"),
    cvUrl: value("cv_url"),
    endorsementUrl: (row.endorsement_url as string | null) ?? null,
    portfolioUrl: (row.portfolio_url as string | null) ?? null,
    interview: interviewOf(row.interview_slots),
    status: isApplicationStatus(row.status) ? row.status : "pending",
    statusUpdatedAt: (row.status_updated_at as string | null) ?? null,
    statusUpdatedBy: (row.status_updated_by as string | null) ?? null,
    submittedAt: value("created_at"),
  };
}

/** Newest first, optionally only one status. */
export async function listApplications(status?: ApplicationStatus): Promise<ApplicationRecord[]> {
  if (!isSupabaseConfigured()) return [];
  // Past the retention period an application is treated as deleted, even before the nightly job runs.
  let query = createAdminClient().from("applications").select(withInterview).gte("created_at", retentionCutoff()).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
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
