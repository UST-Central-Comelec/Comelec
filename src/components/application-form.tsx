"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert } from "lucide-react";
import { submitApplication, type ApplicationState } from "@/lib/applications/actions";
import { colleges, divisions, preferredBodies, preferredBodyDescriptions, programsByCollege, yearLevels, type College, type DivisionId, type SlotCounts } from "@/lib/applications/options";
import { checkFields, needsPortfolio, readApplication, type ApplicationField, type ApplicationValues } from "@/lib/applications/schema";
import { useHydrated } from "@/components/portal/portal-form";
import { Combobox } from "@/components/combobox";

const steps: Array<{ title: string; description: string; fields: ApplicationField[] }> = [
  { title: "About you", description: "Your name, how to reach you, and where you study.", fields: ["lastName", "firstName", "middleInitial", "studentNumber", "contactNumber", "email", "facebookUrl", "college", "program", "yearLevel"] },
  { title: "Your application", description: "Where you’d like to serve and the position you’re applying for.", fields: ["preferredBody", "division", "position"] },
  { title: "Documents", description: "Share your files as Google Drive links.", fields: ["cvUrl", "endorsementUrl", "portfolioUrl"] },
  { title: "Review and submit", description: "Check your answers, then agree to the privacy notice to submit.", fields: ["consent"] },
];

const slotLabel = (count: number) => (count < 1 ? "No slots open" : count === 1 ? "1 slot open" : `${count} slots open`);

const lastStep = steps.length - 1;

function stepOf(field: string) {
  const index = steps.findIndex((step) => step.fields.includes(field as ApplicationField));
  return index === -1 ? lastStep : index;
}

/** Uppercases a name as it's typed, keeping the cursor where it was. */
function uppercase(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const { selectionStart, selectionEnd } = input;
  input.value = input.value.toUpperCase();
  input.setSelectionRange(selectionStart, selectionEnd);
}

function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (error) return <span className="apply-field-error"><CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" />{error}</span>;
  return hint ? <span className="apply-field-hint">{hint}</span> : null;
}

/** A rounded field whose label sits inside it and floats up once the field is focused or filled. */
function Field({ label, hint, error, children, span = 8, mobileSpan, optional, select }: { label: string; hint?: string; error?: string; children: ReactNode; span?: 2 | 3 | 4 | 5 | 8; mobileSpan?: 3 | 5; optional?: boolean; select?: boolean }) {
  return (
    <label className={`apply-field span-${span}${mobileSpan ? ` m-span-${mobileSpan}` : ""}${error ? " has-error" : ""}`}>
      <span className={`apply-control${select ? " is-select" : ""}`}>
        {children}
        <span className="apply-label">{label}{optional && <em> (optional)</em>}</span>
        {select && <ChevronDown className="apply-chevron" size={16} aria-hidden="true" />}
      </span>
      <FieldMessage error={error} hint={hint} />
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="apply-group">
      <legend>{title}</legend>
      <div className="apply-grid">{children}</div>
    </fieldset>
  );
}

function ReviewSection({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: Array<[string, string]> }) {
  return (
    <section className="apply-review-section">
      <header><h3>{title}</h3><button type="button" onClick={onEdit}>Edit</button></header>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="is-empty">Not provided</span>}</dd></div>)}
      </dl>
    </section>
  );
}

