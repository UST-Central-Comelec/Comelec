import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";

// Reads and saves the one row of public.site_settings (supabase/migrations/0018), set in the portal
// under Maintenance. The proxy reads the maintenance switch on its own (./maintenance-flag.ts).

export type SiteSettings = {
  /** The public website shows the maintenance page. The portal stays up. */
  maintenance: boolean;
  /** Shown on the maintenance page in place of the usual wording. */
  maintenanceMessage: string | null;
  maintenanceSince: string | null;
  /** Whether the public website shows the cookie notice. */
  cookieNotice: boolean;
  /** Visitors who dismissed the notice before this see it once more. */
  cookieNoticeResetAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const MAINTENANCE_MESSAGE_MAX = 300;

/** Until the migration is run, and whenever the settings can't be read: live, with the notice on. */
export const defaultSettings: SiteSettings = { maintenance: false, maintenanceMessage: null, maintenanceSince: null, cookieNotice: true, cookieNoticeResetAt: null, updatedAt: null, updatedBy: null };

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return defaultSettings;

  const { data, error } = await createAdminClient().from("site_settings").select("*").maybeSingle();
  if (error) throw new Error(`Couldn’t load the site settings: ${error.message}`);
  if (!data) return defaultSettings;

  return {
    maintenance: data.maintenance === true,
    maintenanceMessage: (data.maintenance_message as string | null) || null,
    maintenanceSince: (data.maintenance_since as string | null) ?? null,
    cookieNotice: data.cookie_notice !== false,
    cookieNoticeResetAt: (data.cookie_notice_reset_at as string | null) ?? null,
    updatedAt: data.updated_at as string,
    updatedBy: data.updated_by as string,
  };
}

// The site's layout, the maintenance page and the portal's shell all ask for these, so they're
// reused for a few seconds; saving clears them straight away.
const TTL_MS = 15_000;
/** The maintenance page mustn't hang on a database that's down: that's when it's needed most. */
const TIMEOUT_MS = 2_500;
let cached: { value: Promise<SiteSettings>; expiresAt: number } | null = null;

/** For pages: settings that can't be read count as the defaults rather than breaking the page. */
export function getSiteSettingsForSite(): Promise<SiteSettings> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  const value = Promise.race([getSiteSettings(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out loading the site settings.")), TIMEOUT_MS))]).catch((error) => {
    console.error(error);
    return defaultSettings;
  });
  cached = { value, expiresAt: now + TTL_MS };
  return value;
}

export async function saveSiteSettings(changes: Partial<Pick<SiteSettings, "maintenance" | "maintenanceMessage" | "maintenanceSince" | "cookieNotice" | "cookieNoticeResetAt">>, author: string) {
  const row: Record<string, unknown> = { id: true, updated_at: new Date().toISOString(), updated_by: author };
  if ("maintenance" in changes) row.maintenance = changes.maintenance;
  if ("maintenanceMessage" in changes) row.maintenance_message = changes.maintenanceMessage;
  if ("maintenanceSince" in changes) row.maintenance_since = changes.maintenanceSince;
  if ("cookieNotice" in changes) row.cookie_notice = changes.cookieNotice;
  if ("cookieNoticeResetAt" in changes) row.cookie_notice_reset_at = changes.cookieNoticeResetAt;

  const { error } = await createAdminClient().from("site_settings").upsert(row, { onConflict: "id" });
  cached = null;
  if (error) throw new Error(`Couldn’t save the site settings: ${error.message}`);
}
