import { z } from "zod";
import { branchChoices, flowProblems, resolveFlow } from "./form-flow";
import { cleanEmail, cleanMobileNumber, cleanPersonName, cleanStudentNumber, emailPattern, mobileNumberPattern, personNamePattern, studentNumberPattern, tidyPersonName } from "@/lib/forms/input";

/** What a question can ask for. `content` (Add Text) and `image` (Add Image) are blocks to read, not answers. */
export const fieldKinds = {
  text: "Short answer",
  textarea: "Paragraph",
  email: "Email",
  link: "Link",
  radio: "Multiple choice",
  checkbox: "Checkboxes",
  dropdown: "Dropdown",
  rating: "Rating (1–5)",
  confirm: "Confirmation box",
  content: "Text",
  image: "Image",
} as const;
export type FieldKind = keyof typeof fieldKinds;
export const blockKinds: readonly FieldKind[] = ["content", "image"];
export const isBlock = (kind: FieldKind) => blockKinds.includes(kind);
export const choiceKinds: readonly FieldKind[] = ["radio", "checkbox", "dropdown"];

/** Rules a typed answer can be held to (Short answer and Paragraph). */
export const textRules = {
  uppercase: "Auto-uppercase",
  studentNumber: "Student number (10 digits)",
  mobile: "Mobile number (11 digits, starts with 09)",
  letters: "Letters only",
  digits: "Numbers only",
  noSpecial: "No special characters",
  hyphenOnly: "Letters, numbers, spaces and hyphens",
} as const;
export type TextRule = keyof typeof textRules;
export const linkKinds = { drive: "Google Drive link", facebook: "Facebook link" } as const;
export type LinkKind = keyof typeof linkKinds;
/** Words people can fill in on an acknowledgement, replaced when it's shown or sent. */
export const acknowledgementTags = { "{name}": "The respondent’s first name", "{event}": "The event’s name", "{link}": "The event’s public registration link" } as const;

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
/** Public uploads only (src/lib/data/uploads.ts), so a form can't pull in images from elsewhere. */
const uploadedImage = z.string().max(500).regex(/^https:\/\/[^\s]+\/storage\/v1\/object\/public\/uploads\/event-forms\/[^\s]+$/);

export const editorFieldSchema = z.object({
  id,
  label: z.string().trim().min(1).max(200),
  prompt: z.string().trim().max(1000),
  kind: z.enum(Object.keys(fieldKinds) as [FieldKind, ...FieldKind[]]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  /** A line under each choice, matched to `options` by position. */
  notes: z.array(z.string().trim().max(1000)).max(30).optional(),
  /** On a conditional question: the questions each choice leads to, matched to its choices by position (form-flow.ts). Forms saved with one question per choice still read. */
  branches: z.preprocess(value => Array.isArray(value) ? value.map(entry => entry == null ? [] : typeof entry === "string" ? [entry] : entry) : value, z.array(z.array(id).max(20)).max(30)).optional(),
  rules: z.object({ uppercase: z.boolean(), studentNumber: z.boolean(), mobile: z.boolean(), letters: z.boolean(), digits: z.boolean(), noSpecial: z.boolean(), hyphenOnly: z.boolean() }).partial().optional(),
  /** On an Email question: the answer must be a UST Google account the respondent signs in with. */
  verifyUst: z.boolean().optional(),
  /** On a Link question: the kinds of link accepted; none means any web link. */
  links: z.array(z.enum(Object.keys(linkKinds) as [LinkKind, ...LinkKind[]])).max(2).optional(),
  /** On Checkboxes: how many may be ticked, and whether ticks are numbered in the order they're made. */
  min: z.number().int().min(0).max(30).optional(),
  max: z.number().int().min(1).max(30).optional(),
  ranked: z.boolean().optional(),
  /** On an Image block: the picture (its alt text is `label`, its caption `prompt`). */
  image: z.object({ url: uploadedImage, size: z.enum(["full", "medium"]) }).optional(),
  /** Which answer names the respondent, for receipts and the participant list. Set on the RSVP's starting questions; never shown. */
  identity: z.enum(["lastName", "firstName", "middleName", "email", "studentNumber", "affiliation", "organization"]).optional(),
}).superRefine((field, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (choiceKinds.includes(field.kind) && (!field.options.length || new Set(field.options).size !== field.options.length)) issue(`Give “${field.label}” distinct choices.`);
  if (field.kind === "checkbox" && field.min !== undefined && field.max !== undefined && field.min > field.max) issue(`“${field.label}” needs a minimum no higher than its maximum.`);
  if (field.kind === "checkbox" && field.max !== undefined && field.max > field.options.length) issue(`“${field.label}” can’t allow more ticks than it has choices.`);
  if (field.rules?.letters && (field.rules.digits || field.rules.studentNumber || field.rules.mobile)) issue(`“${field.label}” can’t be letters only and numbers only.`);
  if (field.rules?.studentNumber && field.kind !== "text") issue(`Only a short answer can be a student number.`);
  if (field.rules?.mobile && field.kind !== "text") issue(`Only a short answer can be a mobile number.`);
  if (field.rules?.mobile && field.rules.studentNumber) issue(`“${field.label}” can’t be both a student number and a mobile number.`);
  if (field.kind === "image" && !field.image) issue(`Upload the image for “${field.label}”.`);
});

const acknowledgementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().max(2000),
  link: z.boolean(),
  email: z.boolean(),
  subject: z.string().trim().max(200),
  body: z.string().trim().max(4000),
}).superRefine((value, ctx) => { if (value.email && !value.subject) ctx.addIssue({ code: "custom", message: "Give the acknowledgement email a subject." }); });
export type Acknowledgement = z.infer<typeof acknowledgementSchema>;

