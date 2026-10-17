"use client";

import { scrollToElement, scrollToTop } from "@/lib/scroll";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Lock } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { useHydrated } from "@/components/portal/portal-form";
import { colleges, comelecUnits, programsByCollege, yearLevelsFor, programLocked, type College } from "@/lib/applications/options";
import type { RegistrationState } from "@/lib/events/actions";
import { affiliationChoices, attendingChoices, isUstAffiliation, requestKinds, sexChoices, type AffiliationChoice, type RequestKind, type SignUpMode } from "@/lib/events/options";
import { checkRegistration, emptyRegistration, needsVerification, stepOf, type RegistrationContext, type RegistrationValues } from "@/lib/events/schema";
import { CopyIcon } from "@/components/action-icons";
import { EventConsentStatement, EventFormTracker } from "./event-form-ui";
import { DraftNotice } from "@/components/draft-notice";
import { forgetFormDraft, useFormDraft } from "@/components/use-form-draft";
import "./rsvp.css";

/** The five steps, in order. */
const steps = ["Data Privacy Consent", "Personal information", "University affiliation", "Organization", "Logistics"];
const trackerSteps = steps.map((title, index) => ({ id: `step-${index}`, title }));

/**
 * Laid out like the RSVP and the Apply form: the step tracker across the page, then the step at the
 * site's width, with the event's card beside it. `current` past the last step marks the acknowledgement.
 */
function Frame({ current, preview = false, busy = false, onStep, onAcknowledgement, aside, children }: { current?: number; preview?: boolean; busy?: boolean; onStep?: (index: number) => void; onAcknowledgement?: () => void; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="apply-form ev-application-form ev-registration-form">
      {current !== undefined && <EventFormTracker steps={trackerSteps} current={current} acknowledgement="Acknowledgement" label="Registration steps" preview={preview} busy={busy} onStep={onStep ?? (() => {})} onAcknowledgement={onAcknowledgement ?? (() => {})} />}
      <div className={`apply-body ev-form-body ev-register-body${aside ? " has-side" : ""}`}>
        <div className="ev-register-main">{children}</div>
        {aside}
      </div>
    </div>
  );
}

/** What the form starts with: empty, the name from a Google sign-in, or what was given when joining the waitlist. */
export type RegistrationInitial = RegistrationValues;

/** Answers kept on this device until sent, through a reload, a dropped connection or a trip to Google. */
const draftKey = (eventId: string) => `event-registration:${eventId}`;

/** The multi-colour "G", as on the portal's sign-in button. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Solid green shield with a white check, as on the commissioner application. */
function ShieldMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A labelled input. `size` is how many of the grid's twelve columns it takes. */
function Field({ name, label, optional, error, size, children }: { name: string; label: string; optional?: boolean; error?: string; size: 3 | 4 | 5 | 6 | 9 | 12; children: ReactNode }) {
  return (
    <label className={`ev-field is-${size}${error ? " has-error" : ""}`} data-field={name}>
      <span className="ev-field-label">{label}{optional && <em>Optional</em>}</span>
      {children}
      {error && <span className="ev-field-error">{error}</span>}
    </label>
  );
}

/** A labelled picker (src/components/combobox.tsx), which brings its own input, so the label points at it instead of wrapping it. */
function PickerField({ name, label, error, size, children }: { name: string; label: string; error?: string; size: 6 | 12; children: (labelId: string) => ReactNode }) {
  const labelId = useId();
  return (
    <div className={`ev-field is-${size}${error ? " has-error" : ""}`} data-field={name}>
      <span className="ev-field-label" id={labelId}>{label}</span>
      {children(labelId)}
      {error && <span className="ev-field-error">{error}</span>}
    </div>
  );
}

