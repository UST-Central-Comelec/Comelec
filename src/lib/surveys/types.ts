import { z } from "zod";
import { defaultAcknowledgementStep, defaultPrivacyStep, editorDefinitionSchema, privacyConsent, type EditorDefinition, type FormAnswers } from "@/lib/events/form-editor";

export const defaultSurveyDefinition: EditorDefinition = { steps: [
  defaultPrivacyStep([privacyConsent("survey_consent", "survey")]),
  { id: "questions", title: "Survey questions", description: "", fields: [{ id: "feedback", label: "What would you like to share?", prompt: "", kind: "textarea", required: true, options: [] }] },
  defaultAcknowledgementStep({ title: "Response recorded", message: "Thank you for answering this survey.", link: false, email: false, subject: "", body: "" }),
] };
export const surveySchema = z.object({
  title: z.string().trim().min(1, "Enter a survey title.").max(300),
  description: z.string().trim().max(2000),
  status: z.enum(["draft", "open", "closed"]),
  definition: editorDefinitionSchema,
}).superRefine((survey, ctx) => {
  if (!survey.definition.steps.some(step => !step.kind && step.fields.some(field => !["content", "image"].includes(field.kind)))) ctx.addIssue({ code: "custom", message: "Add at least one survey question." });
  if (survey.definition.steps.flatMap(step => step.fields).some(field => field.verifyUst)) ctx.addIssue({ code: "custom", message: "Survey respondents already sign in to the portal. Turn off Google verification on the question." });
  const acknowledgement = survey.definition.steps.at(-1)?.acknowledgement;
  if (acknowledgement?.email || acknowledgement?.link) ctx.addIssue({ code: "custom", message: "Survey acknowledgements appear in the portal. Turn off the acknowledgement email and registration link." });
});
export type SurveyValues = z.infer<typeof surveySchema>;
export type Survey = SurveyValues & { id: string; number: number; college: string | null; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string; responseCount: number };
export type SurveyResponse = { id: string; surveyId: string; respondentEmail: string; answers: FormAnswers; definition: EditorDefinition; createdAt: string };
export const surveyNumber = (survey: Pick<Survey, "number" | "createdAt">) => `UST:CC-${new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric" }).format(new Date(survey.createdAt)).slice(-3)}-SVY-${String(survey.number).padStart(3, "0")}`;