export const editorStepSchema = z.object({
  id,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  builtin: z.number().int().min(0).max(6).optional(),
  /** The two steps every form has: Data Privacy Consent first, the Acknowledgement last. */
  kind: z.enum(["privacy", "acknowledgement"]).optional(),
  acknowledgement: acknowledgementSchema.optional(),
  fields: z.array(editorFieldSchema).max(40),
});
export const editorDefinitionSchema = z.object({ steps: z.array(editorStepSchema).min(2).max(22) }).superRefine((definition, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const ids = definition.steps.flatMap(step => step.fields.map(field => field.id));
  if (new Set(ids).size !== ids.length || new Set(definition.steps.map(step => step.id)).size !== definition.steps.length) issue("Use unique step and field IDs.");
  if (ids.length > 100) issue("Keep the form under 100 fields.");
  const first = definition.steps[0], last = definition.steps.at(-1)!;
  if (first.kind !== "privacy" || definition.steps.filter(step => step.kind === "privacy").length !== 1) issue("Keep the Data Privacy Consent as the first step.");
  if (first.fields.some(field => field.kind !== "confirm") || !first.fields.length) issue("The Data Privacy Consent step holds confirmation boxes only.");
  if (last.kind !== "acknowledgement" || !last.acknowledgement || last.fields.length || definition.steps.filter(step => step.kind === "acknowledgement").length !== 1) issue("Keep the Acknowledgement as the last step.");
  for (const message of flowProblems(definition)) issue(message);
});
export type EditorField = z.infer<typeof editorFieldSchema>;
export type EditorStep = z.infer<typeof editorStepSchema>;
export type EditorDefinition = z.infer<typeof editorDefinitionSchema>;
export type FormAnswers = Record<string, string | string[]>;

export const defaultPrivacyStep = (fields: EditorField[]): EditorStep => ({ id: "privacy", kind: "privacy", title: "Data Privacy Consent", description: "Tick each box to continue.", fields });
export const privacyConsent = (id: string, form: string): EditorField => ({ id, kind: "confirm", required: true, options: [], prompt: "", label: `I have read the UST Central Comelec Data Privacy Statement and consent to the collection and processing of my personal information for this ${form}.` });
export const defaultAcknowledgementStep = (acknowledgement: Acknowledgement): EditorStep => ({ id: "acknowledgement", kind: "acknowledgement", title: "Acknowledgement", description: "", acknowledgement, fields: [] });
export const acknowledgementOf = (definition: EditorDefinition) => definition.steps.find(step => step.kind === "acknowledgement")?.acknowledgement;
export const fillTags = (text: string, values: { name?: string; event: string; link: string }) => text.replaceAll("{name}", values.name || "there").replaceAll("{event}", values.event).replaceAll("{link}", values.link);

/* Answer rules, the same in the browser and on the server. Names, student numbers, mobile numbers and
   emails follow the rules every form does (src/lib/forms/input.ts, AGENTS.md). */
