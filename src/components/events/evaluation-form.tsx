"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { evaluationSections, ratingLabels, type EvaluationSettings } from "@/lib/events/evaluation";
import { checkEvaluationProfile, submitEvaluation, type EvaluationProfileState } from "@/lib/events/evaluation-actions";

const stepLabels = ["Profile", "Publicity", "Feedback", "Takeaways"];
const stepDescriptions = [
  "Find your registration using your full name or the reference code in your confirmation email.",
  "Tell us how you felt about the event. Choose one response for each rating question.",
  "Let us know what worked well and what we can improve.",
  "Reflect on what you learned and what you’d like to explore next.",
];

function Requirement({ required }: { required: boolean }) {
  return required ? <span className="ev-evaluation-required" aria-label="required">*</span> : <span className="ev-evaluation-optional">Optional</span>;
}

export function EvaluationForm({ eventId, settings }: { eventId: string; settings: EvaluationSettings }) {
  const [step, setStep] = useState(0);
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
  const lastStep = evaluationSections.length - 1;

  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [step]);

  function go(target: number) {
    moved.current = true;
    setStep(target);
  }

  function validateStep() {
    const fields = formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`fieldset[data-step="${step}"] input, fieldset[data-step="${step}"] textarea`);
    for (const field of fields ?? []) if (!field.reportValidity()) return false;
    return true;
  }

  async function next() {
    if (pending || profileCheckInFlight.current || !validateStep()) return;
    if (step === 0 && !anonymous) {
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
    if (pending || profileCheckInFlight.current) {
      event.preventDefault();
      return;
    }
    if (step < lastStep) {
      event.preventDefault();
      void next();
    } else if (!validateStep()) {
      event.preventDefault();
    }
  }

  if (state.success) return (
    <section className="ev-done ev-evaluation-result" role="status">
      <span className="ev-done-mark" aria-hidden="true"><CheckCheck size={24} /></span>
      <h2>Thank you for your feedback.</h2>
      <p>Your evaluation has been recorded. Your experience helps us improve future events.</p>
      <Link className="ev-button is-ghost is-back" href={`/events/${eventId}`}><ArrowLeft size={16} aria-hidden="true" />Back to event</Link>
    </section>
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
          {evaluationSections.map((label, index) => (
            <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : "is-upcoming"} aria-current={index === step ? "step" : undefined}>
              <button type="button" disabled={index > step || busy} onClick={() => go(index)} aria-label={`Step ${index + 1}: ${label}`}>
                <span className="ev-step-rail" aria-hidden="true" />
                <span className="ev-step-label"><b aria-hidden="true">{index < step ? <Check size={12} strokeWidth={3} /> : index + 1}</b><span>{stepLabels[index]}</span></span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="ev-form-body">
        <div className="ev-evaluation-section-head">
          <h2 className="ev-step-title" ref={headingRef} tabIndex={-1}><small>Step {step + 1} of {evaluationSections.length}</small>{evaluationSections[step]}</h2>
          <p className="ev-step-intro">{stepDescriptions[step]}</p>
          <p className="ev-evaluation-required-note">{step === 2 ? "All questions in this step are optional." : <><span aria-hidden="true">*</span> Required fields</>}</p>
        </div>

        <fieldset className="ev-group" data-step="0" hidden={step !== 0} disabled={busy} onChange={() => setProfileResult(null)}>
          <legend className="visually-hidden">Profile</legend>
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
                    <input name={key} required={needsName} maxLength={80} autoComplete={auto} />
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
        </fieldset>

        {[1, 2, 3].map(section => (
          <fieldset className="ev-group" data-step={section} key={section} hidden={step !== section} disabled={busy}>
            <legend className="visually-hidden">{evaluationSections[section]}</legend>
            {settings.questions.filter(question => question.section === section).map(question => question.kind === "rating" ? (
              <fieldset className="ev-evaluation-question" key={question.id}>
                <legend>
                  <span className="ev-evaluation-question-title">{question.label}<Requirement required={question.required} /></span>
                  <span className="ev-evaluation-question-prompt">{question.prompt}</span>
                </legend>
                <div className="ev-rating-options">
                  {ratingLabels.map((label, index) => (
                    <label key={label}>
                      <input type="radio" name={question.id} value={index + 1} required={question.required} />
                      <b aria-hidden="true">{index + 1}</b>
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <div className="ev-evaluation-written" key={question.id}>
                <label className="ev-field">
                  <span className="ev-evaluation-question-title">{question.label}<Requirement required={question.required} /></span>
                  <span className="ev-evaluation-question-prompt" id={`evaluation-prompt-${question.id}`}>{question.prompt}</span>
                  <textarea name={question.id} rows={5} maxLength={4000} required={question.required} aria-describedby={`evaluation-prompt-${question.id}`} />
                </label>
                <p className="ev-evaluation-answer-hint">Up to 4,000 characters</p>
              </div>
            ))}
          </fieldset>
        ))}
        {state.error && <p className="ev-field-error ev-evaluation-error" role="alert">{state.error} You can return to earlier steps to correct your answers.</p>}
      </div>

      <div className="ev-form-foot ev-evaluation-nav">
        {step > 0 ? <button type="button" className="ev-button is-ghost is-back" disabled={busy} onClick={() => go(step - 1)}><ArrowLeft size={16} aria-hidden="true" />Back</button> : <span className="ev-evaluation-nav-note">Your feedback makes a difference.</span>}
        {step < lastStep ? <button type="submit" className="ev-button is-primary" disabled={busy}>{checkingProfile ? "Checking…" : "Continue"}{!checkingProfile && <ArrowRight size={16} aria-hidden="true" />}</button> : <button className="ev-button is-primary" disabled={busy} type="submit">{pending ? "Submitting…" : "Submit evaluation"}{!pending && <Check size={16} aria-hidden="true" />}</button>}
      </div>
    </form>
  );
}
