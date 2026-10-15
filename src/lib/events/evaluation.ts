import { z } from "zod";
import { defaultAcknowledgementStep, defaultPrivacyStep, editorDefinitionSchema, privacyConsent, type Acknowledgement, type EditorDefinition, type EditorField, type EditorStep } from "./form-editor";

export const maxEvaluationQuestions = 40;
export const evaluationSections = ["Data Privacy Consent", "Profile", "Pre-event Publicity", "Comments and Suggestions", "Learnings / Key Take-Aways"] as const;
/** A question as stored: an editor question, with the position of the step it's in. */
export type EvaluationQuestion = EditorField & { section: number };
/** A step as stored, without its questions (they're kept by `section`). */
export type EvaluationStep = Omit<EditorStep, "fields">;
export type EvaluationSettings = { requireGoogle?: boolean; enabled: boolean; allowAnonymous: boolean; questions: EvaluationQuestion[]; steps?: EvaluationStep[] };
export type EvaluationResponse = { id: string; registration_id: string | null; anonymous: boolean; answers: Record<string, string | number | string[]>; questions: EvaluationQuestion[]; steps?: EvaluationStep[]; created_at: string };
export const ratingLabels = ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"];

export const evaluationAcknowledgement: Acknowledgement = { title: "Thank you for your feedback.", message: "Your evaluation has been recorded. Your experience helps us improve future events.", link: false, email: false, subject: "Thank you for your feedback — {event}", body: "Hi {name},\n\nYour evaluation for {event} has been recorded. Thank you for your feedback." };
const consent = { ...privacyConsent("evaluation_consent", "event’s evaluation"), section: 0 };
/** A step as stored, without its questions. */
function withoutFields(step: EditorStep): EvaluationStep { const copy: Partial<EditorStep> = { ...step }; delete copy.fields; return copy as EvaluationStep; }
const privacyStep = withoutFields(defaultPrivacyStep([]));
const acknowledgementStep = withoutFields(defaultAcknowledgementStep(evaluationAcknowledgement));
const profileStep: EvaluationStep = { id: "evaluation_0", title: "Profile", description: "Find your registration using your full name or the reference code in your confirmation email.", builtin: 0 };
export const defaultEvaluationSteps: EvaluationStep[] = [privacyStep, profileStep, ...evaluationSections.slice(2).map((title, index) => ({ id: `evaluation_${index + 1}`, title, description: "" })), acknowledgementStep];

export const defaultQuestions: EvaluationQuestion[] = [
  consent,
  ...[
    ["objectives", "Objectives", "How clearly and effectively were the objectives of the event communicated and achieved?"],
    ["program", "Program Flow", "How would you rate the organization, pacing, and overall flow of the program?"],
    ["venue", "Venue", "How suitable and comfortable was the venue or online platform for the event?"],
    ["organizers", "Organizers", "How would you rate the preparedness, coordination, and assistance provided by the organizers?"],
    ["speakers", "Speakers", "How would you rate the speakers or facilitators in terms of knowledge, delivery, and audience engagement?"],
    ["relevance", "Relevance of the Event", "How relevant and useful was the event to you as a participant?"],
    ["overall", "Overall rating of the event", "Overall, how satisfied are you with the event?"],
  ].map(([id, label, prompt]) => ({ id, label, prompt, section: 2, kind: "rating" as const, required: true, options: [] })),
  { id: "assessment", section: 3, label: "Overall assessment", prompt: "In your opinion, what else can we do to address the overall assessment of the event?", kind: "textarea", required: false, options: [] },
  { id: "comments", section: 3, label: "Other comments", prompt: "Other comments or suggestions to the organizers", kind: "textarea", required: false, options: [] },
  { id: "learning", section: 4, label: "Key takeaway", prompt: "What is your most important learning or key takeaway from today's event?", kind: "textarea", required: true, options: [] },
  { id: "future", section: 4, label: "Future events", prompt: "What topics or activities would you like to see in future events?", kind: "textarea", required: false, options: [] },
];
export const defaultEvaluation: EvaluationSettings = { enabled: false, allowAnonymous: false, questions: defaultQuestions, steps: defaultEvaluationSteps };
export const normalizeName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-PH");