const patterns = {
  letters: /^[\p{L}\p{M}\s.'’-]*$/u,
  digits: /^\d*$/,
  digitLines: /^[\d\s]*$/,
  noSpecial: /^[\p{L}\p{M}\p{N}\s.,'’"“”()?!:;\-–—]*$/u,
  studentNumber: studentNumberPattern,
  mobile: mobileNumberPattern,
  email: emailPattern,
};

/** A question that asks for the respondent's own last, first or middle name. */
export const isNameQuestion = (field: EditorField) => field.identity === "lastName" || field.identity === "firstName" || field.identity === "middleName";

/** The rules a question is held to: its own, and those its identity sets whatever was ticked. */
export function rulesOf(field: EditorField): NonNullable<EditorField["rules"]> {
  const rules = field.rules ?? {};
  if (isNameQuestion(field)) return { ...rules, uppercase: true, letters: true };
  if (field.identity === "studentNumber") return { ...rules, studentNumber: true };
  return rules;
}

/** What a typed answer keeps as it's typed, by its rules. */
export function cleanAnswer(field: EditorField, value: string): string {
  const rules = rulesOf(field);
  if (field.kind === "email") return cleanEmail(value);
  if (isNameQuestion(field)) return cleanPersonName(value);
  if (rules.studentNumber) return cleanStudentNumber(value);
  if (rules.mobile) return cleanMobileNumber(value);
  if (rules.digits && field.kind === "text") return value.replace(/\D/g, "");
  return rules.uppercase ? value.toLocaleUpperCase("en-PH") : value;
}
const driveHosts = ["drive.google.com", "docs.google.com"];
const facebookHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "www.fb.com", "fb.me"];

/** What a respondent is told about a question's rules, under its box. */
export function answerHint(field: EditorField): string {
  const rules = rulesOf(field);
  if (field.kind === "text" && rules.studentNumber) return "Your 10-digit student number.";
  if (field.kind === "text" && rules.mobile) return "An 11-digit mobile number starting with 09, numbers only.";
  if (isNameQuestion(field)) return "Letters only, in capitals.";
  if (field.kind === "email" && field.verifyUst) return "Sign in with your UST Google account to fill this in.";
  if (field.kind === "link") return field.links?.length ? `A ${field.links.map(kind => linkKinds[kind]).join(" or ")}.` : "A full web address, starting with https://";
  if (field.kind === "checkbox") {
    const max = field.max ?? field.options.length, min = field.min ?? 0;
    const range = min && min === max ? `Tick ${min}` : min > 1 ? `Tick ${min} to ${max}` : max < field.options.length ? `Tick up to ${max}` : "";
    return [range, field.ranked ? "in order of preference: your first tick is your first choice" : ""].filter(Boolean).join(", ") + (range || field.ranked ? "." : "");
  }
  return [rules.letters && "Letters only", rules.digits && "Numbers only", rules.noSpecial && "No special characters"].filter(Boolean).join(" · ");
}

/** Tidies an answer the way the question asks (capitals, trimmed). */
export function normalizeAnswer(field: EditorField, value: string | string[] | undefined): string | string[] | undefined {
  if (typeof value !== "string") return value;
  const trimmed = field.kind === "textarea" ? value.trim() : value.trim().replace(/\s+/g, " ");
  if (isNameQuestion(field)) return /^[\p{L}\p{M} ]*$/u.test(trimmed) ? tidyPersonName(trimmed) : trimmed;
  return rulesOf(field).uppercase ? trimmed.toLocaleUpperCase("en-PH") : field.kind === "email" ? trimmed.toLowerCase() : trimmed;
}

/** Why an answer can't be accepted, or null. `value` is already normalized. */
export function answerProblem(field: EditorField, raw: string | string[] | undefined): string | null {
  const name = field.label;
  if (field.kind === "checkbox") {
    if (raw !== undefined && (!Array.isArray(raw) || raw.some(value => !field.options.includes(value)) || new Set(raw).size !== raw.length)) return `Choose valid options for ${name}.`;
    const count = Array.isArray(raw) ? raw.length : 0;
    if (field.required && !count) return `Please answer: ${name}.`;
    if (count && field.min && count < field.min) return `Tick at least ${field.min} for ${name}.`;
    if (field.max && count > field.max) return `Tick no more than ${field.max} for ${name}.`;
    return null;
  }
  if (raw !== undefined && typeof raw !== "string") return `Check your answer to ${name}.`;
  const value = raw ?? "";
  if (field.kind === "confirm") return field.required && value !== "yes" ? `Tick to confirm: ${name}` : null;
  if (field.required && !value) return `Please answer: ${name}.`;
  if (!value) return null;
  if (value.length > 4000) return `Keep ${name} under 4,000 characters.`;
  if ((field.kind === "dropdown" || field.kind === "radio") && !field.options.includes(value)) return `Choose a valid option for ${name}.`;
  if (field.kind === "rating" && !/^[1-5]$/.test(value)) return `Choose a rating from 1 to 5 for ${name}.`;
  if (field.kind === "email") {
    if (value.length > 254 || !patterns.email.test(value)) return `Enter a valid email address for ${name}.`;
    if (field.verifyUst && !value.endsWith("@ust.edu.ph")) return `Sign in with your UST Google account for ${name}.`;
  }
  if (field.kind === "link") {
    let url: URL;
    try { url = new URL(value); } catch { return `Enter a full web address for ${name}, starting with https://`; }
    if (url.protocol !== "https:" && url.protocol !== "http:") return `Enter a web address for ${name}.`;
    const host = url.hostname.toLowerCase();
    const kinds = field.links ?? [];
    if (kinds.length && !kinds.some(kind => (kind === "drive" ? driveHosts : facebookHosts).includes(host))) return `${name} needs a ${kinds.map(kind => linkKinds[kind]).join(" or ")}.`;
  }
  if (field.kind === "text" || field.kind === "textarea") {
    const rules = rulesOf(field);
    if (isNameQuestion(field) && !personNamePattern.test(value)) return `Use letters only, with single spaces between names, in ${name}.`;
    if (rules.studentNumber && !patterns.studentNumber.test(value)) return `Enter a 10-digit student number for ${name}.`;
    if (rules.mobile && !patterns.mobile.test(value)) return `Enter an 11-digit mobile number starting with 09 for ${name}, numbers only.`;
    if (rules.letters && !patterns.letters.test(value)) return `Use letters only in ${name}.`;
    if (rules.digits && !(field.kind === "textarea" ? patterns.digitLines : patterns.digits).test(value)) return `Use numbers only in ${name}.`;
    if (rules.noSpecial && !patterns.noSpecial.test(value)) return `Remove special characters from ${name}.`;
    if (rules.hyphenOnly && !/^[\p{L}\p{M}\p{N}\s-]*$/u.test(value)) return `Use only letters, numbers, spaces or hyphens for ${name}.`;
  }
  return null;
}

/**
 * Checks the answers to a form's questions. Questions hidden by a conditional choice aren't asked, so
 * they're skipped; `scope` limits the check to some steps (the one being left).
 */
export function validateEditorAnswers(definition: EditorDefinition, answers: FormAnswers, { scope }: { scope?: string[] } = {}): string | null {
  const { visible } = resolveFlow(definition, answers);
  for (const field of definition.steps.filter(step => !scope || scope.includes(step.id)).flatMap(step => step.fields)) {
    if (isBlock(field.kind) || !visible.has(field.id)) continue;
    const problem = answerProblem(field, normalizeAnswer(field, answers[field.id]));
    if (problem) return problem;
  }
  return null;
}

/** The answers worth keeping: the questions the respondent was shown, tidied. */
export function keptAnswers(definition: EditorDefinition, answers: FormAnswers): FormAnswers {
  const { visible } = resolveFlow(definition, answers);
  const kept: FormAnswers = {};
  for (const field of definition.steps.flatMap(step => step.fields)) {
    if (isBlock(field.kind) || !visible.has(field.id)) continue;
    const value = normalizeAnswer(field, answers[field.id]);
    if (value !== undefined && value !== "" && !(Array.isArray(value) && !value.length)) kept[field.id] = value;
  }
  return kept;
}

/** The respondent's answer to a question with this identity, if the form still asks it. */
export function identityAnswer(definition: EditorDefinition, answers: FormAnswers, identity: NonNullable<EditorField["identity"]>) {
  const field = definition.steps.flatMap(step => step.fields).find(item => item.identity === identity);
  const value = field ? answers[field.id] : undefined;
  return typeof value === "string" ? value : "";
}
/** The respondent's email: the question marked as theirs, else the first email answered. */
export function respondentEmail(definition: EditorDefinition, answers: FormAnswers) {
  const marked = identityAnswer(definition, answers, "email");
  if (marked) return marked;
  const first = definition.steps.flatMap(step => step.fields).find(field => field.kind === "email" && typeof answers[field.id] === "string" && answers[field.id]);
  return first ? String(answers[first.id]) : "";
}
export { branchChoices };
