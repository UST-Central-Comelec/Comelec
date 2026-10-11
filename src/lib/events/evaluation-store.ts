import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { applyEvaluationRequirements, defaultEvaluation, type EvaluationResponse, type EvaluationSettings } from "./evaluation";

export async function getEvaluationSettings(eventId: string): Promise<EvaluationSettings> {
  if (!isSupabaseConfigured()) return defaultEvaluation;
  const { data, error } = await createAdminClient().from("event_evaluation_forms").select("enabled, allow_anonymous, questions, steps, require_google").eq("event_id", eventId).maybeSingle();
  if (error) throw new Error("Couldn’t load the evaluation form. Apply migrations 0031, 0057_event_form_editors.sql, and 0058_event_form_authentication.sql if they haven’t been installed.");
  return data ? applyEvaluationRequirements({ requireGoogle: data.require_google ?? false, enabled: data.enabled, allowAnonymous: data.allow_anonymous, questions: data.questions, steps: data.steps ?? undefined }) : defaultEvaluation;
}

export async function hasEvaluationResponse(eventId: string, registrationId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("event_evaluation_responses").select("id").eq("event_id", eventId).eq("registration_id", registrationId).limit(1).maybeSingle();
  if (error) throw new Error("Couldn’t check whether an evaluation has already been submitted.");
  return Boolean(data);
}
export async function listEvaluationResponses(eventId: string): Promise<EvaluationResponse[]> {
  if (!isSupabaseConfigured()) return [];
  const rows: EvaluationResponse[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await createAdminClient().from("event_evaluation_responses").select("id, registration_id, anonymous, answers, questions, steps, created_at").eq("event_id", eventId).order("created_at", { ascending: false }).order("id").range(page * 1000, (page + 1) * 1000 - 1);
    if (error) throw new Error("Couldn’t load evaluation responses. Apply migrations 0031, 0057_event_form_editors.sql, and 0058_event_form_authentication.sql if they haven’t been installed.");
    rows.push(...data as EvaluationResponse[]);
    if (data.length < 1000) break;
  }
  return rows;
}

/** The event editor checks authorization before saving its questionnaire. */
export async function writeEvaluationSettings(eventId: string, settings: EvaluationSettings) {
  const normalized = applyEvaluationRequirements(settings);
  const { error } = await createAdminClient().from("event_evaluation_forms").upsert({ event_id: eventId, require_google: normalized.requireGoogle ?? false, enabled: normalized.enabled, allow_anonymous: normalized.allowAnonymous, questions: normalized.questions, steps: normalized.steps ?? null, updated_at: new Date().toISOString() });
  if (error) throw new Error("Couldn’t save the evaluation form. Apply migrations 0031, 0057_event_form_editors.sql, and 0058_event_form_authentication.sql and try again.");
}

export async function writeEvaluationContent(eventId: string, content: EvaluationSettings) {
  const current = await getEvaluationSettings(eventId);
  await writeEvaluationSettings(eventId, { ...content, requireGoogle: current.requireGoogle ?? false, enabled: current.enabled, allowAnonymous: current.allowAnonymous });
}
