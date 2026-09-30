import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { isPeriodMode, type ApplicationPeriod, type PeriodMode } from "@/lib/applications/period";
import type { FilingKind } from "./kinds";

// Reads and saves a row of public.filing_periods (supabase/migrations/0015). Each filing uses the
// same period rules as commissioner applications (lib/applications/period.ts).

/** Until someone opens it from the portal. */
const closedPeriod: ApplicationPeriod = { mode: "closed", closesAt: null, graceEndsAt: null, updatedAt: null, updatedBy: null };

export async function getFilingPeriod(kind: FilingKind): Promise<ApplicationPeriod> {
  if (!isSupabaseConfigured()) return closedPeriod;

  const { data, error } = await createAdminClient().from("filing_periods").select("*").eq("kind", kind).maybeSingle();
  if (error) throw new Error(`Couldn’t load the filing period: ${error.message}`);
  if (!data) return closedPeriod;

  return {
    mode: isPeriodMode(data.mode) ? data.mode : "closed",
    closesAt: (data.closes_at as string | null) ?? null,
    graceEndsAt: (data.grace_ends_at as string | null) ?? null,
    updatedAt: data.updated_at as string,
    updatedBy: data.updated_by as string,
  };
}

/** For the public pages: a period that can't be read counts as closed rather than breaking the page. */
export const getFilingPeriodForSite = (kind: FilingKind) =>
  getFilingPeriod(kind).catch((error) => {
    console.error(error);
    return closedPeriod;
  });

export async function saveFilingPeriod(kind: FilingKind, period: { mode: PeriodMode; closesAt: string | null; graceEndsAt: string | null }, author: string) {
  const { error } = await createAdminClient()
    .from("filing_periods")
    .upsert({ kind, mode: period.mode, closes_at: period.closesAt, grace_ends_at: period.graceEndsAt, updated_at: new Date().toISOString(), updated_by: author }, { onConflict: "kind" });
  if (error) throw new Error(`Couldn’t save the filing period: ${error.message}`);
}
