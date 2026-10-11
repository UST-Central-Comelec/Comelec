import type { EditorDefinition, EditorField, EditorStep, FormAnswers } from "./form-editor";

/*
 * Conditional questions, shared by the RSVP and Evaluation forms. A question with `branches` is
 * conditional: `branches[i]` lists the questions its choice i leads to. A question some choice leads
 * to shows only while one of those choices is picked; every other question always shows. A choice
 * only leads forward in the form, so a form has no loops and one pass in order settles what shows.
 *
 * Choice questions branch on their choices. An Email question branches on the kind of address: a UST
 * one (@ust.edu.ph) or any other, so a form can ask UST respondents for their student number.
 */
type Link = { source: EditorField; option: number };

export const emailChoices = ["A UST email (@ust.edu.ph)", "Any other email"] as const;
/** The choices a question can branch on, by position. */
export const branchChoices = (field: EditorField): readonly string[] => field.kind === "email" ? emailChoices : field.kind === "radio" || field.kind === "checkbox" || field.kind === "dropdown" ? field.options : [];
export const canBranch = (field: EditorField) => branchChoices(field).length > 0;
export const isConditional = (field: EditorField) => Array.isArray(field.branches);
export const isFixedStep = (step: EditorStep) => step.kind !== undefined;

const ordered = (definition: EditorDefinition) => definition.steps.flatMap(step => step.fields);

/** Each question some choice leads to, with the choices that lead there. */
export function branchSources(definition: EditorDefinition) {
  const sources = new Map<string, Link[]>();
  for (const source of ordered(definition)) source.branches?.forEach((targets, option) => { for (const target of targets) sources.set(target, [...sources.get(target) ?? [], { source, option }]); });
  return sources;
}

/** The choices an answer picks, by position. */
export function pickedOptions(field: EditorField, answer: FormAnswers[string] | number | undefined) {
  if (field.kind === "email") {
    const value = String(answer ?? "").trim().toLowerCase();
    return !value ? [] : value.endsWith("@ust.edu.ph") ? [0] : [1];
  }
  const values = (Array.isArray(answer) ? answer : [answer]).map(value => String(value ?? "").trim());
  return field.options.flatMap((option, index) => values.includes(option.trim()) ? [index] : []);
}

/**
 * Which steps and questions a respondent fills in for these answers. The Acknowledgement isn't one
 * (it's what they see after), and a step whose questions are all hidden branches is skipped.
 */
export function resolveFlow(definition: EditorDefinition, answers: Record<string, FormAnswers[string] | number | undefined>) {
  const sources = branchSources(definition);
  const visible = new Set<string>();
  const steps: EditorStep[] = [];
  for (const step of definition.steps) {
    if (step.kind === "acknowledgement") continue;
    let shown = 0;
    for (const field of step.fields) {
      const from = sources.get(field.id);
      if (!from || from.some(({ source, option }) => visible.has(source.id) && pickedOptions(source, answers[source.id]).includes(option))) { visible.add(field.id); shown++; }
    }
    if (shown || !step.fields.length || step.builtin !== undefined || step.kind) steps.push(step);
  }
  return { steps, visible };
}

/** What's wrong with a form's links, in words for the person editing it. */
export function flowProblems(definition: EditorDefinition) {
  const fields = ordered(definition);
  const position = new Map(fields.map((field, index) => [field.id, index]));
  const problems: string[] = [];
  for (const field of fields) {
    if (!field.branches) continue;
    if (!canBranch(field)) { problems.push(`“${field.label}” can’t lead to other questions.`); continue; }
    if (field.branches.length !== branchChoices(field).length) problems.push(`Check where each choice of “${field.label}” leads.`);
    for (const target of field.branches.flat()) {
      const at = position.get(target);
      if (at === undefined || target === field.id) problems.push(`A choice of “${field.label}” leads to a question that isn’t in the form.`);
      else if (at < position.get(field.id)!) problems.push(`“${fields[at].label}” comes before “${field.label}”, which leads to it. Move it below.`);
    }
  }
  return problems;
}

/* Changes to a form, kept here so the editor and its tests make them the same way. */
const eachField = (definition: EditorDefinition, change: (field: EditorField) => EditorField): EditorDefinition => ({ ...definition, steps: definition.steps.map(step => ({ ...step, fields: step.fields.map(change) })) });

export function findField(definition: EditorDefinition, id: string) {
  for (const step of definition.steps) { const index = step.fields.findIndex(field => field.id === id); if (index >= 0) return { step, field: step.fields[index], index }; }
  return null;
}
export const patchField = (definition: EditorDefinition, id: string, patch: Partial<EditorField>) => eachField(definition, field => field.id === id ? { ...field, ...patch } : field);
export const patchStep = (definition: EditorDefinition, id: string, patch: Partial<EditorStep>): EditorDefinition => ({ ...definition, steps: definition.steps.map(step => step.id === id ? { ...step, ...patch } : step) });

/** Removes a question; choices that led to it stop leading there. */
export function removeField(definition: EditorDefinition, id: string): EditorDefinition {
  const kept = { ...definition, steps: definition.steps.map(step => ({ ...step, fields: step.fields.filter(field => field.id !== id) })) };
  return eachField(kept, field => field.branches?.some(targets => targets.includes(id)) ? { ...field, branches: field.branches.map(targets => targets.filter(target => target !== id)) } : field);
}
export function removeStep(definition: EditorDefinition, id: string): EditorDefinition {
  const step = definition.steps.find(item => item.id === id);
  let next = definition;
  for (const field of step?.fields ?? []) next = removeField(next, field.id);
  return { ...next, steps: next.steps.filter(item => item.id !== id) };
}

