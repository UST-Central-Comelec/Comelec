import "server-only";

import { retentionCutoff, yearLevels } from "@/lib/applications/options";
import { isAffiliation, isCommissionerPosition, type Affiliation, type CommissionerPosition } from "@/lib/data/types";
import { createAdminClient } from "@/lib/supabase/server";

// Reading and deciding portal access requests (supabase/migrations/0016_access_requests.sql).

export type AccessRequestStatus = "pending" | "approved" | "declined";

export type AccessRequest = {
  id: string;
  referenceCode: string;
  /** "JUAN P. DELA CRUZ": names are saved in capitals, as on the application form. */
  name: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  email: string;
  studentNumber: string;
  contactNumber: string | null;
  /** Where they said they serve. Central before supabase/migrations/0017. */
  affiliation: Affiliation;
  /** The position they said they hold. Null on requests sent before supabase/migrations/0021. */
  position: CommissionerPosition | null;
  /** Their role: one from the list since 0021, their own words before. */
  role: string;
  college: string;
  program: string;
  yearLevel: string;
  facebookUrl: string | null;
  status: AccessRequestStatus;
  submittedAt: string;
};

const columns = "*";

type Row = { id: string; reference_code: string; first_name: string; middle_initial: string; last_name: string; email: string; student_number: string; contact_number: string | null; position: string; account_position?: string | null; facebook_url?: string | null; affiliation?: string; college: string; program: string; year_level: string; status: AccessRequestStatus; created_at: string };

function toRequest(row: Row): AccessRequest {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    name: `${row.first_name} ${row.middle_initial}. ${row.last_name}`,
    lastName: row.last_name,
    firstName: row.first_name,
    middleInitial: row.middle_initial,
    email: row.email,
    studentNumber: row.student_number,
    contactNumber: row.contact_number,
    affiliation: isAffiliation(row.affiliation) ? row.affiliation : "central",
    position: isCommissionerPosition(row.account_position) ? row.account_position : null,
    role: row.position,
    college: row.college,
    program: row.program,
    facebookUrl: row.facebook_url ?? null,
    yearLevel: yearLevels[row.year_level as keyof typeof yearLevels] ?? row.year_level,
    status: row.status,
    submittedAt: row.created_at,
  };
}

/** Requests waiting to be decided, oldest first. */
export async function listPendingAccessRequests() {
  const { data, error } = await createAdminClient().from("access_requests").select(columns).eq("status", "pending").gte("created_at", retentionCutoff()).order("created_at");
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toRequest);
}

export async function getAccessRequest(id: string) {
  const { data, error } = await createAdminClient().from("access_requests").select(columns).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRequest(data as Row) : null;
}

/** Approves or declines a pending request. False if it was already decided (or deleted). */
export async function decideAccessRequest(id: string, status: Exclude<AccessRequestStatus, "pending">, decidedBy: string) {
  const { data, error } = await createAdminClient()
    .from("access_requests")
    .update({ status, decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}

/** Track lookup: the reference must match together with the student number or surname. */
export async function findAccessRequest(referenceCode: string, identity: string, isStudentNumber = true) {
  const query = createAdminClient()
    .from("access_requests")
    .select(columns)
    .eq("reference_code", referenceCode)
    .gte("created_at", retentionCutoff());
  const pattern = identity.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await (isStudentNumber ? query.eq("student_number", identity) : query.ilike("last_name", pattern)).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRequest(data as Row) : null;
}
