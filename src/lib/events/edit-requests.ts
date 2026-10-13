import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type EventEditRequest = {
  id: string; event_id: string; registration_id: string | null; rsvp_response_id: string | null;
  requested_changes: string; status: "pending" | "addressed" | "accepted" | "declined"; created_at: string;
  addressed_at: string | null; addressed_by: string | null;
};
const unavailable = "Couldn’t load edit requests. Apply supabase/migrations/0079_event_response_edit_requests.sql and try again.";

/** Call only after authorizing the event’s participant reader. */
export async function listEventEditRequests(eventId: string): Promise<EventEditRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const requests: EventEditRequest[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createAdminClient().from("event_response_edit_requests").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (error) throw new Error(unavailable);
    requests.push(...data as EventEditRequest[]);
    if (data.length < 1000) return requests;
  }
}

/** The caller has already matched this submission’s reference and surname. */
export async function pendingEventEditRequest(kind: "registration" | "rsvp", id: string): Promise<EventEditRequest | null> {
  const { data, error } = await createAdminClient().from("event_response_edit_requests").select("*").eq(kind === "rsvp" ? "rsvp_response_id" : "registration_id", id).eq("status", "pending").maybeSingle();
  if (error) throw new Error(unavailable);
  return data as EventEditRequest | null;
}
