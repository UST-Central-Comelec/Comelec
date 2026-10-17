"use client";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { acknowledgementOf, identityAnswer, keptAnswers, respondentEmail, validateEditorAnswers, type EditorDefinition, type FormAnswers } from "@/lib/events/form-editor";
import { resolveFlow } from "@/lib/events/form-flow";
import { checkRsvpEmail, submitRsvp, type RsvpState } from "@/lib/events/rsvp-actions";
import { defaultRsvpDefinition, normalizeRsvpDefinition, rsvpAcknowledgement } from "@/lib/events/rsvp";
import { EditorFields } from "./editor-fields";
import { FormAcknowledgement } from "./form-acknowledgement";
import { RegistrationShare } from "./registration-share";
import { emailPattern } from "@/lib/forms/input";
import { scrollToElement } from "@/lib/scroll";
import { EventConsentStatement, EventFormTracker } from "./event-form-ui";
import { DraftNotice } from "@/components/draft-notice";
import { useFormDraft } from "@/components/use-form-draft";

/**
 * The collaborator RSVP, drawn from the editor's definition: every question an ordinary one, and a
 * conditional choice showing its follow-ups only while it's picked. `preview` (View Mode
 * form) sends nothing, lets every step be visited, and can show the acknowledgement. Laid out like the
 * Apply form: the tracker across the top, then the step's heading, its questions in one bordered group
 * (short answers side by side), and Back and Continue under a rule.
 */

