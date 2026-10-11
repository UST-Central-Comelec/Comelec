import "server-only";
import { canOpen, isLocal, type PortalUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { retentionCutoff } from "./options";

export async function getUnseenApplicantCount(user: PortalUser): Promise<number> {
  if (!canOpen(user, "recruitment/applications") || !isSupabaseConfigured()) return 0;
  if (isLocal(user) && !user.college) return 0;
  const client = createAdminClient();
  let count = 0;
  for (let offset = 0; ; offset += 1000) {
    let query = client.from("applications").select("id, portal_application_views(account_id)")
      .gte("created_at", retentionCutoff()).eq("portal_application_views.account_id", user.id)
      .order("id").range(offset, offset + 999);
    if (isLocal(user)) query = query.eq("college", user.college!);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    count += data.filter(row => !row.portal_application_views?.length).length;
    if (data.length < 1000) return count;
  }
}

export async function markApplicantsViewed(user: PortalUser, ids: string[]): Promise<void> {
  if (!canOpen(user, "recruitment/applications")) throw new Error("Access denied.");
  if (isLocal(user) && !user.college) return;
  if (!isSupabaseConfigured()) return;
  const client = createAdminClient();
  let query = client.from("applications").select("id").in("id", ids).gte("created_at", retentionCutoff());
  if (isLocal(user)) query = query.eq("college", user.college!);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data.length) return;
  const { error: saveError } = await client.from("portal_application_views").upsert(data.map(row => ({ application_id: row.id, account_id: user.id })), { onConflict: "application_id,account_id", ignoreDuplicates: true });
  if (saveError) throw new Error(saveError.message);
}
