import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { editableLevels, isTabKey, type AccessOverrides, type EditableLevel, type TabOverrides } from "./access";

// Reads and saves public.portal_access (supabase/migrations/0021): each level's changes from the
// default access in ./access.ts, set under Accounts → Access Control.

export type SavedAccess = { overrides: AccessOverrides; updated: Partial<Record<EditableLevel, { at: string; by: string }>> };

const isEditableLevel = (value: unknown): value is EditableLevel => (editableLevels as readonly unknown[]).includes(value);

/** Only tabs that still exist, switched on or off: a tab removed from the portal is dropped. */
function readOverrides(value: unknown): TabOverrides {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([key, on]) => isTabKey(key) && typeof on === "boolean"));
}

export async function getSavedAccess(): Promise<SavedAccess> {
  const saved: SavedAccess = { overrides: {}, updated: {} };
  if (!isSupabaseConfigured()) return saved;

  const { data, error } = await createAdminClient().from("portal_access").select("*");
  if (error) throw new Error(`Couldn’t load the access control: ${error.message}`);

  for (const row of data) {
    const level: unknown = row.level;
    if (!isEditableLevel(level)) continue;
    saved.overrides[level] = readOverrides(row.overrides);
    saved.updated[level] = { at: row.updated_at as string, by: row.updated_by as string };
  }
  return saved;
}

/**
 * For the access check on every request: until the migration is run, and whenever the settings
 * can't be read, everyone gets their level's defaults rather than being locked out.
 */
export async function getAccessOverrides(): Promise<AccessOverrides> {
  try {
    return (await getSavedAccess()).overrides;
  } catch (error) {
    // Said once, not on every request.
    if (!warned) console.error(error instanceof Error ? error.message : error);
    warned = true;
    return {};
  }
}

let warned = false;

export async function saveAccess(level: EditableLevel, overrides: TabOverrides, author: string) {
  const { error } = await createAdminClient().from("portal_access").upsert({ level, overrides, updated_at: new Date().toISOString(), updated_by: author }, { onConflict: "level" });
  if (error) throw new Error(error.message);
}