export function RsvpForm({ eventId, eventName, token, preview = false, definition: suppliedDefinition = defaultRsvpDefinition, registrationUrl }: { eventId: string; eventName: string; token: string; preview?: boolean; definition?: EditorDefinition; registrationUrl: string }) {
  const definition = normalizeRsvpDefinition(suppliedDefinition);
  const [values, setValues] = useState<FormAnswers>({});
  const [stepId, setStepId] = useState(definition.steps[0]?.id);
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);
  const [emailCheck, setEmailCheck] = useState<{ email: string; available?: boolean; error?: string }>();
  const [emailRetry, setEmailRetry] = useState(0);
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

  // Answers stay on this device until sent, through a reload or a dropped connection.
  const draft = useFormDraft({
    key: preview ? null : `rsvp:${eventId}:${token}`,
    form: formRef,
    state: { stepId, values },
    restore: (saved) => {
      setValues(saved.values ?? {});
      if (saved.stepId) setStepId(saved.stepId);
    },
  });
  const { clear: clearDraft } = draft;
  useEffect(() => { if (state.success) clearDraft(); }, [state.success, clearDraft]);

  const respondent = respondentEmail(definition, keptAnswers(definition, values)).trim().toLowerCase();
  const emailQuestion = definition.steps.flatMap(step => step.fields).find(field => field.identity === "email" && typeof values[field.id] === "string" && String(values[field.id]).trim().toLowerCase() === respondent)
    ?? definition.steps.flatMap(step => step.fields).find(field => field.kind === "email" && typeof values[field.id] === "string" && String(values[field.id]).trim().toLowerCase() === respondent);
  const emailStep = steps.findIndex(step => step.fields.some(field => field.id === emailQuestion?.id));
  const emailStepId = steps[emailStep]?.id;
  const emailQuestionId = emailQuestion?.id;
  const needsEmailCheck = !preview && !!respondent && emailPattern.test(respondent);
  const checked = emailCheck?.email === respondent ? emailCheck : undefined;
  const duplicateEmail = needsEmailCheck && (checked?.available === false || state.duplicateEmail === respondent);
  const emailError = duplicateEmail ? "This email already has an RSVP submission." : needsEmailCheck ? checked?.error : undefined;
  const checkingEmail = needsEmailCheck && !checked && !duplicateEmail;
  const emailBlocked = needsEmailCheck && (duplicateEmail || checked?.available !== true);
  const blockedHere = emailBlocked && (index === emailStep || last);

  useEffect(() => {
    if (!needsEmailCheck) return;
    let live = true;
    // Check while typing, with a short pause to avoid a request for each keystroke.
    const timer = setTimeout(() => startTransition(async () => {
      try {
        const result = await checkRsvpEmail(eventId, token, respondent);
        if (live) setEmailCheck({ email: respondent, ...result });
      } catch {
        if (live) setEmailCheck({ email: respondent, error: "Couldn’t check this email. Try again." });
      }
    }), 350);
    return () => { live = false; clearTimeout(timer); };
  }, [eventId, token, respondent, needsEmailCheck, emailRetry]);

  // The database also catches two simultaneous submissions. Return that conflict to its field.
  useEffect(() => {
    if (!state.duplicateEmail || state.duplicateEmail !== respondent || !emailStepId) return;
    const frame = requestAnimationFrame(() => {
      setStepId(emailStepId);
      requestAnimationFrame(() => {
        const input = formRef.current?.elements.namedItem(emailQuestionId ?? "");
        if (input instanceof HTMLInputElement) { input.focus({ preventScroll: true }); scrollToElement(input, { smooth: true, center: true }); }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [state.duplicateEmail, respondent, emailStepId, emailQuestionId]);

  function validStep() {
    if (blockedHere) return false;
    const inputs = formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('fieldset[data-active="true"] :is(input, select, textarea)');
    for (const input of inputs ?? []) if (!input.reportValidity()) return false;
    const error = validateEditorAnswers(definition, values, { scope: [current.id] });
    setCustomError(error ?? "");
    return !error;
  }
  function go(next: number) { setShowAcknowledgement(false); setStepId(steps[next].id); setCustomError(""); requestAnimationFrame(() => headingRef.current?.focus()); }

  if (state.success || (preview && showAcknowledgement)) return (
    <div className="apply-form ev-application-form">
      <EventFormTracker steps={steps} current={steps.length} acknowledgement={definition.steps.at(-1)?.title ?? "Acknowledgement"} label="RSVP steps" preview={preview} busy onStep={go} onAcknowledgement={() => setShowAcknowledgement(true)} />
      <div className="apply-body ev-form-body"><FormAcknowledgement acknowledgement={acknowledgement} eventName={eventName} name={state.name ?? identityAnswer(definition, values, "firstName")} link={state.registrationUrl ?? registrationUrl} showLink={false} details={<>{(state.referenceCode || preview) && <><p>RSVP reference: <strong>{state.referenceCode ?? "RS-7K3M-9QXA"}</strong>. Keep this code to track your RSVP with your last name.</p>{!preview && <a className="ev-button is-ghost" href={`/apply/track?ref=${state.referenceCode}`}>Track RSVP<ArrowRight size={15} aria-hidden="true" /></a>}</>}<RegistrationShare link={state.registrationUrl ?? registrationUrl} /></>} emailNote={preview ? undefined : state.emailSent === true ? "A copy of your response has been sent to your email. Check your inbox and spam folder." : state.emailSent === false ? "Your RSVP is saved, but we couldn’t email your response. Keep your RSVP reference to track it." : undefined}>
      {preview && <button type="button" className="ev-button is-ghost is-back" onClick={() => setShowAcknowledgement(false)}><ArrowLeft size={16} aria-hidden="true" />Back to the form</button>}
      </FormAcknowledgement></div>
    </div>
  );
  if (!current) return null;
  return <form className="apply-form ev-form ev-steps-form ev-evaluation-form ev-rsvp-form ev-application-form" ref={formRef} action={action} noValidate data-validation={preview ? "off" : undefined} aria-busy={pending} onSubmit={event => {
    if (preview || !last || !validStep()) { event.preventDefault(); if (!preview && !last && validStep()) go(index + 1); }
  }}>
    <input type="hidden" name="answers" value={JSON.stringify(values)} />
    <div className="ev-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <EventFormTracker steps={steps} current={index} acknowledgement={definition.steps.at(-1)?.title ?? "Acknowledgement"} label="RSVP steps" preview={preview} busy={pending} onStep={go} onAcknowledgement={() => setShowAcknowledgement(true)} />
    <div className="apply-body ev-form-body">
      <DraftNotice draft={draft} buttonClassName="ev-button is-ghost is-small" actionClassName="ev-button is-primary" />
      <div className="apply-body-head" key={`heading-${current.id}`}><span>Step {index + 1} of {steps.length + 1}</span><h2 ref={headingRef} tabIndex={-1}>{current.title}</h2>{current.description && <p>{current.description}</p>}</div>
      <fieldset className="apply-group ev-group ev-rsvp-group ev-animated-fields" data-active="true" disabled={pending} key={current.id}>
        <legend className="ev-sr-only">{current.title}</legend>
        {current.kind === "privacy" && <EventConsentStatement id="rsvp-privacy" />}
        <EditorFields fields={current.fields} visible={flow.visible} values={values} onChange={(id, value) => { if (id === emailQuestionId || definition.steps.flatMap(step => step.fields).some(field => field.id === id && field.kind === "email")) setEmailCheck(undefined); setValues(answers => ({ ...answers, [id]: value })); }} verify={{ eventId, target: "rsvp-form", preview }} fieldErrors={emailQuestion && emailError ? { [emailQuestion.id]: emailError } : undefined} fieldErrorHelp={emailQuestion && duplicateEmail ? { [emailQuestion.id]: <>To request a change or edit to your response, proceed here: <Link href="/apply/track">Tracking Application</Link>.</> } : undefined} fieldHints={emailQuestion && checkingEmail ? { [emailQuestion.id]: "Checking email…" } : undefined} columns sectionBreaks={{ rsvp_affiliation: "Affiliation", rsvp_attendance: "Attendance confirmation", rsvp_delegation: "Organization delegation" }} />
      </fieldset>
      {customError && <p className="ev-field-error" role="alert">{customError}</p>}
      {state.error && !state.duplicateEmail && <p className="ev-field-error" role="alert">{state.error}</p>}
      {checked?.error && index === emailStep && <button className="ev-button is-ghost" type="button" onClick={() => { setEmailCheck(undefined); setEmailRetry(value => value + 1); }}>Check email again</button>}
      <div className="apply-nav ev-form-foot ev-actions">
      {index > 0 && <button className="ev-button is-ghost" type="button" disabled={pending} onClick={() => go(index - 1)}><ArrowLeft size={15} />Back</button>}
      {last ? preview ? <button className="ev-button is-primary" type="button" onClick={() => setShowAcknowledgement(true)}>See the acknowledgement<ArrowRight size={15} /></button> : <button className="ev-button is-primary" type="submit" disabled={pending || blockedHere}>{pending ? "Submitting…" : "Submit RSVP"}</button> : <button className="ev-button is-primary" type="button" disabled={pending || blockedHere} onClick={() => { if (preview || validStep()) go(index + 1); }}>Continue<ArrowRight size={15} /></button>}
      </div>
    </div>
  </form>;
}
