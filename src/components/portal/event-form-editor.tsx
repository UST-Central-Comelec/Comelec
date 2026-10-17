"use client";
import { AddIcon as ActionAddIcon } from "@/components/action-icons";
import { useId, useState, type ReactNode } from "react";
import { DndContext, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ChevronDown, GitBranch, GripVertical, LockKeyhole, Mail, RotateCcw, ShieldCheck } from "lucide-react";
import { ViewIcon as Eye, AddIcon as Plus, DeleteIcon as Trash2 } from "@/components/action-icons";
import { acknowledgementTags, fieldKinds, type Acknowledgement, type EditorDefinition, type EditorField, type EditorStep, type FieldKind } from "@/lib/events/form-editor";
import { findField, insertFields, isFixedStep, keepsOrder, patchStep, placeField, placeStep, removeStep } from "@/lib/events/form-flow";
import { FieldEditor, fieldProblem, hasChoices, IconButton, kindIcons, plural } from "./form-field-editor";
import { formTools, MAX_STEPS, newId, StepSettings, type FormTools } from "./form-editor-tools";
import { toast } from "./toast";
import "./event-form-editor.css";

const stepKey = (id: string) => `step:${id}`;
const fieldKey = (id: string) => `field:${id}`;
/** Steps that keep their place: the consent first, the evaluation's profile lookup, the acknowledgement last. */
const pinned = (step: EditorStep) => isFixedStep(step) || step.builtin === 0;

/**
 * The editor behind the RSVP and Evaluation forms, for configuring questions and steps.
 * Steps run down the left and the open step's questions on the right, each one a summary line until
 * opened. Steps and questions are reordered by dragging their grips (or with the keyboard); a
 * question dropped on a step in the list moves there. Every form starts with the Data Privacy
 * Consent and ends with the Acknowledgement (what respondents see, and are emailed, after).
 */
export function EventFormEditor({ title, value, onChange, disabled = false, resetDisabled = false, allowRating = true, defaultValue, onReset, actions, headerActions, acknowledgementDelivery = "page-and-email" }: {
  title: string;
  acknowledgementDelivery?: "page" | "page-and-email";
  value: EditorDefinition;
  onChange: (value: EditorDefinition) => void;
  disabled?: boolean;
  resetDisabled?: boolean;
  allowRating?: boolean;
  defaultValue?: EditorDefinition;
  /** Called after a reset, for settings that live outside the definition. */
  onReset?: () => void;
  /** The page's own buttons (Cancel and Save), kept on the right side of the footer. */
  actions?: ReactNode;
  headerActions?: ReactNode;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resets, setResets] = useState(0);
  const total = value.steps.reduce((sum, item) => sum + item.fields.filter(field => field.kind !== "content" && field.kind !== "image").length, 0);
  function reset() {
    if (!defaultValue || disabled || resetDisabled) return;
    onChange(defaultValue);
    onReset?.();
    setConfirmReset(false);
    setResets(count => count + 1);
  }

  return (
    <section className="form-builder" aria-label={`${title} editor`}>
      <header className="form-builder-head">
        <div>
          <h2>{title}</h2>
          <p>{plural(value.steps.length, "step")} · {plural(total, "question")}</p>
        </div>
        <div className="form-builder-head-actions">
          {headerActions}
        </div>
      </header>

      <FormsView acknowledgementDelivery={acknowledgementDelivery} key={resets} title={title} value={value} onChange={onChange} disabled={disabled} allowRating={allowRating} />
      {(defaultValue || actions) && <footer className="portal-form-footer form-builder-footer">
        <div className="form-builder-footer-reset">
          {defaultValue && (confirmReset ? (
            <div className="form-builder-reset" role="group" aria-label="Confirm reset">
              <span>Put back the default steps and questions? Your changes and added questions are removed when you save.</span>
              <button className="portal-button" type="button" disabled={disabled || resetDisabled} onClick={reset}>Reset form</button>
              <button className="portal-button is-ghost" type="button" onClick={() => setConfirmReset(false)}>Keep editing</button>
            </div>
          ) : (
            <button className="portal-button is-ghost portal-form-reset" type="button" disabled={disabled || resetDisabled} onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden="true" />Reset to default</button>
          ))}
        </div>
        {actions}
      </footer>}
    </section>
  );
}