export function ApplicationForm({ slots }: { slots: SlotCounts }) {
  const [state, formAction, pending] = useActionState(submitApplication, undefined);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<ApplicationValues | null>(null);
  const [college, setCollege] = useState("");
  const [program, setProgram] = useState("");
  const [division, setDivision] = useState("");
  const [position, setPosition] = useState("");
  const [handledState, setHandledState] = useState<ApplicationState>(undefined);
  const [moved, setMoved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hydrated = useHydrated();
  const programs: readonly string[] = programsByCollege[college as College] ?? [];
  const divisionPositions: Record<string, string> = divisions[division as DivisionId]?.positions ?? {};
  const portfolio = needsPortfolio(division);

  // When the server rejects a field, show its message and go back to the step that holds it.
  if (state !== handledState) {
    setHandledState(state);
    const serverErrors = state?.fieldErrors ?? {};
    const fields = Object.keys(serverErrors);
    if (fields.length) {
      setErrors(serverErrors);
      setDirection("back");
      setStep(Math.min(...fields.map(stepOf)));
    }
  }

  useEffect(() => {
    if (!moved) return;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, moved]);

  const read = () => readApplication(new FormData(formRef.current ?? undefined));

  const goTo = (target: number) => {
    setValues(read());
    setDirection(target < step ? "back" : "forward");
    setStep(target);
    setReached((current) => Math.max(current, target));
    setMoved(true);
  };

  const checkStep = (index: number) => {
    const stepErrors = checkFields(read(), steps[index].fields, slots);
    setErrors((current) => {
      const next = { ...current };
      for (const field of steps[index].fields) delete next[field];
      return { ...next, ...stepErrors };
    });
    return Object.keys(stepErrors).length === 0;
  };

  const clearError = (field: string) => {
    if (!errors[field]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkStep(step)) return;
    if (step < lastStep) return goTo(step + 1);

    // Last step: make sure no earlier step was left invalid, then send everything.
    for (let index = 0; index < lastStep; index++) {
      if (!checkStep(index)) {
        setDirection("back");
        return setStep(index);
      }
    }
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  if (state?.submitted) {
    return (
      <div className="apply-done" role="status">
        <span className="apply-done-mark"><Check size={30} strokeWidth={2.6} aria-hidden="true" /></span>
        <h1>Application received.</h1>
        <p>Thank you for stepping up. The commission will review your application and reach out through your UST email. You don’t need to do anything else for now.</p>
        <Link className="apply-button" href="/">Back to home <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    );
  }

  return (
    <form ref={formRef} className="apply-form" data-direction={direction} onSubmit={onSubmit} onInput={(event) => clearError((event.target as HTMLInputElement).name)} noValidate>
      <div className="apply-column">
        <header className="apply-intro">
          <h1>Commissioner application</h1>
          <p>Every field is required unless it’s marked optional. Questions? Email <Link href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</Link>.</p>
        </header>

        <nav aria-label="Application progress">
          <ol className="apply-steps">
            {steps.map((item, index) => {
              const status = index === step ? "is-current" : index < reached || index < step ? "is-done" : "is-upcoming";
              const reachable = index <= reached && index !== step && !pending;
              return (
                <li key={item.title} className={status}>
                  <button type="button" disabled={!reachable} onClick={() => goTo(index)} aria-current={index === step ? "step" : undefined}>
                    <span className="apply-step-bar" aria-hidden="true"><span /></span>
                    <span className="apply-step-name">
                      {status === "is-done" && <span className="apply-step-check" aria-hidden="true"><Check size={10} strokeWidth={3.4} /></span>}
                      <span className="apply-step-title">{item.title}</span>
                      {status === "is-done" && <span className="sr-only"> (completed)</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="apply-head">
          <span>Step {step + 1} of {steps.length}</span>
          <h2 ref={headingRef} tabIndex={-1}>{steps[step].title}</h2>
          <p>{steps[step].description}</p>
        </div>

        {/* Every step stays in the form so all answers are sent together; only the current one shows. */}
        <div className="apply-step" hidden={step !== 0}>
          <Group title="Name">
            <Field label="Last name" error={errors.lastName} span={3}>
              <input name="lastName" autoComplete="family-name" autoCapitalize="characters" maxLength={80} placeholder=" " required onInput={uppercase} />
            </Field>
            <Field label="First name" error={errors.firstName} span={3} mobileSpan={5}>
              <input name="firstName" autoComplete="given-name" autoCapitalize="characters" maxLength={80} placeholder=" " required onInput={uppercase} />
            </Field>
            <Field label="Middle initial" error={errors.middleInitial} span={2} mobileSpan={3}>
              <input name="middleInitial" autoComplete="additional-name" autoCapitalize="characters" maxLength={1} placeholder="M" required onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^\p{L}]/gu, "").toUpperCase(); }} />
            </Field>
          </Group>

          <Group title="Contact and student details">
            <Field label="Student number" error={errors.studentNumber} span={4}>
              <input name="studentNumber" inputMode="numeric" maxLength={10} placeholder="2023123456" />
            </Field>
            <Field label="Mobile number" error={errors.contactNumber} span={4}>
              <input name="contactNumber" type="tel" autoComplete="tel" placeholder="0917 123 4567" maxLength={16} />
            </Field>
            <Field label="UST email" error={errors.email}>
              <input name="email" type="email" autoComplete="email" placeholder="juan.delacruz.cics@ust.edu.ph" maxLength={120} />
            </Field>
            <Field label="Facebook profile link" error={errors.facebookUrl}>
              <input name="facebookUrl" type="url" inputMode="url" placeholder="facebook.com/yourname" maxLength={300} />
            </Field>
          </Group>

          <Group title="Academic details">
            <div className={`apply-field span-8${errors.college ? " has-error" : ""}`}>
              <span className="apply-control is-combobox">
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
                  labelledBy="college-label"
                  describedBy={errors.college ? "college-error" : undefined}
                />
                <span className="apply-label" id="college-label">College or faculty</span>
              </span>
              {errors.college && <span className="apply-field-error" id="college-error"><CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" />{errors.college}</span>}
            </div>
            <Field label="Program" error={errors.program} select>
              <select name="program" value={program} onChange={(event) => setProgram(event.target.value)} disabled={!college}>
                <option value="" disabled>{college ? "Select your program" : "Select a college first"}</option>
                {programs.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Year level" error={errors.yearLevel} span={4} select>
              <select name="yearLevel" defaultValue="">
                <option value="" disabled>Select</option>
                {Object.entries(yearLevels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </Group>
        </div>

        <div className="apply-step" hidden={step !== 1}>
          <div className={`apply-question${errors.preferredBody ? " has-error" : ""}`} role="radiogroup" aria-labelledby="body-label">
            <h3 id="body-label">Where would you like to serve?</h3>
            <div className="apply-tiles is-2">
              {Object.entries(preferredBodies).map(([value, label]) => (
                <label className="apply-tile" key={value}>
                  <input type="radio" name="preferredBody" value={value} />
                  <span className="apply-tile-text"><strong>{label}</strong><small>{preferredBodyDescriptions[value as keyof typeof preferredBodies]}</small></span>
                  <span className="apply-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                </label>
              ))}
            </div>
            <FieldMessage error={errors.preferredBody} />
          </div>

          <div className={`apply-question${errors.division ? " has-error" : ""}`} role="radiogroup" aria-labelledby="division-label">
            <h3 id="division-label">Where would you like to apply?</h3>
            <div className="apply-tiles is-2">
              {(Object.entries(divisions) as Array<[DivisionId, (typeof divisions)[DivisionId]]>).map(([value, item]) => {
                const count = Object.keys(item.positions).length;
                const open = Object.keys(item.positions).reduce((total, id) => total + (slots[id] ?? 0), 0);
                return (
                  <label className="apply-tile" key={value}>
                    <input type="radio" name="division" value={value} checked={division === value} onChange={() => { setDivision(value); setPosition(""); clearError("division"); clearError("position"); }} />
                    <span className="apply-tile-text"><strong>{item.label}</strong><small>{count} {count === 1 ? "position" : "positions"} · {slotLabel(open).toLowerCase()}</small></span>
                    <span className="apply-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                  </label>
                );
              })}
            </div>
            <FieldMessage error={errors.division} />
          </div>

          {division && (
            <div className={`apply-question${errors.position ? " has-error" : ""}`} role="radiogroup" aria-labelledby="position-label">
              <h3 id="position-label">Position to apply for</h3>
              <div className="apply-list">
                {Object.entries(divisionPositions).map(([value, label]) => {
                  const count = slots[value] ?? 0;
                  return (
                    <label className={`apply-list-row${count < 1 ? " is-full" : ""}`} key={value}>
                      <input type="radio" name="position" value={value} checked={position === value} disabled={count < 1} onChange={() => { setPosition(value); clearError("position"); }} />
                      <span className="apply-list-text">{label}</span>
                      <span className={`apply-slots${count < 1 ? " is-full" : ""}`}>{slotLabel(count)}</span>
                      <span className="apply-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                    </label>
                  );
                })}
              </div>
              <FieldMessage error={errors.position} />
            </div>
          )}
        </div>

        <div className="apply-step" hidden={step !== 2}>
          <fieldset className="apply-group">
            <legend>Google Drive links</legend>
            <p className="apply-note">Upload each file to Google Drive, set sharing to <strong>Anyone with the link can view</strong>, then paste the link here.</p>
            <div className="apply-grid">
              <Field label="CV or résumé" error={errors.cvUrl}>
                <input name="cvUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
              </Field>
              <Field label="Endorsement letter" error={errors.endorsementUrl} optional>
                <input name="endorsementUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
              </Field>
              <div className="span-8" hidden={!portfolio}>
                <Field label="Portfolio" hint="Required for the Public Information Division." error={errors.portfolioUrl}>
                  <input name="portfolioUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
                </Field>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="apply-step" hidden={step !== 3}>
          {values && (
            <div className="apply-review">
              <ReviewSection title="About you" onEdit={() => goTo(0)} rows={[
                ["Name", [values.lastName && `${values.lastName},`, values.firstName, values.middleInitial && `${values.middleInitial.toUpperCase()}.`].filter(Boolean).join(" ")],
                ["Student number", values.studentNumber],
                ["Mobile number", values.contactNumber],
                ["UST email", values.email],
                ["Facebook", values.facebookUrl],
                ["College or faculty", values.college],
                ["Program", values.program],
                ["Year level", yearLevels[values.yearLevel as keyof typeof yearLevels] ?? ""],
              ]} />
              <ReviewSection title="Your application" onEdit={() => goTo(1)} rows={[
                ["Serve in", preferredBodies[values.preferredBody as keyof typeof preferredBodies] ?? ""],
                ["Division", divisions[values.division as DivisionId]?.label ?? ""],
                ["Position", divisionPositions[values.position] ?? ""],
              ]} />
              <ReviewSection title="Documents" onEdit={() => goTo(2)} rows={[
                ["CV or résumé", values.cvUrl],
                ["Endorsement letter", values.endorsementUrl],
                ...(needsPortfolio(values.division) ? [["Portfolio", values.portfolioUrl] as [string, string]] : []),
              ]} />
            </div>
          )}
          <section className={`apply-privacy${errors.consent ? " has-error" : ""}`} aria-labelledby="privacy-title">
            <h3 id="privacy-title">Privacy Notice Agreement</h3>
            <p>The Central COMELEC will collect your personal information as part of the monitoring process. By providing us the needed information, you agree that we will use it for the purposes set forth in the Privacy Notice.</p>
            <label className="apply-consent">
              <input name="consent" type="checkbox" />
              <span className="apply-checkbox" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
              <span>I agree and give my consent to collect, use and process this information in pursuit of the Central COMELEC monitoring process mentioned in the privacy notice.</span>
            </label>
            <FieldMessage error={errors.consent} />
          </section>
          {state?.error && !state.fieldErrors && <p className="apply-form-error" role="alert"><CircleAlert size={16} strokeWidth={2.2} aria-hidden="true" />{state.error}</p>}
        </div>

        {/* Honeypot: hidden from people, often filled in by spam bots. */}
        <div className="apply-honeypot" aria-hidden="true">
          <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
      </div>

      <footer className="apply-bar">
        <div className="apply-bar-inner">
          {step > 0 ? (
            <button className="apply-back" type="button" onClick={() => goTo(step - 1)} disabled={pending}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
          ) : <span />}
          <button className="apply-button" type="submit" disabled={pending || !hydrated}>
            {step < lastStep ? <>Continue <ArrowRight size={16} aria-hidden="true" /></> : pending ? <><span className="apply-spinner" aria-hidden="true" /> Submitting…</> : "Submit application"}
          </button>
        </div>
      </footer>
    </form>
  );
}
