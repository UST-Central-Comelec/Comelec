import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { retentionCutoff } from "./options";

export type SubmissionEditKind = "application" | "access";
export type SubmissionEditRequest = {
  id: string; application_id: string | null; access_request_id: string | null;
  requested_changes: string; status: "pending" | "addressed"; created_at: string;
  addressed_at: string | null; addressed_by: string | null;
};
export type EditRequestSubject = { id: string; reference_code: string; first_name: string; last_name: string; college: string; affiliation?: "central" | "local" };
export type SubmissionEditReview = SubmissionEditRequest & { subject: EditRequestSubject };
const unavailable = "Couldn’t load edit requests. Apply supabase/migrations/0080_submission_edit_requests.sql and try again.";
export const submissionEditColumn = (kind: SubmissionEditKind) => kind === "application" ? "application_id" : "access_request_id";

/** Uses the same reference, identity and retention rules as public application tracking. */
export async function findTrackedApplicationId(reference: string, identity: string, isStudentNumber: boolean): Promise<string | null> {
  const query = createAdminClient().from("applications").select("id").eq("reference_code", reference).gte("created_at", retentionCutoff());
  const pattern = identity.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await (isStudentNumber ? query.eq("student_number", identity) : query.ilike("last_name", pattern)).maybeSingle();
  if (error) throw new Error("Couldn’t verify this application.");
  return data?.id ?? null;
}

/** Call only after matching the submission’s tracking identity. */
export async function pendingSubmissionEditRequest(kind: SubmissionEditKind, id: string): Promise<SubmissionEditRequest | null> {
  const { data, error } = await createAdminClient().from("submission_edit_requests").select("*").eq(submissionEditColumn(kind), id).eq("status", "pending").maybeSingle();
  if (error) throw new Error(unavailable);
  return data as SubmissionEditRequest | null;
}

/** Server pages must filter the returned subjects through their existing unit access rules. */
export async function listSubmissionEditReviews(kind: SubmissionEditKind): Promise<SubmissionEditReview[]> {
  if (!isSupabaseConfigured()) return [];
  const relation = kind === "application" ? "applications" : "access_requests";
  const fields = `id,reference_code,first_name,last_name,college${kind === "access" ? ",affiliation" : ""}`;
  const reviews: SubmissionEditReview[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createAdminClient().from("submission_edit_requests").select(`*,subject:${relation}!inner(${fields})`).not(submissionEditColumn(kind), "is", null).gte("subject.created_at", retentionCutoff()).eq("status", "pending").order("created_at").order("id").range(offset, offset + 999);
    if (error) throw new Error(unavailable);
    reviews.push(...(data as unknown as SubmissionEditReview[]).filter(request => request.subject));
    if (data.length < 1000) return reviews;
  }
}