/** The Forms editor: steps down the left, the open step's questions on the right. */
function FormsView({ title, value, onChange, disabled, allowRating, acknowledgementDelivery }: { acknowledgementDelivery: "page" | "page-and-email"; title: string; value: EditorDefinition; onChange: (value: EditorDefinition) => void; disabled: boolean; allowRating: boolean }) {
  const dndId = useId();
  const [selected, setSelected] = useState(value.steps[1]?.id ?? value.steps[0].id);
  const [open, setOpen] = useState<string | null>(null);
  const tools = formTools(value, onChange, { allowRating, onOpen: setOpen });
  const index = Math.max(0, value.steps.findIndex(step => step.id === selected));
  const step = value.steps[index];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const pick = (id: string) => { setSelected(id); setOpen(null); };
  const nameOf = (key: string) => key.startsWith("step:") ? `Step “${value.steps.find(item => stepKey(item.id) === key)?.title ?? ""}”` : `“${findField(value, key.slice(6))?.field.label ?? ""}”`;

  /** Applies a reorder unless it would put a question above a choice that leads to it. */
  function apply(next: EditorDefinition) {
    if (keepsOrder(value, next)) onChange(next);
    else toast("That would put a question above the choice that leads to it, so it stayed put.", "warn");
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || disabled) return;
    const from = String(active.id), to = String(over.id);
    if (from.startsWith("step:") && to.startsWith("step:")) apply(placeStep(value, from.slice(5), value.steps.findIndex(item => stepKey(item.id) === to)));
    else if (from.startsWith("field:")) {
      const id = from.slice(6);
      if (to.startsWith("step:")) {
        const target = value.steps.find(item => stepKey(item.id) === to);
        const moving = findField(value, id)!.field;
        if (!target || target.id === step.id) return;
        // The consent's boxes stay in it, only confirmation boxes join it, and the acknowledgement holds no questions.
        if (target.kind === "acknowledgement" || step.kind === "privacy" || (target.kind === "privacy" && moving.kind !== "confirm")) { toast(`That can’t go in “${target.title}”.`, "warn"); return; }
        apply(placeField(value, id, target.id, target.fields.length));
        if (keepsOrder(value, placeField(value, id, target.id, target.fields.length))) toast(`Moved to “${target.title}”.`);
      } else apply(placeField(value, id, step.id, step.fields.findIndex(field => fieldKey(field.id) === to)));
    }
  }

  function addStep() {
    const id = `step_${crypto.randomUUID()}`;
    const steps = [...value.steps];
    steps.splice(steps.length - 1, 0, { id, title: "New step", description: "", fields: [] });
    onChange({ ...value, steps });
    pick(id);
  }
  function addField(kind: FieldKind) {
    const id = newId();
    const label = kind === "content" ? "Heading" : kind === "image" ? "" : kind === "confirm" ? "I confirm that…" : "Untitled question";
    onChange(insertFields(value, step.id, [{ id, label, prompt: "", kind, required: kind === "confirm", options: [] }]));
    setOpen(id);
  }
  const canMoveStep = (direction: -1 | 1) => { const next = placeStep(value, step.id, index + direction); return next !== value && next.steps.indexOf(step) !== index && keepsOrder(value, next); };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: "To reorder, press Space to pick this up, use the arrow keys to move it, then press Space to drop it or Escape to cancel." },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${nameOf(String(active.id))}.`,
          onDragOver: ({ active, over }) => over ? `${nameOf(String(active.id))} is over ${nameOf(String(over.id))}.` : undefined,
          onDragEnd: ({ active, over }) => over ? `${nameOf(String(active.id))} dropped by ${nameOf(String(over.id))}.` : `${nameOf(String(active.id))} dropped.`,
          onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(String(active.id))} is back where it was.`,
        },
      }}
    >
      <div className="form-builder-grid">
        <nav className="form-builder-steps" aria-label={`${title} steps`}>
          <SortableContext items={value.steps.map(item => stepKey(item.id))} strategy={verticalListSortingStrategy}>
            <ol>{value.steps.map((item, position) => <StepTab key={item.id} step={item} position={position} current={item.id === step.id} onPick={() => pick(item.id)} />)}</ol>
          </SortableContext>
          <button className="form-builder-add-step" type="button" disabled={disabled || value.steps.length >= MAX_STEPS} onClick={addStep}><Plus size={15} aria-hidden="true" />Add step</button>
        </nav>

        <fieldset className="form-builder-panel" disabled={disabled}>
          <legend className="portal-visually-hidden">Edit step {index + 1}: {step.title}</legend>
          <div className="form-builder-step-head">
            <p className="portal-index">Step {index + 1} of {value.steps.length}{step.kind === "privacy" && <span className="form-builder-builtin"><ShieldCheck size={12} aria-hidden="true" />Always first</span>}{step.kind === "acknowledgement" && <span className="form-builder-builtin"><Mail size={12} aria-hidden="true" />Always last</span>}{step.builtin !== undefined && <span className="form-builder-builtin"><LockKeyhole size={12} aria-hidden="true" />Built-in</span>}</p>
            {!pinned(step) && (
              <div className="form-builder-tools">
                <IconButton label="Move step up" icon={ArrowUp} disabled={!canMoveStep(-1)} onClick={() => apply(placeStep(value, step.id, index - 1))} />
                <IconButton label="Move step down" icon={ArrowDown} disabled={!canMoveStep(1)} onClick={() => apply(placeStep(value, step.id, index + 1))} />
                <IconButton label="Delete step" icon={Trash2} onClick={() => { onChange(removeStep(value, step.id)); pick(value.steps[index - 1].id); }} />
              </div>
            )}
          </div>

          {step.kind === "acknowledgement" ? <AcknowledgementEditor pageOnly={acknowledgementDelivery === "page"} value={step.acknowledgement!} title={step.title} onTitle={title => onChange(patchStep(value, step.id, { title }))} onChange={acknowledgement => onChange(patchStep(value, step.id, { acknowledgement }))} /> : <>
            <StepSettings step={step} onUpdate={patch => onChange(patchStep(value, step.id, patch))} />
            <div className="form-builder-list-head">
              <h3>{step.kind === "privacy" ? "Consent boxes" : step.builtin !== undefined ? "Your questions" : "Questions"}</h3>
              <span>{step.fields.length ? plural(step.fields.length, "item") : null}</span>
            </div>
            {step.fields.length ? (
              <SortableContext items={step.fields.map(field => fieldKey(field.id))} strategy={verticalListSortingStrategy}>
                <ol className="form-builder-fields">
                  {step.fields.map(item => <FieldCard key={item.id} item={item} open={open === item.id} tools={tools} fixedKind={step.kind === "privacy"} onToggle={() => setOpen(open === item.id ? null : item.id)} />)}
                </ol>
              </SortableContext>
            ) : <p className="form-builder-empty">{step.builtin !== undefined ? "No extra questions. This step shows only its standard ones." : "No questions in this step yet."}</p>}
            <div className="form-builder-add">
              {step.kind === "privacy" ? <button className="portal-button is-ghost" type="button" disabled={!tools.roomIn(step)} onClick={() => addField("confirm")}><ActionAddIcon size={15} aria-hidden="true" />Add consent box</button> : <>
                <button className="portal-button is-ghost" type="button" disabled={!tools.roomIn(step)} onClick={() => addField(allowRating && step.fields.at(-1)?.kind === "rating" ? "rating" : "text")}><Plus size={15} aria-hidden="true" />Add question</button>
                <button className="portal-button is-ghost" type="button" disabled={!tools.roomIn(step)} onClick={() => addField("content")}><ActionAddIcon size={15} aria-hidden="true" />Add Text</button>
                <button className="portal-button is-ghost" type="button" disabled={!tools.roomIn(step)} onClick={() => addField("image")}><ActionAddIcon size={15} aria-hidden="true" />Add Image</button>
              </>}
            </div>
          </>}
        </fieldset>
      </div>
    </DndContext>
  );
}

