import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isLocal, type PortalUser } from "@/lib/auth/session";
import { surveySchema, type Survey, type SurveyResponse } from "./types";
import { z } from "zod";

export const surveysUnavailable = "Couldn’t load surveys. Apply supabase/migrations/0085_secretariat_surveys.sql and 0086_secretariat_surveys_repair.sql, then reload.";
const fields = "id,number,title,description,status,definition,college,created_by,updated_by,created_at,updated_at,secretariat_survey_responses(count)";
type Row = { id: string; number: number; title: string; description: string; status: string; definition: unknown; college: string | null; created_by: string; updated_by: string; created_at: string; updated_at: string; secretariat_survey_responses: Array<{ count: number }> };
const fromRow = (row: Row): Survey => ({ ...surveySchema.parse(row), id: row.id, number: Number(row.number), college: row.college, createdBy: row.created_by, updatedBy: row.updated_by, createdAt: row.created_at, updatedAt: row.updated_at, responseCount: row.secretariat_survey_responses[0]?.count ?? 0 });
export async function listSurveys(user: PortalUser): Promise<Survey[]> {
  if (!isSupabaseConfigured() || (isLocal(user) && !user.college)) return [];
  const items: Survey[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = createAdminClient().from("secretariat_surveys").select(fields).order("number", { ascending: false }).range(offset, offset + 999);
    if (isLocal(user)) query = query.eq("college", user.college!);
    const { data, error } = await query;
    if (error) throw new Error(surveysUnavailable);
    items.push(...(data as unknown as Row[]).map(fromRow));
    if (data.length < 1000) return items;
  }
}
export async function getSurvey(id: string, user: PortalUser): Promise<Survey | null> {
  if (!z.uuid().safeParse(id).success || !isSupabaseConfigured() || (isLocal(user) && !user.college)) return null;
  let query = createAdminClient().from("secretariat_surveys").select(fields).eq("id", id);
  if (isLocal(user)) query = query.eq("college", user.college!);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(surveysUnavailable);
  return data ? fromRow(data as unknown as Row) : null;
}
/** The caller first loads a survey through getSurvey, so all responses remain in its unit scope. */
export async function surveyResponses(survey: Survey): Promise<SurveyResponse[]> {
  const items: SurveyResponse[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createAdminClient().from("secretariat_survey_responses").select("id,survey_id,respondent_email,answers,definition,created_at").eq("survey_id", survey.id).order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (error) throw new Error(surveysUnavailable);
    items.push(...data.map(row => ({ id: row.id, surveyId: row.survey_id, respondentEmail: row.respondent_email, answers: row.answers, definition: row.definition, createdAt: row.created_at })));
    if (data.length < 1000) return items;
  }
}
export async function hasSurveyResponse(survey: Survey, email: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("secretariat_survey_responses").select("id").eq("survey_id", survey.id).eq("respondent_email", email.toLowerCase()).maybeSingle();
  if (error) throw new Error(surveysUnavailable);
  return Boolean(data);
}
