import "server-only";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { applyReferenceData, composeReferenceData, defaultReferenceData, type ReferenceData, type SectionKey } from "./data";

export const REFERENCE_TAG = "reference-data";
export const referenceUnavailable = "Couldn’t load the Database. Apply supabase/migrations/20261015120000_reference_data.sql, then reload.";

export const referenceUnreachable = "Couldn’t reach the Database. Check the connection, then reload.";

type Row = { section: string; value: unknown; updatedAt: string };

const isMissing = (error: { code?: string; message: string }) => error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist/i.test(error.message);

// Shared between requests (and server instances, through Next's data cache) for a minute, and
// dropped the moment a section is saved. A failed read throws, so it isn't kept. Made on first use.
// A dropped connection is tried once more; only a missing table asks for the migration.
let readSections: (() => Promise<Row[]>) | null = null;
const cachedSections = () => (readSections ??= unstable_cache(async (): Promise<Row[]> => {
  const read = () => createAdminClient().from("reference_data").select("section,value,updated_at");
  let { data, error } = await read();
  if (error && !isMissing(error)) ({ data, error } = await read());
  if (error) throw new Error(isMissing(error) ? referenceUnavailable : referenceUnreachable, { cause: error });
  return (data ?? []).map((row) => ({ section: row.section as string, value: row.value, updatedAt: row.updated_at as string }));
}, [REFERENCE_TAG], { tags: [REFERENCE_TAG], revalidate: 60 }))();

/** The lists with every saved section, or the defaults while the table can't be read. */
export async function loadReferenceData(): Promise<{ data: ReferenceData; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: defaultReferenceData(), error: null };
  try {
    return { data: composeReferenceData(await cachedSections()), error: null };
  } catch (error) {
    return { data: defaultReferenceData(), error: error instanceof Error ? error.message : referenceUnreachable };
  }
}

export async function getReferenceData(): Promise<ReferenceData> {
  return (await loadReferenceData()).data;
}

/**
 * Puts the saved lists in place for this server before anything reads them. Every portal request
 * does it (getPortalUser in src/lib/auth/session.ts); so do the public pages and Server Actions that
 * check a college, program or position.
 */
export async function ensureReferenceData(): Promise<ReferenceData> {
  const { data, error } = await loadReferenceData();
  // A failed read keeps whatever lists are in place rather than going back to the defaults.
  if (!error) applyReferenceData(data);
  return data;
}

export type SaveOutcome = { ok: true; updatedAt: string } | { conflict: true } | { blocked: Array<{ name: string; count: number }> };

export type SaveChecks = {
  /** "" for the Central Comelec, else the college, whose accounts the roles below are looked for in. */
  unit: string;
  /** Roles held by accounts that change name with this save. */
  renames: Array<{ from: string; to: string }>;
  /** Roles this save removes: refused while an account in the unit holds one. */
  roles: string[];
  /** Colleges this save removes: refused while any account names one. */
  colleges: string[];
  /** Colleges whose Local Comelec this save switches off: refused while it has accounts. */
  units: string[];
  /** Programs renamed by this save: the college's accounts and pending access requests follow. */
  programRenames?: Array<{ from: string; to: string }>;
  /** Programs this save deletes: refused while an account in the college has one. */
  programs?: string[];
};

/**
 * Saves a section over the version the editor loaded (`expected`), renaming the roles accounts
 * hold to match. The database saves nothing when someone saved in between, or when something
 * removed is still in use.
 */
export async function writeReferenceSection(section: SectionKey, value: unknown, expected: string | null, actor: string, checks: SaveChecks): Promise<SaveOutcome> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before the Database can be saved.");
  const { data, error } = await createAdminClient().rpc("save_reference_section", {
    p_section: section,
    p_value: value,
    p_expected: expected,
    p_actor: actor,
    p_unit: checks.unit,
    p_renames: checks.renames.map(({ from, to }) => ({ from_name: from, to_name: to })),
    p_role_checks: checks.roles,
    p_college_checks: checks.colleges,
    p_unit_checks: checks.units,
    p_program_renames: (checks.programRenames ?? []).map(({ from, to }) => ({ from_name: from, to_name: to })),
    p_program_checks: checks.programs ?? [],
  });
  if (error || !data || typeof data !== "object") throw new Error(error?.message.includes("save_reference_section") ? referenceUnavailable : "Couldn’t save the Database. Try again.");
  const outcome = data as { ok?: boolean; updatedAt?: string; conflict?: boolean; blocked?: Array<{ name: string; count: number }> };
  if (outcome.conflict) return { conflict: true };
  if (outcome.blocked) return { blocked: outcome.blocked };
  // Every page reads these lists, so every page is rebuilt with the new ones.
  revalidateTag(REFERENCE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  return { ok: true, updatedAt: outcome.updatedAt! };
}

/** How many accounts have each program, by college and program name: for the Database to say who'd be affected. */
export async function programUsage(): Promise<Record<string, Record<string, number>>> {
  if (!isSupabaseConfigured()) return {};
  const { data, error } = await createAdminClient().from("portal_accounts").select("college,program").not("program", "is", null);
  if (error) return {};
  const usage: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    const college = row.college as string | null;
    const program = row.program as string | null;
    if (!college || !program) continue;
    usage[college] ??= {};
    usage[college][program] = (usage[college][program] ?? 0) + 1;
  }
  return usage;
}