/** One question answered by picking one of a few: each a card with a ring in its corner, filled solid once picked. */
function Choices<T extends string>({ name, label, options, value, onChange, error, columns = 1 }: { name: string; label: string; options: Array<[T, string]>; value: string; onChange: (value: T) => void; error?: string; columns?: 1 | 2 | 3 }) {
  const labelId = useId();
  return (
    <div className={`ev-field is-12${error ? " has-error" : ""}`} data-field={name}>
      <span className="ev-field-label" id={labelId}>{label}</span>
      <div className={`ev-choices is-${columns}`} role="radiogroup" aria-labelledby={labelId}>
        {options.map(([option, text]) => (
          <label key={option} className="ev-choice">
            <input type="radio" name={name} value={option} checked={value === option} required onChange={() => onChange(option)} />
            <span>{text}</span>
            <i className="ev-choice-ring" aria-hidden="true"><Check size={12} strokeWidth={3.2} /></i>
          </label>
        ))}
      </div>
      {error && <span className="ev-field-error">{error}</span>}
    </div>
  );
}

/** A box to tick, with what ticking it says beside it. */
function CheckRow({ name, checked, onChange, invalid, required, children }: { name: string; checked: boolean; onChange: (checked: boolean) => void; invalid?: boolean; required?: boolean; children: ReactNode }) {
  return (
    <label className={`ev-check${invalid ? " has-error" : ""}`}>
      <input name={name} type="checkbox" checked={checked} required={required} onChange={(change) => onChange(change.target.checked)} />
      <span className="ev-check-box" aria-hidden="true"><Check size={13} strokeWidth={3.2} /></span>
      <span className="ev-check-text">{children}</span>
    </label>
  );
}

/** A read-only field that says it can't be changed. */
function Locked({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="ev-field is-12">
      <span className="ev-field-label">{label}</span>
      <div className="ev-locked"><Lock size={14} aria-hidden="true" /><strong>{value}</strong><small>{note}</small></div>
    </div>
  );
}

/**
 * The Acknowledgement step, once the registration is saved: laid out like the Apply form's receipt, with
 * the reference code to copy, what was registered, and what happens next. `onBack` (View Mode) returns
 * to the form; nothing was sent, and the code is a sample.
 */
