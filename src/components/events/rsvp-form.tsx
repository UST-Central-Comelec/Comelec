"use client";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { acknowledgementOf, identityAnswer, validateEditorAnswers, type EditorDefinition, type FormAnswers } from "@/lib/events/form-editor";
import { resolveFlow } from "@/lib/events/form-flow";
import { submitRsvp, type RsvpState } from "@/lib/events/rsvp-actions";
import { defaultRsvpDefinition, rsvpAcknowledgement } from "@/lib/events/rsvp";
import { EditorFields } from "./editor-fields";
import { FormAcknowledgement } from "./form-acknowledgement";

/**
 * The collaborator RSVP, drawn from the editor's definition: every question an ordinary one, and a
 * conditional choice showing its follow-ups only while it's picked. `preview` (the portal's Preview
 * form) sends nothing, lets every step be visited, and can show the acknowledgement. Laid out like the
 * Apply form: the tracker across the top, then the step's heading, its questions in one bordered group
 * (short answers side by side), and Back and Continue under a rule.
 */
const twoDigits = (value: number) => String(value).padStart(2, "0");

export function RsvpForm({ eventId, eventName, token, preview = false, definition = defaultRsvpDefinition, registrationUrl }: { eventId: string; eventName: string; token: string; preview?: boolean; definition?: EditorDefinition; registrationUrl: string }) {
  const [values, setValues] = useState<FormAnswers>({});
  const [stepId, setStepId] = useState(definition.steps[0]?.id);
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);
  const [customError, setCustomError] = useState("");
  const [state, action, pending] = useActionState<RsvpState, FormData>(submitRsvp.bind(null, eventId, token), {});
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const acknowledgement = acknowledgementOf(definition) ?? rsvpAcknowledgement;
  const flow = resolveFlow(definition, values);
  const steps = flow.steps;
  // Followed by id, so a step appearing or going earlier in the form doesn't move the respondent.
  const index = Math.max(0, steps.findIndex(item => item.id === stepId));
  const current = steps[index];
  const last = index === steps.length - 1;

  function validStep() {
    const inputs = formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('fieldset[data-active="true"] :is(input, select, textarea)');
    for (const input of inputs ?? []) if (!input.reportValidity()) return false;
    const error = validateEditorAnswers(definition, values, { scope: [current.id] });
    setCustomError(error ?? "");
    return !error;
  }
  function go(next: number) { setShowAcknowledgement(false); setStepId(steps[next].id); setCustomError(""); requestAnimationFrame(() => headingRef.current?.focus()); }

  if (state.success || (preview && showAcknowledgement)) return (
    <div className="ev-rsvp-done"><FormAcknowledgement acknowledgement={acknowledgement} eventName={eventName} name={state.name ?? identityAnswer(definition, values, "firstName")} link={state.registrationUrl ?? registrationUrl} emailNote={preview ? undefined : state.emailSent === false ? "We couldn’t send the confirmation email. Keep this page’s link." : undefined}>
      {preview && <button type="button" className="ev-button is-ghost is-back" onClick={() => setShowAcknowledgement(false)}><ArrowLeft size={16} aria-hidden="true" />Back to the form</button>}
    </FormAcknowledgement></div>
  );
  if (!current) return null;
  return <form className="ev-form ev-steps-form ev-evaluation-form ev-rsvp-form" ref={formRef} action={action} noValidate aria-busy={pending} onSubmit={event => {
    if (preview || !last || !validStep()) { event.preventDefault(); if (!preview && !last && validStep()) go(index + 1); }
  }}>
    <input type="hidden" name="answers" value={JSON.stringify(values)} />
    <div className="ev-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div className="ev-form-head"><ol className="ev-steps ev-rsvp-steps" aria-label="RSVP steps">
      {steps.map((section, position) => <li key={section.id} className={position === index ? "is-current" : position < index ? "is-done" : ""}><button type="button" disabled={pending || (!preview && position > index)} onClick={() => go(position)} aria-current={position === index ? "step" : undefined}><span className="ev-step-rail" aria-hidden="true" /><span className="ev-step-label"><b><span className="ev-sr-only">Step </span>{twoDigits(position + 1)}</b><span>{section.title}{position < index && <span className="ev-sr-only"> (done)</span>}</span></span></button></li>)}
      <li className="is-upcoming"><button type="button" disabled={!preview} onClick={() => setShowAcknowledgement(true)}><span className="ev-step-rail" aria-hidden="true" /><span className="ev-step-label"><b>{twoDigits(steps.length + 1)}</b><span>{definition.steps.at(-1)?.title ?? "Acknowledgement"}</span></span></button></li>
    </ol></div>
    <div className="ev-form-body">
      <div className="ev-evaluation-section-head"><h2 className="ev-step-title" ref={headingRef} tabIndex={-1}><small>Step {index + 1} of {steps.length + 1}</small>{current.title}</h2>{current.description && <p>{current.description}</p>}</div>
      <fieldset className="ev-group ev-rsvp-group" data-active="true" disabled={pending} key={current.id}>
        <legend className="ev-sr-only">{current.title}</legend>
        {current.kind === "privacy" && <p className="ev-privacy-link">Read the <Link href="/privacy" target="_blank" rel="noopener">Data Privacy Statement</Link> before you continue.</p>}
        <EditorFields fields={current.fields.filter(field => flow.visible.has(field.id))} values={values} onChange={(id, value) => setValues(answers => ({ ...answers, [id]: value }))} verify={{ eventId, target: "rsvp-form", preview }} columns />
      </fieldset>
      {customError && <p className="ev-field-error" role="alert">{customError}</p>}
      {state.error && <p className="ev-field-error" role="alert">{state.error} Return to earlier steps to check your answers.</p>}
      <div className="ev-form-foot ev-actions">
      {index > 0 && <button className="ev-button is-ghost" type="button" disabled={pending} onClick={() => go(index - 1)}><ArrowLeft size={15} />Back</button>}
      {last ? preview ? <button className="ev-button is-primary" type="button" onClick={() => setShowAcknowledgement(true)}>See the acknowledgement<ArrowRight size={15} /></button> : <button className="ev-button is-primary" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit RSVP"}</button> : <button className="ev-button is-primary" type="button" disabled={pending} onClick={() => { if (preview || validStep()) go(index + 1); }}>Continue<ArrowRight size={15} /></button>}
      </div>
    </div>
  </form>;
}
