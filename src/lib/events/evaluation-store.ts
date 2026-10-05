import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { applyEvaluationRequirements, defaultEvaluation, type EvaluationResponse, type EvaluationSettings } from "./evaluation";

export async function getEvaluationSettings(eventId: string): Promise<EvaluationSettings> {
  if (!isSupabaseConfigured()) return defaultEvaluation;
  const { data, error } = await createAdminClient().from("event_evaluation_forms").select("enabled, allow_anonymous, questions").eq("event_id", eventId).maybeSingle();
  if (error) throw new Error("Couldn’t load the evaluation form. Apply migration 0031 if it hasn’t been installed.");
  return data ? applyEvaluationRequirements({ enabled: data.enabled, allowAnonymous: data.allow_anonymous, questions: data.questions }) : defaultEvaluation;
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
    const { data, error } = await createAdminClient().from("event_evaluation_responses").select("id, registration_id, anonymous, answers, questions, created_at").eq("event_id", eventId).order("created_at", { ascending: false }).order("id").range(page * 1000, (page + 1) * 1000 - 1);
    if (error) throw new Error("Couldn’t load evaluation responses. Apply migration 0031 if it hasn’t been installed.");
    rows.push(...data as EvaluationResponse[]);
    if (data.length < 1000) break;
  }
  return rows;
}
