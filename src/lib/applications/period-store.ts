import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { defaultPeriod, isPeriodMode, type ApplicationPeriod, type PeriodMode } from "./period";

// Reads and saves the single row in public.recruitment_settings (supabase/migrations/0010, 0011).

export async function getApplicationPeriod(): Promise<ApplicationPeriod> {
  if (!isSupabaseConfigured()) return defaultPeriod;

  const { data, error } = await createAdminClient().from("recruitment_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(`Couldn’t load the application period: ${error.message}`);
  // No row means nothing restricts applications (the database check lets them through too).
  if (!data) return { mode: "open", closesAt: null, graceEndsAt: null, updatedAt: null, updatedBy: null };

  return {
    mode: isPeriodMode(data.mode) ? data.mode : "open",
    closesAt: (data.closes_at as string | null) ?? null,
    // Missing until 0011 is run; a closed period then counts as closed straight away.
    graceEndsAt: (data.grace_ends_at as string | null | undefined) ?? null,
    updatedAt: data.updated_at as string,
    updatedBy: data.updated_by as string,
  };
}

export async function saveApplicationPeriod(period: { mode: PeriodMode; closesAt: string | null; graceEndsAt: string | null }, author: string) {
  const { error } = await createAdminClient()
    .from("recruitment_settings")
    .upsert({ id: true, mode: period.mode, closes_at: period.closesAt, grace_ends_at: period.graceEndsAt, updated_at: new Date().toISOString(), updated_by: author }, { onConflict: "id" });
  if (error?.message.includes("grace_ends_at")) throw new Error("Couldn’t save the application period: run supabase/migrations/0011_close_grace_period.sql in the Supabase SQL Editor first.");
  if (error) throw new Error(`Couldn’t save the application period: ${error.message}`);
}
