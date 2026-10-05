export const maxEvaluationQuestions = 40;
export const evaluationSections = ["Profile", "Pre-event Publicity", "Comments and Suggestions", "Learnings / Key Take-Aways"] as const;
export type EvaluationQuestion = { id: string; section: 1 | 2 | 3; label: string; prompt: string; kind: "rating" | "text"; required: boolean };
export type EvaluationSettings = { enabled: boolean; allowAnonymous: boolean; questions: EvaluationQuestion[] };
export type EvaluationResponse = { id: string; registration_id: string | null; anonymous: boolean; answers: Record<string, string | number>; questions: EvaluationQuestion[]; created_at: string };
export const ratingLabels = ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"];
export const defaultQuestions: EvaluationQuestion[] = [
  ...[
    ["objectives", "Objectives", "How clearly and effectively were the objectives of the event communicated and achieved?"],
    ["program", "Program Flow", "How would you rate the organization, pacing, and overall flow of the program?"],
    ["venue", "Venue", "How suitable and comfortable was the venue or online platform for the event?"],
    ["organizers", "Organizers", "How would you rate the preparedness, coordination, and assistance provided by the organizers?"],
    ["speakers", "Speakers", "How would you rate the speakers or facilitators in terms of knowledge, delivery, and audience engagement?"],
    ["relevance", "Relevance of the Event", "How relevant and useful was the event to you as a participant?"],
    ["overall", "Overall rating of the event", "Overall, how satisfied are you with the event?"],
  ].map(([id, label, prompt]) => ({ id, label, prompt, section: 1 as const, kind: "rating" as const, required: true })),
  { id: "assessment", section: 2, label: "Overall assessment", prompt: "In your opinion, what else can we do to address the overall assessment of the event?", kind: "text", required: false },
  { id: "comments", section: 2, label: "Other comments", prompt: "Other comments or suggestions to the organizers", kind: "text", required: false },
  { id: "learning", section: 3, label: "Key takeaway", prompt: "What is your most important learning or key takeaway from today's event?", kind: "text", required: true },
  { id: "future", section: 3, label: "Future events", prompt: "What topics or activities would you like to see in future events?", kind: "text", required: false },
];
export const defaultEvaluation: EvaluationSettings = { enabled: false, allowAnonymous: false, questions: defaultQuestions };
export const normalizeName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-PH");

/** Keep the public form and server validation consistent, including forms saved before these requirements. */
export function applyEvaluationRequirements(settings: EvaluationSettings): EvaluationSettings {
  return { ...settings, questions: settings.questions.map(question => {
    if (question.section === 2 || (question.section === 3 && question.id === "future")) return { ...question, required: false };
    if (question.section === 3 && question.id === "learning") return { ...question, required: true };
    return question;
  }) };
}
