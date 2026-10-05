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

export async function getSiteSettings(signal?: AbortSignal): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return defaultSettings;

  const query = createAdminClient().from("site_settings").select("*");
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
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
let lastKnown: SiteSettings | null = null;

/** For pages: keep the last known settings during an outage, or use defaults on the first read. */
export function getSiteSettingsForSite(): Promise<SiteSettings> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Timed out loading the site settings."));
      controller.abort();
    }, TIMEOUT_MS);
  });
  const value = Promise.race([getSiteSettings(controller.signal), timeout])
    .then((settings) => {
      // A save or a newer read may have invalidated this request while it was loading.
      if (cached?.value === value) lastKnown = settings;
      return settings;
    })
    .catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : "Unknown database error.";
      console.warn(`Site settings unavailable; using ${lastKnown ? "last known settings" : "defaults"}. ${reason}`);
      return lastKnown ?? defaultSettings;
    })
    .finally(() => clearTimeout(timer));
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
  if (error) throw new Error(`Couldn’t save the site settings: ${error.message}`);
  cached = null;
  lastKnown = null;
}