/** The grip a step or question is dragged by (or picked up with Space). */
type Sortable = ReturnType<typeof useSortable>;
function Grip({ handle, attributes, listeners, label }: { handle: Sortable["setActivatorNodeRef"]; attributes: Sortable["attributes"]; listeners: Sortable["listeners"]; label: string }) {
  return <button type="button" className="form-builder-grip" ref={handle} {...attributes} {...listeners} aria-label={`Reorder ${label}`} title="Drag to reorder"><GripVertical size={15} aria-hidden="true" /></button>;
}

function StepTab({ step, position, current, onPick }: { step: EditorStep; position: number; current: boolean; onPick: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver, active } = useSortable({ id: stepKey(step.id), disabled: pinned(step) });
  const questions = step.fields.filter(field => field.kind !== "content" && field.kind !== "image").length;
  const dropTarget = isOver && String(active?.id).startsWith("field:");
  return (
    <li ref={setNodeRef} className={`${isDragging ? "is-dragging" : ""}${dropTarget ? " is-drop-target" : ""}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      {pinned(step) ? <span className="form-builder-grip is-pinned" aria-hidden="true">{step.kind === "privacy" ? <ShieldCheck size={14} /> : step.kind === "acknowledgement" ? <Mail size={14} /> : <LockKeyhole size={14} />}</span> : <Grip handle={setActivatorNodeRef} attributes={attributes} listeners={listeners} label={`step ${step.title}`} />}
      <button type="button" aria-current={current ? "step" : undefined} onClick={onPick}>
        <b>{position + 1}</b>
        <span>
          <strong>{step.title || "Untitled step"}</strong>
          <small>{step.kind === "acknowledgement" ? (step.acknowledgement?.email ? "Page and email" : "Page only") : step.kind === "privacy" ? `${step.fields.length} ${step.fields.length === 1 ? "box" : "boxes"}` : <>{step.builtin !== undefined && <><LockKeyhole size={11} aria-hidden="true" />Built-in{questions ? " · " : ""}</>}{(questions || step.builtin === undefined) && plural(questions, "question")}</>}</small>
        </span>
      </button>
    </li>
  );
}

/** One question in the list: its grip, a summary line, and the full editor under it while it's open. */
function FieldCard({ item, open, tools, fixedKind, onToggle }: { item: EditorField; open: boolean; tools: FormTools; fixedKind: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: fieldKey(item.id) });
  const Icon = kindIcons[item.kind];
  const block = item.kind === "content" || item.kind === "image";
  const problem = fieldProblem(item);
  const flow = tools.flow(item);
  const panelId = `form-builder-field-${item.id}`;
  return (
    <li ref={setNodeRef} className={`form-builder-field${open ? " is-open" : ""}${problem ? " has-problem" : ""}${isDragging ? " is-dragging" : ""}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <div className="form-builder-field-top">
        <Grip handle={setActivatorNodeRef} attributes={attributes} listeners={listeners} label={item.label || fieldKinds[item.kind]} />
        <button className="form-builder-field-summary" type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
          <span className="form-builder-field-number">{tools.numbers.get(item.id)}</span>
          <span className="form-builder-field-text">
            <strong>{item.label.trim() || <em>{item.kind === "image" ? "Image" : "Untitled"}</em>}{item.required && !block && <i aria-label="required">*</i>}</strong>
            <small>
              <Icon size={13} aria-hidden="true" />{fieldKinds[item.kind]}{hasChoices(item.kind) && ` · ${plural(item.options.length, "choice")}`}
              {item.branches && <span className="form-builder-field-flag"><GitBranch size={12} aria-hidden="true" />Branches</span>}
              {flow.shownWhen && <span className="form-builder-field-flag"><Eye size={12} aria-hidden="true" />Conditional</span>}
              {problem && <span className="form-builder-field-problem">Needs attention</span>}
            </small>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- Uploaded form images are already shrunk to 1 MB in the browser. */}
          {item.kind === "image" && item.image && <img className="form-builder-field-thumb" src={item.image.url} alt="" />}
          <ChevronDown className="form-builder-chevron" size={16} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="form-builder-field-body" id={panelId}>
          <FieldEditor id={panelId} item={item} ops={tools.ops(item)} flow={flow} kindOptions={tools.kindOptions} fixedKind={fixedKind} canMoveUp={tools.canMove(item.id, -1)} canMoveDown={tools.canMove(item.id, 1)} />
        </div>
      )}
    </li>
  );
}

