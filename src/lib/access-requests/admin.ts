import "server-only";

import { retentionCutoff, yearLevels } from "@/lib/applications/options";
import { isAffiliation, isCommissionerPosition, type Affiliation, type CommissionerPosition } from "@/lib/data/types";
import { readDeclarations, type Declaration } from "@/lib/onboarding/documents";
import { createAdminClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/data/accounts";

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
  /** Empty for requests sent before full middle names were collected. */
  middleName: string;
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
  /** The year level's key ("1", "g11"), as accounts keep it. */
  yearLevelKey: string;
  facebookUrl: string | null;
  /** The onboarding documents they accepted, with when. Empty on requests sent before supabase/migrations/0074. */
  declarations: Declaration[];
  status: AccessRequestStatus;
  submittedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

const columns = "*";

type Row = { id: string; reference_code: string; first_name: string; middle_initial: string; middle_name?: string | null; last_name: string; email: string; student_number: string; contact_number: string | null; position: string; account_position?: string | null; facebook_url?: string | null; affiliation?: string; college: string; program: string; year_level: string; declarations?: unknown; status: AccessRequestStatus; created_at: string; decided_at?: string | null; decided_by?: string | null };

function toRequest(row: Row): AccessRequest {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    name: fullName({ firstName: row.first_name, middleName: row.middle_name ?? "", middleInitial: row.middle_initial, lastName: row.last_name }),
    lastName: row.last_name,
    firstName: row.first_name,
    middleInitial: row.middle_initial,
    middleName: row.middle_name ?? "",
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
    yearLevelKey: row.year_level,
    declarations: readDeclarations(row.declarations),
    status: row.status,
    submittedAt: row.created_at,
    decidedAt: row.decided_at ?? null,
    decidedBy: row.decided_by ?? null,
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

/** Approved requests remain trackable as official records; other requests have the 60-day limit. */
export async function findAccessRequest(referenceCode: string, identity: string, isStudentNumber = true) {
  const query = createAdminClient()
    .from("access_requests")
    .select(columns)
    .eq("reference_code", referenceCode)
    .or(`status.eq.approved,created_at.gte.${retentionCutoff()}`);
  const pattern = identity.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await (isStudentNumber ? query.eq("student_number", identity) : query.ilike("last_name", pattern)).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRequest(data as Row) : null;
}
