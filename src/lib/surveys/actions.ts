"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { isLocal, requireAccess, requireEditor } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { emailDomainProblems } from "@/lib/forms/email-domain";
import { isNameQuestion, keptAnswers, rulesOf, validateEditorAnswers } from "@/lib/events/form-editor";
import { email, mobileNumber, personName, studentNumber } from "@/lib/forms/fields";
import { resolveFlow } from "@/lib/events/form-flow";
import { surveySchema } from "./types";
import { getSurvey } from "./store";
import { conflictState, mergePlan, readGuard } from "@/lib/data/edit-guard";
import type { FormState } from "@/lib/portal/form";

export type SurveyResult = { error?: string; id?: string; success?: boolean; merged?: boolean; conflict?: NonNullable<FormState>["conflict"] };
const answersSchema = z.record(z.string().max(80), z.union([z.string().max(4000), z.array(z.string().max(4000)).max(30)])).refine(value => Object.keys(value).length <= 100);
export async function saveSurvey(id: string | null, value: unknown, expected: string | null, formData: FormData): Promise<SurveyResult> {
  const user = await requireEditor("secretariat/surveys");
  if (id !== null && !z.uuid().safeParse(id).success) return { error: "Unknown survey." };
  const parsed = surveySchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the survey fields." };
  try {
    const guard = readGuard(formData);
    let version = guard.overwrite ?? guard.stamp?.version ?? expected;
    let payload = parsed.data;
    let merged = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await createAdminClient().rpc("save_secretariat_survey", { p_id: id, p_value: payload, p_expected: version, p_actor: user.email, p_local: isLocal(user), p_college: user.college });
      if (error) return { error: "Couldn’t save the survey. Apply migration 0085, then try again." };
      if (data?.error) return { error: data.error };
      if (!data?.conflict) {
        revalidatePath("/portal/secretariat/surveys", "layout");
        return { id: data.id, merged };
      }
      const current = id ? await getSurvey(id, user) : null;
      if (!current) return { error: "This survey is unavailable." };
      const plan = guard.stamp ? mergePlan(guard.stamp.fields, parsed.data, surveySchema.parse(current)) : null;
      if (!plan || plan.clash.length || guard.overwrite || attempt === 2) {
        const state = await conflictState({ by: current.updatedBy, at: current.updatedAt, version: current.updatedAt, fields: plan?.clash ?? [] }, { title: "Survey title", description: "Description", status: "Status", definition: "Survey questions" }, "survey", user.email);
        return { error: state?.error, conflict: state?.conflict };
      }
      const next = { ...surveySchema.parse(current), ...Object.fromEntries(plan.write.map(key => [key, parsed.data[key as keyof typeof parsed.data]])) };
      payload = surveySchema.parse(next);
      version = current.updatedAt;
      merged = true;
    }
    return { error: "This survey keeps changing. Reload before saving." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Couldn’t save the survey. Try again." };
  }
}
export async function submitSurvey(id: string, answers: unknown, expected: string): Promise<SurveyResult> {
  const user = await requireAccess("secretariat/surveys");
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return { error: "Check your answers and try again." };
  try {
    const survey = await getSurvey(id, user);
    if (!survey || survey.status !== "open") return { error: "This survey is closed or unavailable." };
    if (survey.updatedAt !== expected) return { error: "This survey changed. Reload before answering." };
    const { visible } = resolveFlow(survey.definition, parsed.data);
    for (const field of survey.definition.steps.flatMap(step => step.fields)) {
      const raw = parsed.data[field.id];
      if (!visible.has(field.id) || typeof raw !== "string" || !raw.trim()) continue;
      const rules = rulesOf(field);
      const schema = isNameQuestion(field) ? personName("Enter a name.") : rules.studentNumber ? studentNumber() : rules.mobile ? mobileNumber() : field.kind === "email" ? email() : null;
      const valid = schema?.safeParse(raw);
      if (valid && !valid.success) return { error: `${field.label}: ${valid.error.issues[0].message}` };
    }
    const problem = validateEditorAnswers(survey.definition, parsed.data);
    if (problem) return { error: problem };
    const kept = keptAnswers(survey.definition, parsed.data);
    const emails = Object.fromEntries(survey.definition.steps.flatMap(step => step.fields).filter(field => field.kind === "email" && typeof kept[field.id] === "string").map(field => [field.id, kept[field.id] as string]));
    const domainProblems = await emailDomainProblems(emails);
    if (Object.keys(domainProblems).length) return { error: Object.values(domainProblems)[0] };
    const { data, error } = await createAdminClient().rpc("submit_secretariat_survey", { p_id: id, p_answers: kept, p_expected: expected, p_actor: user.email, p_local: isLocal(user), p_college: user.college });
    if (error) return { error: "Couldn’t submit your response. Try again." };
    if (data?.error) return { error: data.error };
    revalidatePath("/portal/secretariat/surveys", "layout");
    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Couldn’t submit your response. Try again." };
  }
}
