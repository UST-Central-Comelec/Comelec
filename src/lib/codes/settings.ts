import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import type { CodeKey } from "./options";

export type CodeVisibility = "published" | "hidden";
export type CodeSettings = { visibility: CodeVisibility; updatedAt: string | null; updatedBy: string | null };

export function defaultCodeSettings(code: CodeKey): CodeSettings {
  return { visibility: code === "magna-carta" ? "hidden" : "published", updatedAt: null, updatedBy: null };
}

export async function getCodeSettings(code: CodeKey): Promise<CodeSettings> {
  if (!isSupabaseConfigured()) return defaultCodeSettings(code);
  const { data, error } = await createAdminClient().from("code_settings").select("visibility, updated_at, updated_by").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { visibility: data.visibility as CodeVisibility, updatedAt: data.updated_at as string, updatedBy: data.updated_by as string } : defaultCodeSettings(code);
}

/** Existing public documents stay available before the settings migration is installed. */
export async function isCodePublic(code: CodeKey): Promise<boolean> {
  try {
    return (await getCodeSettings(code)).visibility === "published";
  } catch (error) {
    // Only the missing table uses defaults. Other failures must not expose a hidden document.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("code_settings") && (message.includes("does not exist") || message.includes("schema cache"))) {
      return defaultCodeSettings(code).visibility === "published";
    }
    console.error(`Couldn’t read ${code} visibility: ${message}`);
    return false;
  }
}

export async function saveCodeVisibility(code: CodeKey, visibility: CodeVisibility, author: string) {
  const { error } = await createAdminClient().from("code_settings").upsert({ code, visibility, updated_at: new Date().toISOString(), updated_by: author }, { onConflict: "code" });
  if (error) throw new Error(error.message);
}
