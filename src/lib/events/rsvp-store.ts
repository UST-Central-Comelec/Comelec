import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizeRsvpDefinition, type RsvpResponse, type RsvpSettings } from "./rsvp";
const unavailable = "RSVP is unavailable. Apply supabase/migrations/0055_event_rsvp.sql, 0056_event_rsvp_committees.sql, 0057_event_form_editors.sql, and 0058_event_form_authentication.sql.";
export async function getRsvpSettings(eventId: string): Promise<RsvpSettings | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createAdminClient().from("event_rsvp_forms").select("enabled,invitation_token,committee_limit,definition,require_google").eq("event_id", eventId).maybeSingle();
  if (error) throw new Error(unavailable);
  // Forms saved with the old locked steps open as the editable default questions.
  return data && { ...data, definition: normalizeRsvpDefinition(data.definition) };
}
export async function listRsvpResponses(eventId: string): Promise<RsvpResponse[]> {
  if (!isSupabaseConfigured()) return [];
  const rows: RsvpResponse[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createAdminClient().from("event_rsvp_responses").select("id,answers,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (error) throw new Error(unavailable);
    rows.push(...data as RsvpResponse[]);
    if (data.length < 1000) return rows;
  }
}
export function validRsvpToken(token: string | undefined) { return Boolean(token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)); }

/** Called after event editor authorization; omit the invitation token to keep existing links stable. */
export async function writeRsvpSettings(eventId: string, enabled: boolean, committeeLimit?: number, requireGoogle?: boolean) {
  const { error } = await createAdminClient().from("event_rsvp_forms").upsert({ event_id: eventId, enabled, ...(requireGoogle !== undefined ? { require_google: requireGoogle } : {}), ...(committeeLimit !== undefined ? { committee_limit: committeeLimit } : {}), updated_at: new Date().toISOString() }, { onConflict: "event_id" });
  if (error) throw new Error(unavailable);
}

export async function writeRsvpDefinition(eventId: string, definition: import("./form-editor").EditorDefinition, committeeLimit?: number) {
  const { error } = await createAdminClient().from("event_rsvp_forms").upsert({ event_id: eventId, definition, ...(committeeLimit !== undefined ? { committee_limit: committeeLimit } : {}), updated_at: new Date().toISOString() }, { onConflict: "event_id" });
  if (error) throw new Error(unavailable);
}
