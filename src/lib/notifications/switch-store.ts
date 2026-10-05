import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { emailKeys, isEmailKey, switchesWith, type EmailKey, type EmailSwitches, type SwitchOverrides } from "./switches";

// Reads and saves public.email_settings (supabase/migrations/0026): which automatic emails are
// switched off or on, where that differs from the defaults in ./switches.ts. Set under
// Apps → Email Sender → Automatic.

export type SavedSwitches = { switches: EmailSwitches; updated: { at: string; by: string } | null };

const TABLE = "email_settings";

/** True when the table isn't there yet: 0026 hasn't been run. */
export const isSwitchesMissing = (message: string) => message.includes(TABLE) || message.includes("schema cache");

export async function getSavedSwitches(): Promise<SavedSwitches> {
  if (!isSupabaseConfigured()) return { switches: switchesWith(), updated: null };
  const { data, error } = await createAdminClient().from(TABLE).select("*");
  if (error) throw new Error(`Couldn’t load the email settings: ${error.message}`);

  const overrides: SwitchOverrides = {};
  let updated: SavedSwitches["updated"] = null;
  for (const row of data) {
    const key: unknown = row.key;
    // A row for an email that no longer exists is ignored.
    if (!isEmailKey(key) || typeof row.enabled !== "boolean") continue;
    overrides[key] = row.enabled;
    if (!updated || (row.updated_at as string) > updated.at) updated = { at: row.updated_at as string, by: row.updated_by as string };
  }
  return { switches: switchesWith(overrides), updated };
}

// Asked before every automatic email, so the answer is reused for a few seconds; saving clears it.
const TTL_MS = 15_000;
let cached: { value: Promise<EmailSwitches>; expiresAt: number } | null = null;
let warned = false;

/**
 * For sending: until the migration is run, and whenever the settings can't be read, every email
 * follows its default rather than going unsent.
 */
export function getEmailSwitches(): Promise<EmailSwitches> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  const value = getSavedSwitches().then(
    (saved) => saved.switches,
    (error: unknown) => {
      // Said once, not before every email.
      if (!warned) console.error(error instanceof Error ? error.message : error);
      warned = true;
      return switchesWith();
    },
  );
  cached = { value, expiresAt: now + TTL_MS };
  return value;
}

export const isEmailOn = async (key: EmailKey) => (await getEmailSwitches())[key];

/** Saves every email's switch: a row for each one that differs from its default, and none for the rest. */
export async function saveSwitches(overrides: SwitchOverrides, author: string) {
  const client = createAdminClient();
  const now = new Date().toISOString();
  const rows = Object.entries(overrides).map(([key, enabled]) => ({ key, enabled, updated_at: now, updated_by: author }));
  const back = emailKeys.filter((key) => !(key in overrides));
  try {
    if (rows.length) {
      const { error } = await client.from(TABLE).upsert(rows, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    if (back.length) {
      const { error } = await client.from(TABLE).delete().in("key", back);
      if (error) throw new Error(error.message);
    }
  } finally {
    cached = null;
  }
}
