import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { defaultSecretariatSettings, secretariatSettingsSchema, settingsChanges, type SecretariatSettings, type SettingsRemoval } from "./settings";

export const settingsUnavailable = "Couldn’t load the Secretariat settings. Apply supabase/migrations/0068_secretariat_settings.sql, then reload.";
export type StoredSettings = { settings: SecretariatSettings; updatedAt: string | null; updatedBy: string | null };

/** The defaults stand until the settings are first saved. */
export async function getSecretariatSettings(): Promise<StoredSettings> {
  if (!isSupabaseConfigured()) return { settings: defaultSecretariatSettings, updatedAt: null, updatedBy: null };
  const { data, error } = await createAdminClient().from("secretariat_settings").select("value,updated_at,updated_by").maybeSingle();
  if (error) throw new Error(settingsUnavailable);
  if (!data) return { settings: defaultSecretariatSettings, updatedAt: null, updatedBy: null };
  const parsed = secretariatSettingsSchema.safeParse(data.value);
  if (!parsed.success) throw new Error("The saved Secretariat settings couldn’t be read. Save them again under Secretariat → Settings.");
  return { settings: parsed.data, updatedAt: data.updated_at as string, updatedBy: data.updated_by as string };
}

export type SettingsSaveOutcome = { ok: true } | { conflict: true } | { blocked: Array<SettingsRemoval & { count: number }> };

/**
 * Saves over the version the editor loaded (`expected`), carrying renames into every record. The
 * database refuses, saving nothing, when someone saved in between or a removed type or status is in use.
 */
export async function writeSecretariatSettings(next: SecretariatSettings, expected: string | null, actor: string): Promise<SettingsSaveOutcome> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before settings can be saved.");
  const current = await getSecretariatSettings();
  if (current.updatedAt !== expected) return { conflict: true };
  const { data, error } = await createAdminClient().rpc("save_secretariat_settings", { p_value: next, p_changes: settingsChanges(current.settings, next), p_expected: expected, p_actor: actor });
  if (error || !data || typeof data !== "object") throw new Error(settingsUnavailable);
  return data as SettingsSaveOutcome;
}
