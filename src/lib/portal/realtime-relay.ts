import "server-only";

import { supabaseSecretKey, supabaseUrl } from "@/lib/supabase/config";
import type { RelayEvent } from "./presence";

/**
 * Pushes `event` to each inbox through Supabase Realtime's broadcast API. Nothing is stored: a
 * browser that isn't listening at that moment never gets it.
 */
export async function broadcast(topics: string[], event: RelayEvent) {
  const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { apikey: supabaseSecretKey(), "Content-Type": "application/json" },
    // The inboxes are private channels (migration 0077); a public send wouldn't reach them.
    body: JSON.stringify({ messages: topics.map((topic) => ({ topic, event: "relay", payload: event, private: true })) }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Realtime refused the message (${response.status}): ${await response.text()}`);
}
