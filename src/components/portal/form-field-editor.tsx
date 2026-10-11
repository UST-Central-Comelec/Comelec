"use client";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, AtSign, CircleDot, Copy, Eye, Heading, ImageIcon, Link2, Minus, Plus, SquareCheck, SquareCheckBig, SquareChevronDown, Star, TextAlignStart, Trash2, Type, Upload, X, type LucideIcon } from "lucide-react";
import { ratingLabels } from "@/lib/events/evaluation";
import { answerHint, choiceKinds, fieldKinds, isBlock, linkKinds, textRules, type EditorField, type FieldKind, type LinkKind, type TextRule } from "@/lib/events/form-editor";
import { branchChoices } from "@/lib/events/form-flow";
import { uploadFormImage } from "@/lib/portal/form-image-actions";
import { Dropdown } from "./dropdown";
import { MultiDropdown } from "./multi-dropdown";
import { compress } from "./photo-input";
import { toast } from "./toast";

/** Everything a question can do to the form it's in; the editor builds these from form-flow.ts. */
export type FieldOps = {
  patch: (patch: Partial<EditorField>) => void;
  kind: (kind: FieldKind) => void;
  move: (direction: -1 | 1) => void;
  duplicate?: () => void;
  remove?: () => void;
  addChoice: (after: number) => void;
  removeChoice: (index: number) => void;
  setConditional: (on: boolean) => void;
  /** `"new"` among the targets makes a new question for the choice to lead to. */
  setBranch: (option: number, targets: string[]) => void;
};

/** What the rest of the form says about this question: where its choices may lead, and what leads to it. */
export type FieldFlow = { targets: { value: string; label: string }[]; shownWhen?: string; canBranch: boolean };

export const kindIcons: Record<FieldKind, LucideIcon> = { text: Type, textarea: TextAlignStart, email: AtSign, link: Link2, checkbox: SquareCheck, dropdown: SquareChevronDown, radio: CircleDot, rating: Star, confirm: SquareCheckBig, content: Heading, image: ImageIcon };
export const hasChoices = (kind: FieldKind) => choiceKinds.includes(kind);
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
export const MAX_CHOICES = 30;
const NEW = "__new";
const IMAGE_SIDE = 1800;

/** What a question still needs before the form can be saved. */
export function fieldProblem(item: EditorField) {
  if (item.kind === "image") return !item.image ? "Upload the image." : !item.label.trim() ? "Describe the image for people using screen readers." : null;
  const choices = hasChoices(item.kind);
  const trimmed = item.options.map(option => option.trim());
  const choiceProblem = !choices ? null : !trimmed.length ? "Add at least one choice." : trimmed.some(option => !option) ? "Fill in or remove the empty choice." : new Set(trimmed).size !== trimmed.length ? "Each choice needs different wording." : null;
  const countProblem = item.kind === "checkbox" && item.min !== undefined && item.max !== undefined && item.min > item.max ? "The minimum can’t be higher than the maximum." : null;
  return !item.label.trim() ? `Give this ${item.kind === "content" ? "text a heading" : item.kind === "confirm" ? "box its statement" : "question a title"}.` : choiceProblem ?? countProblem;
}

/** Delete buttons take the portal's shared black-then-red treatment from their label (portal.css). */
export function IconButton({ label, icon: Icon, onClick, disabled }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }) {
  return <button className="form-builder-icon" type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}><Icon size={15} aria-hidden="true" /></button>;
}

