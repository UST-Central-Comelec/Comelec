import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { positions, type SlotCounts } from "./options";

// Open slots per position, set by commissioners in the portal (Recruitment → Slots) and shown on /apply.
// Stored in public.recruitment_slots (supabase/migrations/0004_applications.sql).

/** Used before Supabase is set up, and for positions with no saved row yet. */
const DEFAULT_SLOTS = 0;

export async function getSlots(): Promise<SlotCounts> {
  const counts: SlotCounts = Object.fromEntries(positions.map((position) => [position.id, DEFAULT_SLOTS]));
  if (!isSupabaseConfigured()) return counts;

  const { data, error } = await createAdminClient().from("recruitment_slots").select("position_id, slots");
  if (error) throw new Error(`Couldn’t load recruitment slots: ${error.message}`);
  for (const row of data) if (row.position_id in counts) counts[row.position_id as string] = row.slots as number;
  return counts;
}

/** Saves only the positions in `counts`; the rest keep their current value. */
export async function saveSlots(counts: SlotCounts, author: string) {
  const now = new Date().toISOString();
  const rows = Object.entries(counts).map(([positionId, slots]) => ({ position_id: positionId, slots, updated_at: now, updated_by: author }));
  if (!rows.length) return;
  const { error } = await createAdminClient().from("recruitment_slots").upsert(rows, { onConflict: "position_id" });
  if (error) throw new Error(`Couldn’t save recruitment slots: ${error.message}`);
}
