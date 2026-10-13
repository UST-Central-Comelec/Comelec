import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { defaultDocument, defaultOnboardingLayout, onboardingDocumentKeys, type OnboardingDocument, type OnboardingDocumentKey, type OnboardingText, type OnboardingStep } from "./documents";

// Onboarding documents as they stand: the latest saved version of each, or version 1 from
// ./documents.ts where none was saved (supabase/migrations/0074_onboarding_declarations.sql).

type Row = { key: OnboardingDocumentKey; version: number; title: string; statement: string; body: string; saved_at: string; saved_by: string };

const missingTable = (code?: string) => code === "42P01" || code === "PGRST205";

const toDocument = (row: Row): OnboardingDocument => ({ key: row.key, version: row.version, title: row.title, statement: row.statement, body: row.body, savedAt: row.saved_at, savedBy: row.saved_by });

/** Every document, in step order. Before the migration is run, the texts in ./documents.ts. */
export async function getOnboardingLayout(): Promise<OnboardingStep[]> {
  if (!isSupabaseConfigured()) return defaultOnboardingLayout();
  const { data, error } = await createAdminClient().from("onboarding_layout").select("steps").eq("id", 1).maybeSingle();
  if (error && !missingTable(error.code)) throw new Error(error.message);
  return data?.steps ?? defaultOnboardingLayout();
}

export async function getOnboardingDocuments(includeHidden = false): Promise<OnboardingDocument[]> {
  const layout = await getOnboardingLayout();
  const latest = new Map<OnboardingDocumentKey, OnboardingDocument>();
  if (isSupabaseConfigured()) {
    const { data, error } = await createAdminClient().from("onboarding_documents").select("*").order("version", { ascending: false });
    if (error && !missingTable(error.code)) throw new Error(error.message);
    for (const row of (data ?? []) as Row[]) if (!latest.has(row.key)) latest.set(row.key, toDocument(row));
  }
  const defaults = new Map(onboardingDocumentKeys.map(key => [key, defaultDocument(key)]));
  return layout.filter(step => step.key !== "profile" && !step.deleted && (includeHidden || !step.hidden)).map(step => {
    const document = latest.get(step.key as OnboardingDocumentKey) ?? defaults.get(step.key as (typeof onboardingDocumentKeys)[number]);
    if (!document) throw new Error("An onboarding document is missing.");
    return document;
  });
}

export async function getOnboardingDocument(key: OnboardingDocumentKey) {
  return (await getOnboardingDocuments(true)).find((document) => document.key === key)!;
}

/**
 * Saves `text` as the document's next version. Nothing is saved when it's unchanged. Returns
 * "missing-table" until the migration is run.
 */
export async function saveOnboardingDocument(key: OnboardingDocumentKey, text: OnboardingText, author: string): Promise<"saved" | "unchanged" | "missing-table"> {
  const client = createAdminClient();
  // Two people saving at once: the second gets the next number.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await getOnboardingDocument(key);
    if (!current) throw new Error("This document no longer exists.");
    if (current.title === text.title && current.statement === text.statement && current.body === text.body) return "unchanged";
    const { error } = await client.from("onboarding_documents").insert({ key, version: current.version + 1, ...text, saved_by: author });
    if (!error) return "saved";
    if (missingTable(error.code)) return "missing-table";
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn’t pick a version number for the onboarding document.");
}
