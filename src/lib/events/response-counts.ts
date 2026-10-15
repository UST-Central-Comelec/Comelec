import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type EventResponseCounts = { rsvp: number; evaluation: number };

/** Read totals without loading respondent identities or answer records. */
export async function getEventResponseCounts(eventId: string): Promise<EventResponseCounts> {
  if (!isSupabaseConfigured()) return { rsvp: 0, evaluation: 0 };
  const client = createAdminClient();
  const [rsvp, evaluation] = await Promise.all([
    client.from("event_rsvp_responses").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    client.from("event_evaluation_responses").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  if (rsvp.error || evaluation.error || rsvp.count === null || evaluation.count === null) throw new Error("Couldn’t load the evaluation tracker. Reload the page and try again.");
  return { rsvp: rsvp.count, evaluation: evaluation.count };
}
