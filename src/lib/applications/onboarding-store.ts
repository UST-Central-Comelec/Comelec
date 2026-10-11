import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { defaultOnboarding, onboardingSchema, type OnboardingSettings } from "./onboarding";

export async function getOnboarding(college = "", allowMissingTable = false): Promise<OnboardingSettings> {
  if (!isSupabaseConfigured()) return defaultOnboarding();
  const { data, error } = await createAdminClient().from("recruitment_onboarding").select("messenger_url, buttons").eq("college", college).maybeSingle();
  if (error) {
    // Existing acceptance delivery keeps working during migration rollout.
    if (allowMissingTable && (error.code === "42P01" || error.code === "PGRST205")) return defaultOnboarding();
    throw new Error(error.message);
  }
  return data ? onboardingSchema.parse({ messengerUrl: data.messenger_url, buttons: data.buttons ?? [] }) : defaultOnboarding();
}

export async function saveOnboarding(college: string, settings: OnboardingSettings, author: string) {
  const { error } = await createAdminClient().from("recruitment_onboarding").upsert({ college, messenger_url: settings.messengerUrl, buttons: settings.buttons, updated_at: new Date().toISOString(), updated_by: author }, { onConflict: "college" });
  if (error) throw new Error(error.message);
}
