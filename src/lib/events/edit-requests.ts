import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type EventEditRequest = {
  id: string; event_id: string; registration_id: string | null; rsvp_response_id: string | null;
  requested_changes: string; status: "pending" | "addressed" | "accepted" | "declined"; created_at: string;
  addressed_at: string | null; addressed_by: string | null;
  /** Set when the request is accepted: the private link to edit the response. */
  edit_token?: string | null;
  /** When the response was sent again through that link, which then stops working. */
  edited_at?: string | null;
};
export type EditLinkKind = "registration" | "rsvp";

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

/** The page the edit link opens: the same form, prefilled, under the same reference. */
export const editLinkPath = (request: Pick<EventEditRequest, "event_id" | "rsvp_response_id" | "edit_token">) =>
  `/events/${request.event_id}/${request.rsvp_response_id ? "rsvp-form" : "register"}?edit=${request.edit_token}`;

/** An accepted request whose link hasn't been used yet. */
export const hasOpenEditLink = (request: EventEditRequest | null | undefined) => Boolean(request?.status === "accepted" && request.edit_token && !request.edited_at);

/**
 * What tracking shows: a request still waiting, or an accepted one whose link hasn't been used.
 * The caller has already matched this submission’s reference and surname.
 */
export async function openEventEditRequest(kind: EditLinkKind, id: string): Promise<EventEditRequest | null> {
  const pending = await pendingEventEditRequest(kind, id);
  if (pending) return pending;
  const { data, error } = await createAdminClient().from("event_response_edit_requests").select("*").eq(kind === "rsvp" ? "rsvp_response_id" : "registration_id", id).eq("status", "accepted").not("edit_token", "is", null).is("edited_at", null).order("addressed_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(unavailable);
  return data as EventEditRequest | null;
}

/** The accepted, unused request behind an edit link for this event and form, or null. */
export async function findEditLink(eventId: string, kind: EditLinkKind, token: string | undefined): Promise<EventEditRequest | null> {
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;
  const { data, error } = await createAdminClient().from("event_response_edit_requests").select("*").eq("edit_token", token).eq("event_id", eventId).maybeSingle();
  if (error) throw new Error(unavailable);
  const request = data as EventEditRequest | null;
  if (!request || !hasOpenEditLink(request)) return null;
  return (kind === "rsvp" ? request.rsvp_response_id : request.registration_id) ? request : null;
}

/** Marks the link used, once. False when it was already used or isn't open any more. */
export async function claimEditLink(requestId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("event_response_edit_requests").update({ edited_at: new Date().toISOString() }).eq("id", requestId).eq("status", "accepted").is("edited_at", null).select("id");
  if (error) throw new Error(unavailable);
  return data.length > 0;
}

/** Opens the link again when saving the response failed after claiming it. */
export async function releaseEditLink(requestId: string) {
  await createAdminClient().from("event_response_edit_requests").update({ edited_at: null }).eq("id", requestId);
}

/** The caller has already matched this submission’s reference and surname. */
export async function pendingEventEditRequest(kind: "registration" | "rsvp", id: string): Promise<EventEditRequest | null> {
  const { data, error } = await createAdminClient().from("event_response_edit_requests").select("*").eq(kind === "rsvp" ? "rsvp_response_id" : "registration_id", id).eq("status", "pending").maybeSingle();
  if (error) throw new Error(unavailable);
  return data as EventEditRequest | null;
}