/**
 * Evaluations saved before the Data Privacy Consent and the Acknowledgement existed gain them: the
 * consent goes in front (so every question's step moves along one), the profile lookup is marked as
 * the built-in step it always was, and their "text" questions, which were paragraphs, stay paragraphs.
 */
export function applyEvaluationRequirements(settings: EvaluationSettings): EvaluationSettings {
  let steps = settings.steps ?? defaultEvaluationSteps.filter(step => !step.kind);
  let questions = settings.questions.map(question => ({ ...question, options: question.options ?? [] }));
  if (steps[0]?.kind !== "privacy") {
    steps = [privacyStep, { ...steps[0], builtin: 0 }, ...steps.slice(1)];
    questions = [consent, ...questions.map(question => ({ ...question, section: question.section + 1, kind: question.kind === "text" ? "textarea" as const : question.kind }))];
  }
  if (steps.at(-1)?.kind !== "acknowledgement") steps = [...steps, acknowledgementStep];
  return { ...settings, steps, questions };
}

export function evaluationDefinition(settings: EvaluationSettings): EditorDefinition {
  const normalized = applyEvaluationRequirements(settings);
  return { steps: normalized.steps!.map((step, index) => ({ ...step, fields: normalized.questions.filter(question => question.section === index).map(question => { const field: Partial<EvaluationQuestion> = { ...question }; delete field.section; return field as EditorField; }) })) };
}

/** Anonymous feedback excludes profile questions before rendering, validation and storage. */
export function evaluationResponseSettings(settings: EvaluationSettings, anonymous: boolean): EvaluationSettings {
  const normalized = applyEvaluationRequirements(settings);
  if (!anonymous) return normalized;
  return { ...normalized, questions: normalized.questions.filter(question => normalized.steps?.[question.section]?.builtin !== 0 && !question.identity && question.kind !== "email" && !question.rules?.studentNumber && !question.rules?.mobile) };
}
export function evaluationFromDefinition(definition: EditorDefinition, settings: EvaluationSettings): EvaluationSettings {
  return { ...settings, steps: definition.steps.map(withoutFields), questions: definition.steps.flatMap((step, section) => step.fields.map(field => ({ ...field, section }))) };
}

const reserved = ["anonymous", "referenceCode", "firstName", "lastName", "middleName", "website"];
/** Checked through the editor's own schema, so the Evaluation and RSVP forms follow the same rules. */
export const evaluationSettingsSchema = z.object({ requireGoogle: z.boolean().optional(), enabled: z.boolean(), allowAnonymous: z.boolean(), steps: z.array(z.record(z.string(), z.unknown())).max(22).optional(), questions: z.array(z.record(z.string(), z.unknown())).max(100) }).transform((raw, context) => {
  const settings = raw as unknown as EvaluationSettings;
  let parsed;
  try { parsed = editorDefinitionSchema.safeParse(evaluationDefinition(settings)); } catch { parsed = null; }
  if (!parsed?.success) {
    for (const issue of parsed?.error.issues ?? [{ message: "Check the evaluation form." }]) context.addIssue({ code: "custom", message: issue.message });
    return z.NEVER;
  }
  if (parsed.data.steps.filter(step => step.builtin === 0).length !== 1) context.addIssue({ code: "custom", message: "Keep the evaluation’s Profile step." });
  if (parsed.data.steps.some(step => step.fields.some(field => reserved.includes(field.id)))) context.addIssue({ code: "custom", message: "Assign fields to a valid step with unique IDs." });
  if (settings.enabled && !parsed.data.steps.some(step => !step.kind && step.fields.some(field => field.kind !== "content" && field.kind !== "image"))) context.addIssue({ code: "custom", message: "Add at least one question before opening the evaluation form." });
  return evaluationFromDefinition(parsed.data, { requireGoogle: settings.requireGoogle, enabled: settings.enabled, allowAnonymous: settings.allowAnonymous, questions: [] });
});