/** A square tick for one of a question's settings. */
function Tick({ label, checked, disabled, onChange, hint }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; hint?: string }) {
  return <label className={`form-builder-tick${disabled ? " is-disabled" : ""}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span></label>;
}

/** A small minus/plus counter (the Checkboxes' minimum and maximum). */
function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className="form-builder-counter" role="group" aria-label={label}>
    <span>{label}</span>
    <button type="button" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={13} aria-hidden="true" /></button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={13} aria-hidden="true" /></button>
  </div>;
}

/** Which ticks can't go together: a student number is digits, and letters only excludes numbers. */
function ruleBlocked(rule: TextRule, rules: Partial<Record<TextRule, boolean>>) {
  if (rule === "letters") return Boolean(rules.digits || rules.studentNumber);
  if (rule === "digits") return Boolean(rules.letters || rules.studentNumber);
  if (rule === "studentNumber") return Boolean(rules.letters || rules.digits);
  if (rule === "uppercase" || rule === "noSpecial") return Boolean(rules.studentNumber);
  return false;
}

/** One question's full editor, in its list card. */
export function FieldEditor({ item, ops, flow, kindOptions, canMoveUp, canMoveDown, id, fixedKind, controls }: {
  item: EditorField;
  ops: FieldOps;
  flow: FieldFlow;
  kindOptions: { value: string; label: string }[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  id: string;
  /** The Data Privacy Consent's boxes stay confirmation boxes. */
  fixedKind?: boolean;
  controls?: ReactNode;
}) {
  const Icon = kindIcons[item.kind];
  const problem = fieldProblem(item);
  if (item.kind === "image") return <ImageEditor item={item} ops={ops} canMoveUp={canMoveUp} canMoveDown={canMoveDown} problem={problem} id={id} />;
  const block = item.kind === "content";
  const confirm = item.kind === "confirm";

  return (
    <div className="form-builder-field-editor">
      {block ? (
        <label className="portal-field"><span>Heading</span><input className="portal-input" value={item.label} maxLength={200} onChange={event => ops.patch({ label: event.target.value })} /></label>
      ) : (
        <div className="form-builder-field-row">
          <label className="portal-field"><span>{confirm ? "Statement to tick" : "Question"}</span>{confirm ? <textarea className="portal-input" rows={2} value={item.label} maxLength={200} onChange={event => ops.patch({ label: event.target.value })} /> : <input className="portal-input" value={item.label} maxLength={200} autoFocus={item.label === "Untitled question"} onFocus={event => item.label === "Untitled question" && event.target.select()} onChange={event => ops.patch({ label: event.target.value })} />}</label>
          <div className="portal-field form-builder-kind"><span id={`${id}-kind`}>Type of answer</span>{fixedKind ? <p className="form-builder-fixed" aria-labelledby={`${id}-kind`}><Icon size={15} aria-hidden="true" />{fieldKinds[item.kind]}</p> : <Dropdown options={kindOptions} value={item.kind} labelledBy={`${id}-kind`} onChange={kind => ops.kind(kind as FieldKind)} />}</div>
        </div>
      )}
      {flow.shownWhen && <p className="form-builder-condition"><Eye size={14} aria-hidden="true" /><span><strong>Shown when</strong> {flow.shownWhen}</span></p>}
      <label className="portal-field"><span>{block ? "Text" : "Description"} {!block && <em>Optional</em>}</span><textarea className="portal-input" rows={2} value={item.prompt} maxLength={1000} placeholder={block ? "What respondents should read here" : "Extra detail shown under the question"} onChange={event => ops.patch({ prompt: event.target.value })} /></label>

      <AnswerSettings item={item} ops={ops} flow={flow} />
      {(hasChoices(item.kind) || (item.kind === "email" && item.branches)) && <ChoicesEditor item={item} ops={ops} flow={flow} id={id} />}

      {item.kind === "rating" && (
        <div className="form-builder-preview" aria-label="How respondents answer">
          <span className="form-builder-label">Respondents pick</span>
          <ol className="form-builder-scale">{ratingLabels.map((label, i) => <li key={label}><b>{i + 1}</b><small>{label}</small></li>)}</ol>
        </div>
      )}
      {controls}
      {problem && <p className="form-builder-problem" role="status">{problem}</p>}

      <footer className="form-builder-field-foot">
        {block ? <span className="form-builder-note">Shown as text. Nothing to answer.</span> : (
          <label className="form-builder-required">
            <span className="portal-switch"><input type="checkbox" role="switch" checked={item.required} onChange={event => ops.patch({ required: event.target.checked })} /><i aria-hidden="true" /></span>
            {confirm ? "Must be ticked" : "Required"}
          </label>
        )}
        <FieldTools item={item} ops={ops} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
      </footer>
    </div>
  );
}

function FieldTools({ item, ops, canMoveUp, canMoveDown }: { item: EditorField; ops: FieldOps; canMoveUp: boolean; canMoveDown: boolean }) {
  const noun = item.kind === "content" ? "text" : item.kind === "image" ? "image" : item.kind === "confirm" ? "box" : "question";
  return <div className="form-builder-tools">
    <IconButton label="Move up" icon={ArrowUp} disabled={!canMoveUp} onClick={() => ops.move(-1)} />
    <IconButton label="Move down" icon={ArrowDown} disabled={!canMoveDown} onClick={() => ops.move(1)} />
    <IconButton label="Duplicate" icon={Copy} disabled={!ops.duplicate} onClick={() => ops.duplicate?.()} />
    <IconButton label={ops.remove ? `Delete ${noun}` : "The consent step needs at least one box"} icon={Trash2} disabled={!ops.remove} onClick={() => ops.remove?.()} />
  </div>;
}

/** The ticks and counters each type of answer offers. */
function AnswerSettings({ item, ops, flow }: { item: EditorField; ops: FieldOps; flow: FieldFlow }) {
  const rules = item.rules ?? {};
  const setRule = (rule: TextRule, on: boolean) => ops.patch({ rules: { ...rules, [rule]: on } });
  const conditional = flow.canBranch && (
    <Tick label="Conditional" checked={Array.isArray(item.branches)} onChange={ops.setConditional} hint={item.kind === "email" ? "UST and other addresses lead to their own questions" : "Each choice leads to its own next questions"} />
  );
  let ticks: ReactNode = null;
  if (item.kind === "text" || item.kind === "textarea") {
    const offered = (Object.keys(textRules) as TextRule[]).filter(rule => rule !== "studentNumber" || item.kind === "text");
    ticks = offered.map(rule => <Tick key={rule} label={textRules[rule]} checked={Boolean(rules[rule])} disabled={!rules[rule] && ruleBlocked(rule, rules)} onChange={on => setRule(rule, on)} />);
  } else if (item.kind === "email") {
    ticks = <><Tick label="UST Google Account verification" hint="Respondents sign in with their @ust.edu.ph account to fill this in" checked={Boolean(item.verifyUst)} onChange={on => ops.patch({ verifyUst: on })} />{conditional}</>;
  } else if (item.kind === "link") {
    const kinds = item.links ?? [];
    ticks = (Object.keys(linkKinds) as LinkKind[]).map(kind => <Tick key={kind} label={linkKinds[kind]} checked={kinds.includes(kind)} onChange={on => ops.patch({ links: on ? [...kinds, kind] : kinds.filter(other => other !== kind) })} />);
  } else if (item.kind === "checkbox") {
    const count = Math.max(1, item.options.length);
    const min = item.min ?? 1, max = item.max ?? count;
    ticks = <>
      <div className="form-builder-counters">
        <Counter label="Minimum ticks" value={min} min={0} max={max} onChange={value => ops.patch({ min: value })} />
        <Counter label="Maximum ticks" value={max} min={Math.max(1, min)} max={count} onChange={value => ops.patch({ max: value })} />
      </div>
      <Tick label="Number ticks in order" hint="The first tick is the first choice, the next is 2, and so on" checked={Boolean(item.ranked)} onChange={on => ops.patch({ ranked: on })} />
      {conditional}
    </>;
  } else if (item.kind === "radio" || item.kind === "dropdown") {
    ticks = conditional;
  }
  if (!ticks) return null;
  const hint = answerHint(item);
  return <div className="form-builder-settings" role="group" aria-label="Answer settings">
    <span className="form-builder-label">Answer settings</span>
    <div className="form-builder-ticks">{ticks}</div>
    {hint && <p className="form-builder-note">Respondents see: {hint}</p>}
  </div>;
}

/** The choices of a choice question (and, when conditional, where each one leads). An Email question's two kinds of address show here too. */
function ChoicesEditor({ item, ops, flow, id }: { item: EditorField; ops: FieldOps; flow: FieldFlow; id: string }) {
  const [focusChoice, setFocusChoice] = useState<number | null>(null);
  const email = item.kind === "email";
  const choices = branchChoices(item);
  const conditional = Array.isArray(item.branches);
  const leadOptions = [...flow.targets, { value: NEW, label: "+ A new question" }];
  function addChoice(after = item.options.length - 1) {
    if (item.options.length >= MAX_CHOICES) return;
    ops.addChoice(after);
    setFocusChoice(after + 1);
  }
  return (
    <div className="form-builder-choices" role="group" aria-label={email ? "Where each kind of address leads" : "Choices"}>
      <div className="form-builder-choices-head">
        <span className="form-builder-label">{email ? "Leads to" : "Choices"}</span>
        {!email && <Tick label="Notes under choices" checked={Boolean(item.notes)} onChange={on => ops.patch({ notes: on ? item.options.map(() => "") : undefined })} />}
      </div>
      <ol>
        {choices.map((option, choice) => (
          <li key={choice}>
            <span className={`form-builder-marker is-${item.kind}`} aria-hidden="true">{item.kind === "dropdown" ? `${choice + 1}.` : null}</span>
            <div className="form-builder-choice-text">
              {email ? <p className="form-builder-fixed">{option}</p> : (
                <input
                  className="portal-input"
                  aria-label={`Choice ${choice + 1}`}
                  maxLength={200}
                  value={option}
                  ref={node => { if (node && focusChoice === choice) { node.focus(); node.select(); setFocusChoice(null); } }}
                  onChange={event => ops.patch({ options: item.options.map((text, i) => i === choice ? event.target.value : text) })}
                  onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addChoice(choice); } }}
                />
              )}
              {item.notes && !email && <textarea className="portal-input form-builder-choice-note" aria-label={`Note under choice ${choice + 1}`} maxLength={1000} rows={2} placeholder="Note under this choice (optional)" value={item.notes[choice] ?? ""} onChange={event => ops.patch({ notes: item.options.map((_, i) => i === choice ? event.target.value : item.notes?.[i] ?? "") })} />}
              {conditional && (
                <div className="form-builder-leads">
                  <span id={`${id}-lead-${choice}`}>{email ? "Then asks" : "Leads to"}</span>
                  <MultiDropdown options={leadOptions} values={item.branches?.[choice] ?? []} placeholder="The next question only" clearLabel="Lead nowhere of its own" labelledBy={`${id}-lead-${choice}`} onChange={targets => ops.setBranch(choice, targets)} />
                </div>
              )}
            </div>
            {!email && <button className="form-builder-icon" type="button" aria-label={`Remove choice ${choice + 1}`} title="Remove choice" disabled={item.options.length <= 1} onClick={() => ops.removeChoice(choice)}><X size={14} aria-hidden="true" /></button>}
          </li>
        ))}
      </ol>
      {!email && <button className="form-builder-add-choice" type="button" disabled={item.options.length >= MAX_CHOICES} onClick={() => addChoice()}><Plus size={14} aria-hidden="true" />Add choice</button>}
    </div>
  );
}

/**
 * An image block: uploaded here, shrunk in the browser first. It shows across the form's column
 * (Full width) or centred at a reading size (Medium), with its caption under it.
 */
function ImageEditor({ item, ops, canMoveUp, canMoveDown, problem, id }: { item: EditorField; ops: FieldOps; canMoveUp: boolean; canMoveDown: boolean; problem: string | null; id: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const small = await compress(file, IMAGE_SIDE);
      const form = new FormData();
      form.set("image", small);
      const result = await uploadFormImage(form);
      if (result.url) { ops.patch({ image: { url: result.url, size: item.image?.size ?? "full" } }); toast("Image uploaded."); }
      else toast(result.error ?? "Couldn’t upload the image.", "error");
    } catch {
      toast("That image is too large to shrink below 1 MB. Try a smaller one.", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="form-builder-field-editor">
      <div className={`form-builder-image${item.image ? " has-image" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Uploaded form images are already shrunk to 1 MB in the browser. */}
        {item.image ? <img src={item.image.url} alt="" /> : <span><ImageIcon size={22} aria-hidden="true" />JPG, PNG or WebP. Large pictures are shrunk to fit.</span>}
        <div className="form-builder-image-actions">
          <button type="button" className="portal-button is-small" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} aria-hidden="true" />{busy ? "Uploading…" : item.image ? "Replace image" : "Upload image"}</button>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => upload(event.target.files?.[0])} aria-label="Image file" />
        </div>
      </div>
      <label className="portal-field"><span>Describe the image <em>For screen readers</em></span><input className="portal-input" value={item.label} maxLength={200} placeholder="For example: Map of the venue’s entrances" onChange={event => ops.patch({ label: event.target.value })} /></label>
      <label className="portal-field"><span>Caption <em>Optional</em></span><input className="portal-input" value={item.prompt} maxLength={1000} placeholder="Shown under the image" onChange={event => ops.patch({ prompt: event.target.value })} /></label>
      <div className="portal-field"><span id={`${id}-size`}>Size</span>
        <div className="form-builder-segment" role="radiogroup" aria-labelledby={`${id}-size`}>
          {(["full", "medium"] as const).map(size => <button key={size} type="button" role="radio" aria-checked={(item.image?.size ?? "full") === size} disabled={!item.image} onClick={() => item.image && ops.patch({ image: { ...item.image, size } })}>{size === "full" ? "Full width" : "Medium"}</button>)}
        </div>
      </div>
      {problem && <p className="form-builder-problem" role="status">{problem}</p>}
      <footer className="form-builder-field-foot">
        <span className="form-builder-note">Shown as a picture. Nothing to answer.</span>
        <FieldTools item={item} ops={ops} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
      </footer>
    </div>
  );
}

export { isBlock };