export function insertFields(definition: EditorDefinition, stepId: string, fields: EditorField[], afterId?: string): EditorDefinition {
  return { ...definition, steps: definition.steps.map(step => {
    if (step.id !== stepId) return step;
    const found = afterId ? step.fields.findIndex(field => field.id === afterId) : -1;
    const at = found >= 0 ? found + 1 : step.fields.length;
    return { ...step, fields: [...step.fields.slice(0, at), ...fields, ...step.fields.slice(at)] };
  }) };
}

/** How many links point backwards (a question placed above a choice leading to it). */
const backwardLinks = (definition: EditorDefinition) => flowProblems(definition).filter(problem => problem.includes("comes before")).length;
/** A change is allowed unless it puts a question above a choice that leads to it. */
export const keepsOrder = (before: EditorDefinition, after: EditorDefinition) => backwardLinks(after) <= backwardLinks(before);

/** Puts a question at a place in a step (its own or another): `index` counts the step's other questions. */
export function placeField(definition: EditorDefinition, id: string, stepId: string, index: number): EditorDefinition {
  const found = findField(definition, id);
  if (!found) return definition;
  const without = { ...definition, steps: definition.steps.map(step => ({ ...step, fields: step.fields.filter(field => field.id !== id) })) };
  return { ...without, steps: without.steps.map(step => step.id !== stepId ? step : { ...step, fields: [...step.fields.slice(0, index), found.field, ...step.fields.slice(index)] }) };
}
export function moveField(definition: EditorDefinition, id: string, direction: -1 | 1): EditorDefinition {
  const found = findField(definition, id);
  if (!found || !found.step.fields[found.index + direction]) return definition;
  return placeField(definition, id, found.step.id, found.index + direction);
}
/** Moves a step to a position; the Data Privacy Consent stays first and the Acknowledgement last. */
export function placeStep(definition: EditorDefinition, id: string, index: number): EditorDefinition {
  const step = definition.steps.find(item => item.id === id);
  if (!step || isFixedStep(step) || step.builtin === 0) return definition;
  const others = definition.steps.filter(item => item.id !== id);
  const first = others.findIndex(item => !isFixedStep(item) && item.builtin !== 0);
  const last = others.findIndex(item => item.kind === "acknowledgement");
  const at = Math.min(Math.max(index, first < 0 ? last : first), last);
  return { ...definition, steps: [...others.slice(0, at), step, ...others.slice(at)] };
}

export const followUp = (id: string, choice: string): EditorField => ({ id, label: `Follow-up: ${choice}`.slice(0, 200), prompt: "", kind: "text", required: false, options: [] });

/** Conditional on: each choice gets a new question of its own, right after this one. Off: the choices stop leading anywhere, and those questions stay as ordinary ones. */
export function setConditional(definition: EditorDefinition, id: string, on: boolean, newId: () => string): EditorDefinition {
  const found = findField(definition, id);
  if (!found) return definition;
  if (!on) return eachField(definition, field => { if (field.id !== id) return field; const copy = { ...field }; delete copy.branches; return copy; });
  const created = branchChoices(found.field).map(choice => followUp(newId(), choice));
  return insertFields(patchField(definition, id, { branches: created.map(field => [field.id]) }), found.step.id, created, id);
}
export const setBranch = (definition: EditorDefinition, id: string, option: number, targets: string[]) => eachField(definition, field => field.id === id && field.branches ? { ...field, branches: branchChoices(field).map((_, index) => index === option ? targets : field.branches?.[index] ?? []) } : field);

/** A new choice; on a conditional question it gets a new question of its own too. */
export function addChoice(definition: EditorDefinition, id: string, after: number, newId: () => string): EditorDefinition {
  const found = findField(definition, id);
  if (!found) return definition;
  const { field, step } = found;
  const text = `Option ${field.options.length + 1}`;
  const splice = <T,>(list: T[], item: T) => [...list.slice(0, after + 1), item, ...list.slice(after + 1)];
  const created = field.branches ? followUp(newId(), text) : null;
  const next = patchField(definition, id, { options: splice(field.options, text), ...(field.notes ? { notes: splice(field.notes, "") } : {}), ...(field.branches ? { branches: splice(field.branches, [created!.id]) } : {}) });
  return created ? insertFields(next, step.id, [created], field.branches?.flat().at(-1) ?? id) : next;
}
export function removeChoice(definition: EditorDefinition, id: string, index: number): EditorDefinition {
  const found = findField(definition, id);
  if (!found) return definition;
  const drop = <T,>(list: T[]) => list.filter((_, i) => i !== index);
  const { field } = found;
  const max = field.max !== undefined ? Math.min(field.max, field.options.length - 1) : undefined;
  return patchField(definition, id, { options: drop(field.options), ...(field.notes ? { notes: drop(field.notes) } : {}), ...(field.branches ? { branches: drop(field.branches) } : {}), ...(max !== undefined ? { max: Math.max(1, max), min: Math.min(field.min ?? 0, Math.max(1, max)) } : {}) });
}
