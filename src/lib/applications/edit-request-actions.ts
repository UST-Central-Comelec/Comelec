"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { canSeeCollege, requireEditor } from "@/lib/auth/session";
import { getAccessRequest } from "@/lib/access-requests/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { canDecideRequest } from "@/lib/portal/account-scope";
import { getApplication } from "./admin";
import { submissionEditColumn, type SubmissionEditKind, type SubmissionEditRequest } from "./edit-requests";

export async function addressSubmissionEdit(kind: SubmissionEditKind, requestId: string): Promise<{ error?: string; saved?: boolean }> {
  if (kind !== "application" && kind !== "access") return { error: "Choose a valid submission type." };
  const user = await requireEditor(kind === "application" ? "recruitment/applications" : "accounts");
  try {
    const client = createAdminClient();
    const { data, error } = await client.from("submission_edit_requests").select("*").eq("id", requestId).eq("status", "pending").maybeSingle();
    if (error || !data) return { error: "Couldn’t load this edit request. Reload and try again." };
    const request = data as SubmissionEditRequest;
    const targetId = request[submissionEditColumn(kind)];
    if (!targetId) return { error: "This request belongs to another submission type." };
    const target = kind === "application" ? await getApplication(targetId) : await getAccessRequest(targetId);
    const allowed = target && (kind === "application" ? canSeeCollege(user, target.college) : "affiliation" in target && canDecideRequest(user, target));
    if (!allowed) return { error: "You don’t have permission to address this edit request." };
    const result = await client.from("submission_edit_requests").update({ status: "addressed", addressed_at: new Date().toISOString(), addressed_by: user.email }).eq("id", requestId).eq(submissionEditColumn(kind), targetId).eq("status", "pending").select("id");
    if (result.error || !result.data?.length) return { error: "Couldn’t address this request. Reload and try again." };
    revalidatePath(kind === "application" ? "/portal/recruitment/applications" : "/portal/accounts");
    return { saved: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Couldn’t address this request. Try again." };
  }
}
