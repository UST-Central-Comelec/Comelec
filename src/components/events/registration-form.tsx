"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Check, Hourglass } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { useHydrated } from "@/components/portal/portal-form";
import { colleges, programsByCollege, yearLevels, type College } from "@/lib/applications/options";
import type { RegistrationState } from "@/lib/events/actions";
import { interestLevels, MAX_ORGANIZATIONS, sexes, type Sex, type SignUpMode } from "@/lib/events/options";
import { checkRegistration, readRegistration } from "@/lib/events/schema";
import { OrganizationsInput } from "./organizations-input";

/** What the form starts with: the verified name, a commissioner's unit, or the answers given when joining the waitlist. */
export type RegistrationInitial = {
  lastName: string;
  firstName: string;
  middleInitial: string;
  studentNumber: string;
  sex: string;
  college: string;
  program: string;
  yearLevel: string;
  organizations: string[];
  interest: string;
};

const yearLevelLabels: readonly string[] = Object.values(yearLevels);
const yearLevelValue = (label: string) => Object.entries(yearLevels).find(([, text]) => text === label)?.[0] ?? "";
const sexLabels: readonly string[] = Object.values(sexes);
const sexValue = (label: string) => Object.entries(sexes).find(([, text]) => text === label)?.[0] ?? "";

/** The fields in the order they appear, for finding the first one to fix. */
const fieldOrder = ["lastName", "firstName", "middleInitial", "studentNumber", "sex", "yearLevel", "college", "program", "organizations", "interest", "consent"];

/** Uppercases a name as it's typed, keeping the cursor where it was. */
function uppercase(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const { selectionStart, selectionEnd } = input;
  input.value = input.value.toUpperCase();
  input.setSelectionRange(selectionStart, selectionEnd);
}

/** A labelled text input. `size` is how many of the grid's twelve columns it takes. */
function Field({ name, label, error, size, children }: { name: string; label: string; error?: string; size: 3 | 4 | 5; children: ReactNode }) {
  return (
    <label className={`ev-field is-${size}${error ? " has-error" : ""}`} data-field={name}>
      <span className="ev-field-label">{label}</span>
      {children}
      {error && <span className="ev-field-error">{error}</span>}
    </label>
  );
}

