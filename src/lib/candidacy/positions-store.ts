import "server-only";

import { colleges } from "@/lib/applications/options";
import { createAdminClient } from "@/lib/supabase/server";
import { defaultElectivePositions, electivePositionsSchema, type ElectivePosition, type ElectivePositions } from "./positions";

// public.elective_positions: each unit's saved list, or the default Executive Board while it has none.

export type LoadedPositions = { positions: ElectivePositions; stamps: Record<string, string>; error: string | null };

/** Every unit's elective positions: the Central Student Council's and each Local Comelec's. */
export async function loadElectivePositions(): Promise<LoadedPositions> {
  const units = ["", ...colleges];
  const positions: ElectivePositions = Object.fromEntries(units.map((unit) => [unit, defaultElectivePositions()]));
  const stamps: Record<string, string> = {};
  const { data, error } = await createAdminClient().from("elective_positions").select("unit, positions, updated_at");
  if (error) return { positions, stamps, error: "Couldn’t load the elective positions. Apply supabase/migrations/20261017210000_candidacy_filing.sql, then reload." };
  for (const row of data ?? []) {
    const parsed = electivePositionsSchema.safeParse(row.positions);
    if (!parsed.success || !units.includes(row.unit as string)) continue;
    positions[row.unit as string] = parsed.data;
    stamps[row.unit as string] = row.updated_at as string;
  }
  return { positions, stamps, error: null };
}

/** The positions a unit's candidates can run for, by name. */
export async function positionsForUnit(unit: string): Promise<string[]> {
  return ((await loadElectivePositions()).positions[unit] ?? []).map((position) => position.name);
}

/**
 * Saves a unit's list over the version the editor loaded (`expected`, its last save; null if it had
 * none). Saves nothing when someone saved in between.
 */
export async function saveElectivePositions(unit: string, positions: ElectivePosition[], expected: string | null, actor: string): Promise<{ ok: true; stamp: string } | { conflict: true }> {
  const client = createAdminClient();
  const now = new Date().toISOString();
  if (expected === null) {
    const { data, error } = await client.from("elective_positions").insert({ unit, positions, updated_at: now, updated_by: actor }).select("updated_at").maybeSingle();
    if (error?.code === "23505") return { conflict: true };
    if (error) throw new Error(`Couldn’t save the positions: ${error.message}`);
    return { ok: true, stamp: data!.updated_at as string };
  }
  const { data, error } = await client.from("elective_positions").update({ positions, updated_at: now, updated_by: actor }).eq("unit", unit).eq("updated_at", expected).select("updated_at").maybeSingle();
  if (error) throw new Error(`Couldn’t save the positions: ${error.message}`);
  return data ? { ok: true, stamp: data.updated_at as string } : { conflict: true };
}