function Saved({ event, kind, name, email, referenceCode, acknowledgement, onBack }: { event: { id: string; name: string }; kind: "registered" | "waitlisted"; name: string; email: string; referenceCode?: string; acknowledgement?: "sent" | "failed"; onBack?: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  const registered = kind === "registered";

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    scrollToTop(0, { smooth: true });
  }, []);

  const copy = async () => {
    if (!referenceCode) return;
    try {
      await navigator.clipboard.writeText(referenceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the code is still on screen to copy by hand.
    }
  };

  return (
    <div className="ev-register-receipt" role="status">
      <div className="apply-body-head">
        <span>Step {steps.length + 1} of {steps.length + 1}</span>
        <h2 ref={headingRef} tabIndex={-1}>{registered ? "You’re registered." : "You’re on the waitlist."}</h2>
        {registered ? (
          <p>{name ? <><strong>{name}</strong>, your</> : "Your"} place at <strong>{event.name}</strong> is confirmed. If you asked for anything under Logistics, you’ll be emailed whether it can be arranged.</p>
        ) : (
          <p>{name ? <><strong>{name}</strong>, you’re</> : "You’re"} on the waitlist for <strong>{event.name}</strong>. Your place isn’t confirmed yet. If places become available, come back to the event’s page to register.</p>
        )}
      </div>
      {onBack && <p className="ev-callout">This is what registrants see after registering. Nothing you entered has been saved, and the reference code is a sample.</p>}

      <section className="apply-result ev-register-result" aria-label="Your registration">
        {referenceCode && (
          <div className="apply-result-code">
            <div>
              <span>Registration reference</span>
              <strong>{referenceCode}</strong>
            </div>
            <button type="button" onClick={copy}>{copied ? <><Check size={15} aria-hidden="true" />Copied</> : <><CopyIcon size={15} />Copy code</>}</button>
          </div>
        )}
        {referenceCode && <p className="apply-result-note">Keep this code to track your registration with your last name.</p>}
        <dl className="apply-result-details">
          {name && <div><dt>Registrant</dt><dd>{name}</dd></div>}
          {email && <div><dt>Email</dt><dd>{email}</dd></div>}
          <div className="is-wide"><dt>Event</dt><dd>{event.name}</dd></div>
          <div><dt>Status</dt><dd><span className={`ev-register-state${registered ? " is-ok" : ""}`}><i aria-hidden="true" />{registered ? "Registered" : "Waitlisted"}</span></dd></div>
        </dl>
        {email && acknowledgement === "sent" && <p className="apply-result-note">{registered ? "A confirmation with the event’s details" : "A confirmation"} is on its way to <strong>{email}</strong>. Check your inbox and spam folder.</p>}
        {acknowledgement === "failed" && <p className="apply-result-note">Your registration is saved, but we couldn’t send the acknowledgement to <strong>{email}</strong>. Please contact <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a> for confirmation. You don’t need to register again.</p>}
      </section>

      <footer className="apply-nav ev-form-foot ev-actions">
        {onBack ? <button className="ev-button is-ghost is-back" type="button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Back to the form</button> : <Link className="ev-button is-ghost is-back" href="/events"><ArrowLeft size={15} aria-hidden="true" />All events</Link>}
        <div className="ev-register-receipt-actions">
          <Link className="ev-button is-ghost" href={`/events/${event.id}`}>About this event<ArrowUpRight size={15} aria-hidden="true" /></Link>
          {referenceCode && !onBack && <Link className="ev-button is-primary" href={`/apply/track?ref=${referenceCode}`}>Track registration<ArrowRight size={15} aria-hidden="true" /></Link>}
        </div>
      </footer>
    </div>
  );
}

type FormProps = {
  initial: RegistrationInitial;
  /** The UST account verified through Google for this event, if any. */
  verifiedEmail: string | null;
  requireGoogle: boolean;
  /** The affiliations the event is open to, from who it's open to. */
  allowed: AffiliationChoice[];
  /** They joined the waitlist before registration opened; `initial` is what they answered then. */
  fromWaitlist: boolean;
  /** Why Google verification didn't go through, when it didn't. */
  verifyError?: string;
};

type Action = (state: RegistrationState, formData: FormData) => Promise<RegistrationState>;

/**
 * An event's registration: the form, then what came of sending it. While registration hasn't opened
 * (`mode` is "waitlist"), the same form saves a place on the waitlist. When the event isn't taking
 * sign-ups (`form` is null), `children` stand in to say why.
 */
export function EventRegistration({ action, event, mode, form, children, aside, preview = false }: { preview?: boolean; action: Action; event: { id: string; name: string }; mode: SignUpMode | null; form: FormProps | null; children?: ReactNode; aside?: ReactNode }) {
  const [state, formAction, pending] = useActionState(preview ? async () => undefined : action, undefined);
  useEffect(() => { if (state?.submitted) forgetFormDraft(draftKey(event.id)); }, [state?.submitted, event.id]);

  if (state?.submitted) return <Frame current={steps.length} busy aside={aside}><Saved event={event} kind={state.result?.kind ?? (mode === "waitlist" ? "waitlisted" : "registered")} name={state.result?.name ?? ""} email={state.result?.email ?? ""} referenceCode={state.result?.referenceCode} acknowledgement={state.result?.acknowledgement} /></Frame>;

  // Sign-ups closed while the form was open: there's nothing left to send.
  if (state?.closed) {
    return (
      <Frame aside={aside}>
      <section className="ev-notice is-warn" role="alert">
        <p className="ev-eyebrow">Not sent</p>
        <h2>Sign-ups just closed.</h2>
        <p>{state.error}</p>
        <div className="ev-actions">
          <Link className="ev-button is-ghost is-small" href={`/events/${event.id}`}>About this event<ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link className="ev-button is-ghost is-small is-back" href="/events"><ArrowLeft size={15} aria-hidden="true" />All events</Link>
        </div>
      </section>
      </Frame>
    );
  }

  if (!form || !mode) return <Frame aside={aside}>{children}</Frame>;
  return <RegistrationSteps {...form} event={event} mode={mode} preview={preview} state={state} send={formAction} pending={pending} aside={aside} />;
}

function RegistrationSteps({ event, mode, initial, verifiedEmail, requireGoogle, allowed, fromWaitlist, verifyError, state, send, pending, preview, aside }: FormProps & { event: { id: string; name: string }; mode: SignUpMode; preview: boolean; state: RegistrationState; send: (formData: FormData) => void; pending: boolean; aside?: ReactNode }) {
  const [values, setValues] = useState<RegistrationValues>(initial);
  const [step, setStep] = useState(0);
  const [previewSubmitted, setPreviewSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [handled, setHandled] = useState<RegistrationState>(undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const hydrated = useHydrated();
  const context: RegistrationContext = { allowed, requireGoogle: !preview && requireGoogle, verifiedEmail };
  const verifying = needsVerification(values, context);
  const ust = isUstAffiliation(values.affiliation);
  const programs: readonly string[] = programsByCollege[values.college as College] ?? [];
  const levels = yearLevelsFor(values.college);
  const startUrl = `/events/${event.id}/register/start`;
  const last = steps.length - 1;

  // Back from Google, a reload or a dropped connection: the answers given, on the step they left from.
  const draft = useFormDraft({
    key: preview ? null : draftKey(event.id),
    form: formRef,
    state: { step, values },
    restore: (saved) => {
      setValues({ ...emptyRegistration(), ...saved.values, ...(verifiedEmail ? { email: verifiedEmail } : {}) });
      setStep(Math.min(Math.max(0, saved.step ?? 0), last));
    },
  });

  // When the server rejects a field, show its message and go back to the step that holds it.
  if (state !== handled) {
    setHandled(state);
    const found = state?.fieldErrors ?? {};
    if (Object.keys(found).length) {
      setErrors(found);
      setStep(Math.min(...Object.keys(found).map((field) => stepOf[field] ?? 0)));
    }
  }

  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus({ preventScroll: true });
    if (formRef.current) scrollToElement(formRef.current, { smooth: true });
  }, [step]);

  const set = <K extends keyof RegistrationValues>(field: K, value: RegistrationValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => { const next = { ...current }; delete next[field]; return next; });
  };
  const upper = (field: "lastName" | "firstName" | "middleName") => (next: string) => set(field, next.toUpperCase());
  const toggle = (kind: RequestKind) => set("requests", values.requests.includes(kind) ? values.requests.filter((item) => item !== kind) : [...values.requests, kind]);

  const go = (target: number) => {
    moved.current = true;
    setStep(target);
  };

  const next = () => {
    const found = checkRegistration(values, context, step);
    // Past the affiliation, an email left for later has to be there unless a UST account fills it in.
    const email = step === 2 && !Object.keys(found).length ? checkRegistration(values, context).email : undefined;
    setErrors(email ? { email } : found);
    if (email) return go(1);
    if (!Object.keys(found).length) go(step + 1);
  };

  const onSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (preview) {
      if (step < last) go(step + 1);
      else setPreviewSubmitted(true);
      return;
    }
    if (step < last) return next();
    const found = checkRegistration(values, context);
    setErrors(found);
    if (Object.keys(found).length) return go(Math.min(...Object.keys(found).map((field) => stepOf[field] ?? 0)));
    const formData = new FormData(submitEvent.currentTarget);
    startTransition(() => send(formData));
  };

  if (previewSubmitted) return <Frame current={steps.length} preview onStep={(index) => { setPreviewSubmitted(false); setStep(index); }} aside={aside}>
    <Saved event={event} kind={mode === "waitlist" ? "waitlisted" : "registered"} name={[values.firstName, values.middleName, values.lastName].filter(Boolean).join(" ") || "JUAN SANTOS DELA CRUZ"} email={values.email || "juan.delacruz.ccs@ust.edu.ph"} referenceCode="EV-7K3M-9QXA" acknowledgement="sent" onBack={() => setPreviewSubmitted(false)} />
  </Frame>;

  const shown = (index: number) => ({ hidden: step !== index });

  return (
    <form ref={formRef} className="apply-form ev-form ev-steps-form ev-application-form ev-registration-form" onSubmit={onSubmit} noValidate data-validation={preview ? "off" : undefined} aria-busy={pending}>
      <EventFormTracker steps={trackerSteps} current={step} acknowledgement="Acknowledgement" label="Registration steps" preview={preview} busy={pending} onStep={go} onAcknowledgement={() => setPreviewSubmitted(true)} />

      <div className={`apply-body ev-form-body ev-register-body${aside ? " has-side" : ""}`}>
        <div className="ev-register-main">
        <div className="apply-body-head" key={`heading-${step}`}>
          <span>Step {step + 1} of {steps.length + 1}</span>
          <h2 ref={headingRef} tabIndex={-1}>{steps[step]}</h2>
          {step === 0 && <p>Tick the box to continue.</p>}
          {step === 4 && <p>Everything here is optional and subject to availability. You’ll be emailed whether each one you ask for is approved or not available.</p>}
        </div>
        <DraftNotice draft={draft} buttonClassName="ev-button is-ghost is-small" actionClassName="ev-button is-primary" />
        {fromWaitlist && step === 0 && <p className="ev-callout">You’re on this event’s waitlist, and registration is now open. Check the details you gave, then register to confirm your place.</p>}

        {/* 1. Consent */}
        <fieldset className="apply-group ev-group ev-register-group" {...shown(0)}>
          <legend className="ev-sr-only">{steps[0]}</legend>
          <EventConsentStatement id="registration-privacy" />
          <label className={`ev-evaluation-check ev-confirm${errors.consent ? " has-error" : ""}`} data-field="consent">
            <input name="consent" type="checkbox" required checked={values.consent} onChange={(change) => set("consent", change.target.checked)} />
            <span><strong>I have read the UST Central Comelec Data Privacy Statement and consent to the collection and processing of my personal information for this event registration.<span className="ev-evaluation-required" aria-label="required">*</span></strong></span>
          </label>
          {errors.consent && <span className="ev-field-error">{errors.consent}</span>}
        </fieldset>

        {/* 2. Personal information */}
        <fieldset className="apply-group ev-group ev-register-group" {...shown(1)}>
          <legend className="ev-sr-only">{steps[1]}</legend>
          <Field name="lastName" label="Last name" error={errors.lastName} size={4}>
            <input name="lastName" required autoComplete="family-name" autoCapitalize="characters" maxLength={80} value={values.lastName} onChange={(change) => upper("lastName")(change.target.value)} />
          </Field>
          <Field name="firstName" label="First name" error={errors.firstName} size={4}>
            <input name="firstName" required autoComplete="given-name" autoCapitalize="characters" maxLength={80} value={values.firstName} onChange={(change) => upper("firstName")(change.target.value)} />
          </Field>
          <Field name="middleName" label="Middle name" error={errors.middleName} size={4}>
            <input name="middleName" required autoComplete="additional-name" autoCapitalize="characters" maxLength={80} value={values.middleName} onChange={(change) => upper("middleName")(change.target.value)} />
          </Field>
          <Choices name="sex" label="Sex" options={Object.entries(sexChoices) as Array<[string, string]>} value={values.sex} onChange={(value) => set("sex", value)} error={errors.sex} columns={2} />
          <Field name="age" label="Age" error={errors.age} size={3}>
            <input name="age" required inputMode="numeric" maxLength={3} value={values.age} onChange={(change) => set("age", change.target.value.replace(/\D/g, ""))} />
          </Field>
          {verifying && verifiedEmail ? (
            <div className="ev-field is-9" data-field="email">
              <span className="ev-field-label">Email address</span>
              <div className="ev-locked"><ShieldMark /><strong>{verifiedEmail}</strong><small>Verified UST account</small></div>
              <input type="hidden" name="email" value={verifiedEmail} />
            </div>
          ) : (
            <Field name="email" label="Email address" error={errors.email} size={9}>
              <input name="email" type="email" autoComplete="email" maxLength={120} value={values.email} onChange={(change) => set("email", change.target.value)} placeholder={requireGoogle && allowed.some(isUstAffiliation) ? "UST students and staff can leave this empty: you’ll verify your UST account next" : undefined} />
            </Field>
          )}
        </fieldset>

        {/* 3. University affiliation */}
        <fieldset className="apply-group ev-group ev-register-group" {...shown(2)}>
          <legend className="ev-sr-only">{steps[2]}</legend>
          <Choices
            name="affiliation"
            label="Are you currently affiliated with the University of Santo Tomas?"
            options={allowed.map((choice) => [choice, affiliationChoices[choice]] as [AffiliationChoice, string])}
            value={values.affiliation}
            onChange={(value) => set("affiliation", value)}
            error={errors.affiliation}
            columns={2}
          />

          {ust && (
            verifying && !verifiedEmail ? (
              <div className={`ev-verify is-12${errors.verification ? " has-error" : ""}`} data-field="verification">
                <p><strong>Verify your UST account.</strong> This event requires UST students, faculty and staff to sign in once with their <strong>@ust.edu.ph</strong> Google account. You’ll come straight back here with your answers kept.</p>
                {verifyError && <p className="ev-form-error" role="alert">{verifyError}</p>}
                {/* A plain link: sign-in starts on the server, which sends them on to Google. */}
                <a className="ev-button is-google" href={startUrl} rel="nofollow"><GoogleMark />Continue with UST Google</a>
                {errors.verification && <span className="ev-field-error">{errors.verification}</span>}
              </div>
            ) : (
              <Locked label="University affiliation" value="University of Santo Tomas" note={verifying ? `Verified through UST Google as ${verifiedEmail}` : "Locked to your choice above"} />
            )
          )}

          {values.affiliation === "ust-student" && (
            <>
              <Field name="studentNumber" label="Student number (optional)" error={errors.studentNumber} size={6}>
                <input name="studentNumber" inputMode="numeric" maxLength={10} value={values.studentNumber} onChange={change => set("studentNumber", change.target.value)} />
              </Field>
              <PickerField name="college" label="College/Faculty" error={errors.college} size={6}>
                {(labelId) => <Combobox required name="college" options={colleges} value={values.college} onChange={(value) => { if (value !== values.college) { set("college", value); set("program", ""); set("yearLevel", ""); } }} placeholder="Type or pick your college" invalid={Boolean(errors.college)} labelledBy={labelId} />}
              </PickerField>
              <PickerField name="program" label="Program" error={errors.program} size={6}>
                {(labelId) => programLocked(values.college) ? <input value="None" readOnly aria-labelledby={labelId} /> : <Combobox required key={values.college} name="program" options={programs} value={values.program} onChange={(value) => set("program", value)} placeholder={values.college ? "Type or pick your program" : "Pick a college first"} emptyText="No match. Try another program." disabled={!values.college} invalid={Boolean(errors.program)} labelledBy={labelId} />}
              </PickerField>
              <PickerField name="yearLevel" label="Year level" error={errors.yearLevel} size={6}>
                {(labelId) => <Combobox required name="yearLevel" options={Object.values(levels)} value={levels[values.yearLevel] ?? ""} submitValue={Object.hasOwn(levels, values.yearLevel) ? values.yearLevel : ""} onChange={(label) => set("yearLevel", Object.entries(levels).find(([, value]) => value === label)?.[0] ?? "")} placeholder="Pick your year level" invalid={Boolean(errors.yearLevel)} labelledBy={labelId} />}
              </PickerField>
            </>
          )}
          {values.affiliation === "ust-staff" && (
            <Field name="office" label="College/Faculty/Office" error={errors.office} size={12}>
              <input name="office" required list={`${event.id}-offices`} maxLength={120} value={values.office} onChange={(change) => set("office", change.target.value)} placeholder="Type or pick, e.g. Office for Student Affairs" />
              <datalist id={`${event.id}-offices`}>{comelecUnits.map((unit) => <option key={unit} value={unit} />)}</datalist>
            </Field>
          )}
          {values.affiliation === "other-institution" && (
            <Field name="institution" label="University/Institution name" error={errors.institution} size={12}>
              <input name="institution" required maxLength={160} value={values.institution} onChange={(change) => set("institution", change.target.value)} />
            </Field>
          )}
          {values.affiliation === "independent" && (
            <Field name="institution" label="University/Institution name" optional error={errors.institution} size={12}>
              <input name="institution" maxLength={160} value={values.institution} onChange={(change) => set("institution", change.target.value)} placeholder="Enter “N/A” if not applicable" />
            </Field>
          )}
        </fieldset>

        {/* 4. Organization */}
        <fieldset className="apply-group ev-group ev-register-group" {...shown(3)}>
          <legend className="ev-sr-only">{steps[3]}</legend>
          <Choices name="attendingAs" label="Are you attending as:" options={Object.entries(attendingChoices) as Array<["representative" | "independent", string]>} value={values.attendingAs} onChange={(value) => set("attendingAs", value)} error={errors.attendingAs} columns={2} />
          {values.attendingAs === "representative" && (
            <>
              <Field name="organizationName" label="Organization name" error={errors.organizationName} size={12}>
                <input name="organizationName" required maxLength={160} value={values.organizationName} onChange={(change) => set("organizationName", change.target.value)} />
              </Field>
              <Field name="organizationCommittee" label="Committee/Department" optional error={errors.organizationCommittee} size={6}>
                <input name="organizationCommittee" maxLength={120} value={values.organizationCommittee} onChange={(change) => set("organizationCommittee", change.target.value)} placeholder="External Relations" />
              </Field>
              <Field name="organizationPosition" label="Position" error={errors.organizationPosition} size={6}>
                <input name="organizationPosition" required maxLength={120} value={values.organizationPosition} onChange={(change) => set("organizationPosition", change.target.value)} placeholder="Vice President for External Relations" />
              </Field>
            </>
          )}
        </fieldset>

        {/* 5. Logistics */}
        <fieldset className="apply-group ev-group ev-register-group" {...shown(4)}>
          <legend className="ev-sr-only">{steps[4]}</legend>
          <ul className="ev-checklist">
            {(Object.keys(requestKinds) as RequestKind[]).map((kind) => (
              <li key={kind} className={values.requests.includes(kind) ? "is-on" : undefined}>
                <CheckRow name={`request-${kind}`} checked={values.requests.includes(kind)} onChange={() => toggle(kind)}>{requestKinds[kind].label}</CheckRow>
                {kind === "parking" && values.requests.includes("parking") && (
                  <div className="ev-grid">
                    <Field name="parkingPlate" label="Car plate number" error={errors.parkingPlate} size={6}>
                      <input name="parkingPlate" required maxLength={20} autoCapitalize="characters" value={values.parkingPlate} onChange={(change) => set("parkingPlate", change.target.value.toUpperCase())} placeholder="ABC 1234" />
                    </Field>
                    <Field name="parkingModel" label="Model" error={errors.parkingModel} size={6}>
                      <input name="parkingModel" required maxLength={60} value={values.parkingModel} onChange={(change) => set("parkingModel", change.target.value)} placeholder="Toyota Vios" />
                    </Field>
                    <Field name="parkingColor" label="Color" error={errors.parkingColor} size={6}>
                      <input name="parkingColor" required maxLength={40} value={values.parkingColor} onChange={(change) => set("parkingColor", change.target.value)} placeholder="White" />
                    </Field>
                    <Field name="parkingArrival" label="Expected time of arrival" error={errors.parkingArrival} size={6}>
                      <input name="parkingArrival" required type="time" step={300} value={values.parkingArrival} onChange={(change) => set("parkingArrival", change.target.value)} />
                    </Field>
                  </div>
                )}
                {kind === "dietary" && values.requests.includes("dietary") && (
                  <div className="ev-grid">
                    <Field name="dietaryAllergens" label="Allergens" error={errors.dietaryAllergens} size={12}>
                      <input name="dietaryAllergens" required maxLength={300} value={values.dietaryAllergens} onChange={(change) => set("dietaryAllergens", change.target.value)} placeholder="e.g. peanuts, shellfish; vegetarian" />
                    </Field>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </fieldset>

        {/* Honeypot: hidden from people, often filled in by spam bots. */}
        <div className="ev-honeypot" aria-hidden="true">
          <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        {state?.error && !Object.keys(errors).length ? <p className="ev-form-error" role="alert">{state.error}</p> : Object.keys(errors).length > 0 ? <p className="ev-form-error" role="alert">Check the highlighted fields.</p> : null}

        <div className="apply-nav ev-form-foot ev-actions">
          {step > 0 && <button type="button" className="ev-button is-ghost is-back" onClick={() => go(step - 1)} disabled={pending}><ArrowLeft size={15} aria-hidden="true" />Back</button>}
          <button className="ev-button is-primary" type="submit" disabled={pending || !hydrated}>
            {step < last ? <>Continue<ArrowRight size={15} aria-hidden="true" /></> : <>{preview ? "See acknowledgement" : pending ? "Sending…" : mode === "register" ? "Register" : "Join the waitlist"}<ArrowUpRight size={15} aria-hidden="true" /></>}
          </button>
        </div>
        </div>
        {aside}
      </div>
    </form>
  );
}
