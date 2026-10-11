"use client";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { fieldKinds, isBlock, type EditorDefinition, type EditorField, type EditorStep, type FieldKind } from "@/lib/events/form-editor";
import { addChoice, branchChoices, branchSources, canBranch, findField, followUp, insertFields, keepsOrder, moveField, patchField, removeChoice, removeField, setBranch, setConditional } from "@/lib/events/form-flow";
import { hasChoices, type FieldFlow, type FieldOps } from "./form-field-editor";

export const newId = () => `q_${crypto.randomUUID()}`;
/** Limits from editorDefinitionSchema, so the editor stops where the server would refuse. */
export const MAX_STEPS = 22;
export const MAX_FIELDS_PER_STEP = 40;
export const MAX_FIELDS = 100;

/** A question changed to another type keeps only what that type uses. */
function retype(field: EditorField, kind: FieldKind): EditorField {
  const { rules, verifyUst, links, min, max, ranked, notes } = field;
  const next: EditorField = { id: field.id, label: field.label, prompt: field.prompt, kind, required: kind === "confirm" ? true : field.required, options: [], ...(field.identity ? { identity: field.identity } : {}) };
  if (hasChoices(kind)) {
    next.options = field.options.length ? field.options : ["Option 1", "Option 2"];
    if (notes) next.notes = next.options.map((_, index) => notes[index] ?? "");
  } else next.options = [];
  if (kind === "text" || kind === "textarea") next.rules = { ...rules, ...(kind === "textarea" ? { studentNumber: false } : {}) };
  if (kind === "email" && verifyUst) next.verifyUst = verifyUst;
  if (kind === "link" && links) next.links = links;
  // New Checkboxes start at one tick, minimum and maximum, until the organizer changes them.
  if (kind === "checkbox") Object.assign(next, { min: min ?? 1, max: Math.min(max ?? 1, next.options.length), ...(ranked ? { ranked } : {}) });
  return next;
}

/**
 * What the editor needs to change a form: each question's actions, and what the rest of the form
 * says about it. All changes go through form-flow.ts, so conditional links stay right.
 */
export function formTools(value: EditorDefinition, onChange: (value: EditorDefinition) => void, { allowRating, onOpen }: { allowRating: boolean; onOpen?: (id: string) => void }) {
  const fields = value.steps.flatMap(step => step.fields);
  const fieldCount = fields.length;
  const sources = branchSources(value);
  const numbers = new Map(value.steps.flatMap((step, s) => step.fields.map((field, f) => [field.id, `${s + 1}.${f + 1}`] as const)));
  const kindOptions = (Object.keys(fieldKinds) as FieldKind[]).filter(kind => !isBlock(kind) && (allowRating || kind !== "rating")).map(kind => ({ value: kind, label: fieldKinds[kind] }));
  const roomIn = (step: EditorStep) => step.fields.length < MAX_FIELDS_PER_STEP && fieldCount < MAX_FIELDS;
  const canMove = (id: string, direction: -1 | 1) => { const next = moveField(value, id, direction); return next !== value && keepsOrder(value, next); };

  function ops(field: EditorField): FieldOps {
    const found = findField(value, field.id)!;
    const privacy = found.step.kind === "privacy";
    return {
      patch: patch => onChange(patchField(value, field.id, patch)),
      kind: kind => {
        const plain = setConditional(value, field.id, false, newId);
        onChange({ ...plain, steps: plain.steps.map(step => ({ ...step, fields: step.fields.map(item => item.id === field.id ? retype(item, kind) : item) })) });
      },
      move: direction => { const next = moveField(value, field.id, direction); if (keepsOrder(value, next)) onChange(next); },
      duplicate: !roomIn(found.step) ? undefined : () => {
        const id = newId();
        const copy: EditorField = { ...field, id, label: `${field.label} (copy)`.slice(0, 200), options: [...field.options] };
        delete copy.branches;
        delete copy.identity;
        onChange(insertFields(value, found.step.id, [copy], field.id));
        onOpen?.(id);
      },
      remove: privacy && found.step.fields.length <= 1 ? undefined : () => onChange(removeField(value, field.id)),
      addChoice: after => onChange(addChoice(value, field.id, after, newId)),
      removeChoice: index => onChange(removeChoice(value, field.id, index)),
      setConditional: on => onChange(setConditional(value, field.id, on, newId)),
      setBranch: (option, targets) => {
        if (!targets.includes("__new")) return onChange(setBranch(value, field.id, option, targets));
        const created = followUp(newId(), branchChoices(field)[option] ?? "choice");
        onChange(setBranch(insertFields(value, found.step.id, [created], field.id), field.id, option, [...targets.filter(target => target !== "__new"), created.id]));
      },
    };
  }

  function flow(field: EditorField): FieldFlow {
    const at = fields.findIndex(item => item.id === field.id);
    const from = sources.get(field.id);
    return {
      canBranch: canBranch(field),
      targets: fields.slice(at + 1).map(item => ({ value: item.id, label: `${numbers.get(item.id)}  ${item.label || "Untitled"}` })),
      shownWhen: from?.map(({ source, option }) => `“${source.label}” is “${branchChoices(source)[option]}”`).join(" or "),
    };
  }

  return { ops, flow, kindOptions, canMove, roomIn, numbers, sources, fieldCount };
}
export type FormTools = ReturnType<typeof formTools>;

/** A step's own settings: its title and instructions, and what's special about it. */
export function StepSettings({ step, onUpdate }: { step: EditorStep; onUpdate: (patch: Partial<EditorStep>) => void }) {
  return <>
    <label className="portal-field form-builder-step-title"><span>Step title</span><input className="portal-input" value={step.title} maxLength={200} required onChange={event => onUpdate({ title: event.target.value })} /></label>
    <label className="portal-field"><span>Instructions <em>Optional</em></span><textarea className="portal-input" value={step.description} maxLength={2000} rows={2} placeholder="Shown under the step title on the form" onChange={event => onUpdate({ description: event.target.value })} /></label>
    {step.kind === "privacy" && (
      <div className="form-builder-standard">
        <ShieldCheck size={16} aria-hidden="true" />
        <p><strong>Always the first step</strong>Respondents tick these boxes before anything else. A link to the Data Privacy Statement is shown above them. Only confirmation boxes go here.</p>
      </div>
    )}
    {step.builtin !== undefined && (
      <div className="form-builder-standard">
        <LockKeyhole size={16} aria-hidden="true" />
        <p><strong>This step’s standard questions come first</strong>Respondents answer them before anything you add below. They’re fixed, so the editor doesn’t list them.</p>
      </div>
    )}
  </>;
}