/** The last step: the page respondents see after submitting, and the email they're sent. */
function AcknowledgementEditor({ value, title, onTitle, onChange, pageOnly = false }: { pageOnly?: boolean; value: Acknowledgement; title: string; onTitle: (title: string) => void; onChange: (value: Acknowledgement) => void }) {
  const set = (patch: Partial<Acknowledgement>) => onChange({ ...value, ...patch });
  const tags = <p className="form-builder-tags">Fill-ins: {Object.entries(acknowledgementTags).filter(([tag]) => !pageOnly || tag !== "{link}").map(([tag, meaning]) => <code key={tag} title={meaning}>{tag}</code>)}</p>;
  return <>
    <label className="portal-field form-builder-step-title"><span>Step name <em>In this editor</em></span><input className="portal-input" value={title} maxLength={200} onChange={event => onTitle(event.target.value)} /></label>
    <div className="form-builder-standard"><Mail size={16} aria-hidden="true" /><p><strong>Always the last step</strong>{pageOnly ? "Respondents see this page once their answers are saved." : "Respondents see this page once their answers are saved, and are sent the email if it’s on."}</p></div>

    <div className="form-builder-list-head"><h3>Acknowledgement page</h3></div>
    <label className="portal-field"><span>Heading</span><input className="portal-input" value={value.title} maxLength={200} onChange={event => set({ title: event.target.value })} /></label>
    <label className="portal-field"><span>Message</span><textarea className="portal-input" rows={3} value={value.message} maxLength={2000} onChange={event => set({ message: event.target.value })} /></label>
    {!pageOnly && <label className="form-builder-tick"><input type="checkbox" checked={value.link} onChange={event => set({ link: event.target.checked })} /><span><strong>Show the event’s public registration link</strong><small>A button to the registration form, for sharing with participants</small></span></label>}
    {tags}

    {!pageOnly && <><div className="form-builder-list-head"><h3>Acknowledgement email</h3></div>
    <label className="form-builder-required">
      <span className="portal-switch"><input type="checkbox" role="switch" checked={value.email} onChange={event => set({ email: event.target.checked })} /><i aria-hidden="true" /></span>
      {value.email ? "On: sent to the respondent’s email" : "Off: no email is sent"}
    </label>
    {value.email && <>
      <label className="portal-field"><span>Subject</span><input className="portal-input" value={value.subject} maxLength={200} onChange={event => set({ subject: event.target.value })} /></label>
      <label className="portal-field"><span>Message</span><textarea className="portal-input" rows={6} value={value.body} maxLength={4000} onChange={event => set({ body: event.target.value })} /></label>
      {tags}
      <p className="form-builder-note">It goes to the first email the form asks for. A form without an Email question sends none.</p>
    </>}</>}
  </>;
}
