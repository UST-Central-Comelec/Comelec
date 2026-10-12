"use client";
import "./rsvp.css";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { StudentVerification } from "./student-verification";
import { EditorFields } from "./editor-fields";
import { acknowledgementOf, validateEditorAnswers, type FormAnswers } from "@/lib/events/form-editor";
import { FormAcknowledgement } from "./form-acknowledgement";
import { resolveFlow } from "@/lib/events/form-flow";
import { evaluationAcknowledgement, evaluationDefinition, type EvaluationSettings } from "@/lib/events/evaluation";
import { checkEvaluationProfile, submitEvaluation, type EvaluationProfileState } from "@/lib/events/evaluation-actions";

function Requirement({ required }: { required: boolean }) { return required ? <span className="ev-evaluation-required" aria-label="required">*</span> : <span className="ev-evaluation-optional">Optional</span>; }

/**
 * The event evaluation: the Data Privacy Consent, the profile lookup (or an anonymous response), then
 * the organizer's questions. `preview` (the portal's Preview form) sends nothing, checks no
 * registration, lets every step be visited, and can show the acknowledgement.
 */
export function EvaluationForm({ eventId, eventName, settings, preview = false }: { eventId: string; eventName: string; settings: EvaluationSettings; preview?: boolean }) {
  const [stepId, setStepId] = useState(() => evaluationDefinition(settings).steps[0].id);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [anonymous, setAnonymous] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [profileResult, setProfileResult] = useState<EvaluationProfileState | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const profileCheckInFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const [state, action, pending] = useActionState(submitEvaluation.bind(null, eventId), {});
  const busy = pending || checkingProfile;
  const needsName = !referenceCode.trim();
  const definition = evaluationDefinition(settings);
  // Questions a conditional choice leads to show only while that choice is picked; steps follow by id, so one appearing earlier doesn't move the respondent.
  const flow = resolveFlow(definition, answers);
  const steps = flow.steps;
  const step = Math.max(0, steps.findIndex(item => item.id === stepId));
  const current = steps[step];
  const lastStep = steps.length - 1;
  const acknowledgement = acknowledgementOf(definition) ?? evaluationAcknowledgement;
  const [customError, setCustomError] = useState("");
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);
  const setAnswer = (id: string, value: string | string[]) => setAnswers(current => ({ ...current, [id]: value }));

  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [stepId]);

  function go(target: number) {
    moved.current = true;
    setShowAcknowledgement(false);
    setCustomError("");
    setStepId(steps[target].id);
  }

  function validateStep() {
    const fields = formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`fieldset[data-step="${current.id}"] :is(input, textarea, select)`);
    for (const field of fields ?? []) if (!field.reportValidity()) return false;
    const error = validateEditorAnswers(definition, answers, { scope: [current.id] });
    setCustomError(error ?? "");
    return !error;
  }

  async function next() {
    if (preview) return go(Math.min(lastStep, step + 1));
    if (pending || profileCheckInFlight.current || !validateStep()) return;
    if (current.builtin === 0 && !anonymous) {
      if (!formRef.current) return;
      const profile = new FormData(formRef.current);
      profileCheckInFlight.current = true;
      setCheckingProfile(true);
      setProfileResult(null);
      try {
        const result = await checkEvaluationProfile(eventId, profile);
        setProfileResult(result);
        if (result.error || result.alreadySubmitted) return;
      } catch {
        setProfileResult({ error: "Couldn’t check your registration. Please try again before continuing." });
        return;
      } finally {
        profileCheckInFlight.current = false;
        setCheckingProfile(false);
      }
    }
    go(Math.min(lastStep, step + 1));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (pending || profileCheckInFlight.current || preview) {
      event.preventDefault();
      if (preview) void next();
      return;
    }
    if (step < lastStep) {
      event.preventDefault();
      void next();
    } else if (!validateStep()) {
      event.preventDefault();
    }
  }

  if (state.success || (preview && showAcknowledgement)) return (
    <FormAcknowledgement acknowledgement={acknowledgement} eventName={eventName} name={state.name} link={`/events/${eventId}/register`}>
      {preview ? <button type="button" className="ev-button is-ghost is-back" onClick={() => setShowAcknowledgement(false)}><ArrowLeft size={16} aria-hidden="true" />Back to the form</button> : <Link className="ev-button is-ghost is-back" href={`/events/${eventId}`}><ArrowLeft size={16} aria-hidden="true" />Back to event</Link>}
    </FormAcknowledgement>
  );

  if (state.alreadySubmitted) return (
    <section className="ev-done ev-evaluation-result" role="status">
      <span className="ev-done-mark" aria-hidden="true"><CheckCheck size={24} /></span>
      <h2>You’ve already answered.</h2>
      <p>Your evaluation for this event has already been recorded. Thank you for your feedback.</p>
      <Link className="ev-button is-ghost is-back" href={`/events/${eventId}`}><ArrowLeft size={16} aria-hidden="true" />Back to event</Link>
    </section>
  );

  if (!settings.enabled) return (
    <section className="ev-notice ev-evaluation-result">
      <span className="ev-evaluation-context-icon" aria-hidden="true"><LockKeyhole size={22} /></span>
      <h2>Evaluation is closed.</h2>
      <p>The organizers haven’t opened this event’s evaluation form yet. Please check back later.</p>
      <Link className="ev-button is-ghost is-back" href={`/events/${eventId}`}><ArrowLeft size={16} aria-hidden="true" />Back to event</Link>
    </section>
  );

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} className="ev-form ev-steps-form ev-evaluation-form" noValidate aria-busy={busy}>
      <div className="ev-form-head">
        <ol className="ev-steps" aria-label="Evaluation steps">
          {steps.map(({ title: label, id }, index) => (
            <li key={id} className={index === step ? "is-current" : index < step ? "is-done" : "is-upcoming"} aria-current={index === step ? "step" : undefined}>
              <button type="button" disabled={(!preview && index > step) || busy} onClick={() => go(index)} aria-label={`Step ${index + 1}: ${label}`}>
                <span className="ev-step-rail" aria-hidden="true" />
                <span className="ev-step-label"><b aria-hidden="true">{index < step ? <Check size={12} strokeWidth={3} /> : index + 1}</b><span>{label}</span></span>
              </button>
            </li>
          ))}
          <li className="is-upcoming"><button type="button" disabled={!preview} onClick={() => setShowAcknowledgement(true)}><span className="ev-step-rail" aria-hidden="true" /><span className="ev-step-label"><b aria-hidden="true">{steps.length + 1}</b><span>{definition.steps.at(-1)?.title ?? "Acknowledgement"}</span></span></button></li>
        </ol>
      </div>

      <div className="ev-form-body">
        <div className="ev-evaluation-section-head">
          <h2 className="ev-step-title" ref={headingRef} tabIndex={-1}><small>Step {step + 1} of {steps.length}</small>{current.title}</h2>
          <p className="ev-step-intro">{current.description}</p>
          <p className="ev-evaluation-required-note"><><span aria-hidden="true">*</span> Required fields</></p>
        </div>

        {definition.steps.filter(item => item.kind !== "acknowledgement").map(item => (
          <fieldset className="ev-group" data-step={item.id} key={item.id} hidden={current.id !== item.id} disabled={busy} onChange={item.builtin === 0 ? () => setProfileResult(null) : undefined}>
            <legend className="visually-hidden">{item.title}</legend>
            {item.kind === "privacy" && <p className="ev-privacy-link">Read the <Link href="/privacy" target="_blank" rel="noopener">Data Privacy Statement</Link> before you continue.</p>}
            {item.builtin === 0 && <>
              {settings.allowAnonymous && (
                <label className="ev-evaluation-check">
                  <input name="anonymous" type="checkbox" checked={anonymous} onChange={event => setAnonymous(event.target.checked)} />
                  <span><strong>Submit anonymously</strong><small>Share your feedback without linking it to your registration.</small></span>
                  <ShieldCheck size={22} aria-hidden="true" />
                </label>
              )}
              {anonymous ? <p className="ev-evaluation-profile-note">Your response will not contain your name or be linked to your registration.</p> : (
                <>
                  <div className="ev-grid">
                    {[["lastName", "Last name", "family-name"], ["firstName", "First name", "given-name"], ["middleName", "Middle name", "additional-name"]].map(([key, label, auto]) => (
                      <label className="ev-field" key={key}>
                        <span className="ev-field-label">{label}<Requirement required={needsName} /></span>
                        <input name={key} required={needsName && !preview} maxLength={80} autoComplete={auto} />
                      </label>
                    ))}
                  </div>
                  <label className="ev-field ev-evaluation-reference">
                    <span className="ev-field-label">Reference code<Requirement required={false} /></span>
                    <input name="referenceCode" value={referenceCode} onChange={event => setReferenceCode(event.target.value)} pattern="[A-Za-z0-9]{5}" maxLength={5} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
                  </label>
                </>
              )}
              {!anonymous && profileResult?.alreadySubmitted && (
                <div className="ev-evaluation-already" role="status">
                  <CheckCheck size={22} aria-hidden="true" />
                  <div><h3>You’ve already answered.</h3><p>Your evaluation for this event has already been recorded. Thank you for your feedback.</p></div>
                </div>
              )}
              {!anonymous && profileResult?.error && <p className="ev-field-error ev-evaluation-error" role="alert">{profileResult.error}</p>}
              {settings.requireGoogle && !preview && <><StudentVerification eventId={eventId} target="evaluate" />{anonymous && <p className="ev-field-hint">Verify your UST account to submit anonymously. Your account will not be saved with your feedback.</p>}</>}
            </>}
            <div className="ev-animated-fields ev-evaluation-fields"><EditorFields fields={item.fields} visible={flow.visible} values={answers} onChange={setAnswer} verify={{ eventId, target: "evaluate", preview }} /></div>
          </fieldset>
        ))}
        {customError && <p className="ev-field-error" role="alert">{customError}</p>}
        {state.error && <p className="ev-field-error ev-evaluation-error" role="alert">{state.error} You can return to earlier steps to correct your answers.</p>}
      </div>

      <div className="ev-form-foot ev-evaluation-nav">
        {step > 0 ? <button type="button" className="ev-button is-ghost is-back" disabled={busy} onClick={() => go(step - 1)}><ArrowLeft size={16} aria-hidden="true" />Back</button> : <span className="ev-evaluation-nav-note">Your feedback makes a difference.</span>}
        {step < lastStep ? <button type="submit" className="ev-button is-primary" disabled={busy}>{checkingProfile ? "Checking…" : "Continue"}{!checkingProfile && <ArrowRight size={16} aria-hidden="true" />}</button> : preview ? <button className="ev-button is-primary" type="button" onClick={() => setShowAcknowledgement(true)}>See the acknowledgement<ArrowRight size={16} aria-hidden="true" /></button> : <button className="ev-button is-primary" disabled={busy} type="submit">{pending ? "Submitting…" : "Submit evaluation"}{!pending && <Check size={16} aria-hidden="true" />}</button>}
      </div>
    </form>
  );
}