/** A labelled picker (src/components/combobox.tsx), which brings its own input, so the label points at it instead of wrapping it. */
function PickerField({ name, label, error, size, children }: { name: string; label: string; error?: string; size: 4 | 6; children: (labelId: string) => ReactNode }) {
  const labelId = useId();
  return (
    <div className={`ev-field is-${size}${error ? " has-error" : ""}`} data-field={name}>
      <span className="ev-field-label" id={labelId}>{label}</span>
      {children(labelId)}
      {error && <span className="ev-field-error">{error}</span>}
    </div>
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

/** Shown in place of the form once the registration is saved. */
function Saved({ event, kind, name, email }: { event: { id: string; name: string }; kind: "registered" | "waitlisted"; name: string; email: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const registered = kind === "registered";

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <section className={`ev-done${registered ? "" : " is-waitlist"}`} role="status">
      <span className="ev-done-mark" aria-hidden="true">{registered ? <Check size={22} strokeWidth={2.4} /> : <Hourglass size={20} />}</span>
      <h2 ref={headingRef} tabIndex={-1}>{registered ? <>You’re <em>registered.</em></> : <>You’re on the <em>waitlist.</em></>}</h2>
      {registered ? (
        <p>{name ? <><strong>{name}</strong>, your</> : "Your"} place at <strong>{event.name}</strong> is confirmed.{email && <> A confirmation with the event’s details is on its way to <strong>{email}</strong>.</>}</p>
      ) : (
        <p>{name ? <><strong>{name}</strong>, you’re</> : "You’re"} on the waitlist for <strong>{event.name}</strong>. Once registration opens, come back to the event’s page to register; the details you gave will already be filled in.{email && <> A confirmation is on its way to <strong>{email}</strong>.</>}</p>
      )}
      <div className="ev-actions">
        <Link className="ev-button is-ghost is-small is-back" href="/events"><ArrowLeft size={15} aria-hidden="true" />All events</Link>
        <Link className="ev-button is-ghost is-small" href={`/events/${event.id}`}>About this event<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

type FormProps = {
  /** The verified UST email the registration is saved under. */
  email: string;
  initial: RegistrationInitial;
  /** The unit of a verified account that's also a Commission Portal account: its college and this affiliation come filled in. */
  unit: string | null;
  /** They joined the waitlist before registration opened; `initial` is what they answered then. */
  fromWaitlist: boolean;
};

type Action = (state: RegistrationState, formData: FormData) => Promise<RegistrationState>;

/**
 * An event's registration, for a student who has just verified their UST Google account: the form,
 * then what came of sending it. While registration hasn't opened (`mode` is "waitlist"), the same
 * form saves a place on the waitlist. Without a verified account there's no form to show (`form` is
 * null), and `children` stand in: the request to verify, or why the event isn't taking sign-ups.
 *
 * The page renders this for every case, so it stays mounted when the page behind it changes: saving
 * a registration ends the verification, and the outcome must stay on screen rather than give way to
 * a request to verify again.
 */
export function EventRegistration({ action, event, mode, form, children }: { action: Action; event: { id: string; name: string }; mode: SignUpMode | null; form: FormProps | null; children?: ReactNode }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.submitted) return <Saved event={event} kind={state.result?.kind ?? (mode === "waitlist" ? "waitlisted" : "registered")} name={state.result?.name ?? ""} email={state.result?.email ?? ""} />;

  // Sign-ups closed while the form was open: there's nothing left to send.
  if (state?.closed) {
    return (
      <section className="ev-notice is-warn" role="alert">
        <p className="ev-eyebrow">Not sent</p>
        <h2>Sign-ups just closed.</h2>
        <p>{state.error}</p>
        <div className="ev-actions">
          <Link className="ev-button is-ghost is-small" href={`/events/${event.id}`}>About this event<ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link className="ev-button is-ghost is-small is-back" href="/events"><ArrowLeft size={15} aria-hidden="true" />All events</Link>
        </div>
      </section>
    );
  }

  if (!form || !mode) return children;
  // Keyed so a different account starts from its own details.
  return <RegistrationFields key={form.email} {...form} event={event} mode={mode} state={state} send={formAction} pending={pending} />;
}

function RegistrationFields({ event, mode, email, initial, unit, fromWaitlist, state, send, pending }: FormProps & { event: { id: string; name: string }; mode: SignUpMode; state: RegistrationState; send: (formData: FormData) => void; pending: boolean }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [handled, setHandled] = useState<RegistrationState>(undefined);
  /** Goes up each time the form is sent back with something to fix, to move focus there. */
  const [attempt, setAttempt] = useState(0);
  const [college, setCollege] = useState((colleges as readonly string[]).includes(initial.college) ? initial.college : "");
  const programs: readonly string[] = programsByCollege[college as College] ?? [];
  const [program, setProgram] = useState(programs.includes(initial.program) ? initial.program : "");
  const [yearLevel, setYearLevel] = useState<string>(yearLevels[initial.yearLevel as keyof typeof yearLevels] ?? "");
  const [sex, setSex] = useState<string>(sexes[initial.sex as Sex] ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const hydrated = useHydrated();
  const organizationsLabel = useId();
  const organizationsHint = useId();
  const interestLabel = useId();

  // When the server rejects a field, show its message beside it.
  if (state !== handled) {
    setHandled(state);
    if (state?.fieldErrors) {
      setErrors(state.fieldErrors);
      setAttempt((count) => count + 1);
    }
  }

  // Bring the first field that needs fixing into view, and put the cursor in it.
  useEffect(() => {
    if (!attempt) return;
    const field = fieldOrder.map((name) => formRef.current?.querySelector<HTMLElement>(`[data-field="${name}"].has-error`)).find(Boolean);
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.querySelector<HTMLElement>("input:not([type='hidden'])")?.focus({ preventScroll: true });
  }, [attempt]);

  const clearError = (field: string) => {
    if (!errors[field]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const onSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const formData = new FormData(submitEvent.currentTarget);
    const found = checkRegistration(readRegistration(formData));
    setErrors(found);
    if (Object.keys(found).length) return setAttempt((count) => count + 1);
    startTransition(() => send(formData));
  };

  const startUrl = `/events/${event.id}/register/start`;

  return (
    <form ref={formRef} className="ev-form" onSubmit={onSubmit} onInput={(inputEvent) => clearError((inputEvent.target as HTMLInputElement).name)} noValidate>
      <div className="ev-verified">
        <ShieldMark />
        <p>Verified as <strong>{email}</strong></p>
        <a href={startUrl} rel="nofollow">Use a different account</a>
      </div>
      {fromWaitlist && <p className="ev-note">You’re on this event’s waitlist, and registration is now open. Check the details you gave, then register to confirm your place.</p>}

      <fieldset className="ev-group">
        <legend>Your name</legend>
        <div className="ev-grid">
          <Field name="lastName" label="Last name" error={errors.lastName} size={5}>
            <input name="lastName" autoComplete="family-name" autoCapitalize="characters" maxLength={80} required onInput={uppercase} defaultValue={initial.lastName} />
          </Field>
          <Field name="firstName" label="First name" error={errors.firstName} size={4}>
            <input name="firstName" autoComplete="given-name" autoCapitalize="characters" maxLength={80} required onInput={uppercase} defaultValue={initial.firstName} />
          </Field>
          {/* Optional: the placeholder says so, since the label has no room for it. */}
          <Field name="middleInitial" label="Middle initial" error={errors.middleInitial} size={3}>
            <input name="middleInitial" autoComplete="additional-name" autoCapitalize="characters" maxLength={1} placeholder="Optional" defaultValue={initial.middleInitial} onInput={(inputEvent) => { inputEvent.currentTarget.value = inputEvent.currentTarget.value.replace(/[^\p{L}]/gu, "").toUpperCase(); }} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="ev-group">
        <legend>Student details</legend>
        <div className="ev-grid">
          <Field name="studentNumber" label="Student number" error={errors.studentNumber} size={4}>
            <input name="studentNumber" inputMode="numeric" maxLength={10} placeholder="2023123456" required defaultValue={initial.studentNumber} />
          </Field>
          <PickerField name="sex" label="Sex" error={errors.sex} size={4}>
            {(labelId) => <Combobox name="sex" options={sexLabels} value={sex} submitValue={sexValue(sex)} onChange={(next) => { setSex(next); clearError("sex"); }} placeholder="Select" pickOnly invalid={Boolean(errors.sex)} labelledBy={labelId} />}
          </PickerField>
          <PickerField name="yearLevel" label="Year level" error={errors.yearLevel} size={4}>
            {(labelId) => <Combobox name="yearLevel" options={yearLevelLabels} value={yearLevel} submitValue={yearLevelValue(yearLevel)} onChange={(next) => { setYearLevel(next); clearError("yearLevel"); }} placeholder="Select" pickOnly invalid={Boolean(errors.yearLevel)} labelledBy={labelId} />}
          </PickerField>
          <PickerField name="college" label="College or faculty" error={errors.college} size={6}>
            {(labelId) => (
              <Combobox
                name="college"
                options={colleges}
                value={college}
                onChange={(next) => {
                  if (next === college) return;
                  setCollege(next);
                  setProgram("");
                  clearError("college");
                }}
                placeholder="Type or pick your college"
                invalid={Boolean(errors.college)}
                labelledBy={labelId}
              />
            )}
          </PickerField>
          <PickerField name="program" label="Program" error={errors.program} size={6}>
            {(labelId) => (
              <Combobox
                key={college}
                name="program"
                options={programs}
                value={program}
                onChange={(next) => { setProgram(next); clearError("program"); }}
                placeholder={college ? "Type or pick your program" : "Pick a college first"}
                emptyText="No match. Try another program."
                disabled={!college}
                invalid={Boolean(errors.program)}
                labelledBy={labelId}
              />
            )}
          </PickerField>
        </div>
      </fieldset>

      <fieldset className="ev-group">
        <legend>Organization affiliation</legend>
        <div className={`ev-field${errors.organizations ? " has-error" : ""}`} data-field="organizations">
          <span className="ev-field-label" id={organizationsLabel}>Organizations you belong to<em>Optional</em></span>
          <OrganizationsInput initial={initial.organizations} labelledBy={organizationsLabel} describedBy={organizationsHint} onChange={() => clearError("organizations")} />
          {errors.organizations
            ? <span className="ev-field-error" id={organizationsHint}>{errors.organizations}</span>
            : <span className="ev-field-hint" id={organizationsHint}>{unit ? `${unit} was added from your Commission Portal account. ` : ""}Add every organization you’re part of, up to {MAX_ORGANIZATIONS}: press Enter after each one. Leave it empty if you have none.</span>}
        </div>
      </fieldset>

      <fieldset className="ev-group">
        <legend>Interest level</legend>
        <div className={`ev-field${errors.interest ? " has-error" : ""}`} data-field="interest">
          <span className="ev-field-label" id={interestLabel}>How interested are you in this event?</span>
          <div className="ev-scale" role="radiogroup" aria-labelledby={interestLabel}>
            {interestLevels.map(({ value, label }) => (
              <label className="ev-scale-option" key={value}>
                <input type="radio" name="interest" value={value} defaultChecked={initial.interest === String(value)} />
                <b>{value}</b>
                <span className="ev-scale-bars" aria-hidden="true">
                  {interestLevels.map((level) => <i key={level.value} className={level.value <= value ? "is-lit" : undefined} style={{ height: `${4 + level.value * 2}px` }} />)}
                </span>
                <span>{label}</span>
              </label>
            ))}
          </div>
          {errors.interest && <span className="ev-field-error">{errors.interest}</span>}
        </div>
      </fieldset>

      <fieldset className="ev-group">
        <legend>Data privacy</legend>
        <p className="ev-privacy">
          The organizing unit and the UST Central Comelec collect these details, with the name and UST email from your Google sign-in, to manage sign-ups for this event, contact you about it and report on who took part. Only their commissioners see them. Nothing is shared outside the commission unless the law requires it, and you can ask to correct or delete your details by emailing <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a>. <strong>Data Privacy Act of 2012 · R.A. 10173.</strong>
        </p>
        <div data-field="consent" className={errors.consent ? "has-error" : undefined}>
          <label className={`ev-consent${errors.consent ? " has-error" : ""}`}>
            <input name="consent" type="checkbox" />
            <span>I have read this, and I consent to the collection and use of my personal information for this event.</span>
          </label>
          {errors.consent && <span className="ev-field-error">{errors.consent}</span>}
        </div>
      </fieldset>

      {/* Honeypot: hidden from people, often filled in by spam bots. */}
      <div className="ev-honeypot" aria-hidden="true">
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="ev-submit">
        {state?.verificationExpired ? (
          <p className="ev-form-error" role="alert">Your UST account verification expired. <a href={startUrl} rel="nofollow">Verify again</a>, then send your registration.</p>
        ) : state?.error && !state.fieldErrors ? (
          <p className="ev-form-error" role="alert">{state.error}</p>
        ) : Object.keys(errors).length > 0 ? (
          <p className="ev-form-error" role="alert">Check the highlighted fields.</p>
        ) : null}
        <button className="ev-button is-primary" type="submit" disabled={pending || !hydrated}>
          {pending ? "Sending…" : mode === "register" ? "Register" : "Join the waitlist"}
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
