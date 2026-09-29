"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, Clock, Copy, Eye, Mail, ShieldCheck, Target, Users } from "lucide-react";
import { submitApplication, type ApplicationState, type SubmittedApplication } from "@/lib/applications/actions";
import { forgetApplicantVerification } from "@/lib/applications/verification-actions";
import { VERIFICATION_CHANNEL, type VerificationMessage } from "@/lib/applications/verification-channel";
import { colleges, divisionDescriptions, divisions, positionDescriptions, preferredBodies, preferredBodyDescriptions, programsByCollege, yearLevels, type College, type DivisionId, type SlotCounts } from "@/lib/applications/options";
import { checkFields, needsPortfolio, readApplication, type ApplicationField, type ApplicationValues } from "@/lib/applications/schema";
import { useHydrated } from "@/components/portal/portal-form";
import { Combobox } from "@/components/combobox";
import { InterviewPicker } from "@/components/interview-picker";
import { describeSlot, type InterviewSlot } from "@/lib/applications/interview-format";

const steps: Array<{ title: string; description: string; fields: ApplicationField[] }> = [
  { title: "Consent", description: "Read how we handle your personal information, give your consent, then verify with your UST Google account.", fields: ["consent"] },
  { title: "About you", description: "Your name, how to reach you, and where you study.", fields: ["lastName", "firstName", "middleInitial", "studentNumber", "contactNumber", "email", "facebookUrl", "college", "program", "yearLevel"] },
  { title: "Your application", description: "Where you’d like to serve and the position you’re applying for.", fields: ["preferredBody", "division", "position"] },
  { title: "Documents", description: "Share your files as Google Drive links.", fields: ["cvUrl", "endorsementUrl", "portfolioUrl"] },
  { title: "Interview", description: "Pick a time for your interview with the commission. Times are in Philippine time.", fields: ["interviewSlot"] },
  { title: "Review and submit", description: "Check your answers, then submit your application.", fields: [] },
];

/** Shown in the progress tracker after the form steps, once the application is saved. */
const resultStep = steps.length;
const trackerSteps = [...steps.map((step) => step.title), "Result"];

const yearLevelLabels: readonly string[] = Object.values(yearLevels);
const yearLevelValue = (label: string) => Object.entries(yearLevels).find(([, text]) => text === label)?.[0] ?? "";

const slotLabel = (count: number) => (count < 1 ? "No slots open" : count === 1 ? "1 slot open" : `${count} slots open`);

const lastStep = steps.length - 1;

function stepOf(field: string) {
  const index = steps.findIndex((step) => step.fields.includes(field as ApplicationField));
  return index === -1 ? lastStep : index;
}

/** Red dot after a label. Every field on the form is required. */
function Required() {
  return <span className="apply-required" aria-hidden="true" />;
}

/** Uppercases a name as it's typed, keeping the cursor where it was. */
function uppercase(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const { selectionStart, selectionEnd } = input;
  input.value = input.value.toUpperCase();
  input.setSelectionRange(selectionStart, selectionEnd);
}

function Field({ label, hint, error, children, span = 4, optional }: { label: string; hint?: string; error?: string; children: ReactNode; span?: 2 | 3 | 4 | 5 | 6 | 8 | 12; optional?: boolean }) {
  return (
    <label className={`apply-field span-${span}${error ? " has-error" : ""}`}>
      <span className="apply-field-label">{label}{optional ? <em> Optional</em> : <Required />}</span>
      {children}
      {error ? <span className="apply-field-error">{error}</span> : hint ? <span className="apply-field-hint">{hint}</span> : null}
    </label>
  );
}

/** A division row: the row picks the division, and "Details" expands what the division and its positions do. */
function DivisionOption({ id, checked, onSelect, slots }: { id: DivisionId; checked: boolean; onSelect: () => void; slots: SlotCounts }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const item = divisions[id];
  const list = Object.entries(item.positions as Record<string, string>);
  const openSlots = list.reduce((total, [position]) => total + (slots[position] ?? 0), 0);
  return (
    <div className={`apply-division${checked ? " is-selected" : ""}${open ? " is-open" : ""}`}>
      <div className="apply-division-head">
        <label className="apply-division-pick">
          <input type="radio" name="division" value={id} checked={checked} onChange={onSelect} />
          <span className="apply-division-mark" aria-hidden="true" />
          <span className="apply-choice-text"><strong>{item.label}</strong><small>{list.length} {list.length === 1 ? "position" : "positions"} · {slotLabel(openSlots).toLowerCase()}</small></span>
        </label>
        <button type="button" className="apply-division-toggle" aria-expanded={open} aria-controls={detailsId} aria-label={`${item.label} details`} onClick={() => setOpen(!open)}>
          <span>{open ? "Hide" : "Details"}</span><ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="apply-division-details" id={detailsId} inert={!open}>
        <div>
          <p>{divisionDescriptions[id]}</p>
          <ul>
            {list.map(([position, label]) => (
              <li key={position}><strong>{label}</strong>{positionDescriptions[position] && <span>{positionDescriptions[position]}</span>}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const formatSubmitted = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Step 6: confirms the application and hands over the reference code for tracking. */
function ApplicationResult({ result, preview, onRestart }: { result?: SubmittedApplication; preview?: boolean; onRestart?: () => void }) {
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.referenceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the code is still on screen to copy by hand.
    }
  };

  return (
    <div className="apply-body" role="status">
      <div className="apply-body-head">
        <span>Step {resultStep + 1} of {trackerSteps.length}</span>
        <h2 ref={headingRef} tabIndex={-1}>Application received</h2>
        <p>Thank you for stepping up. The commission will review your application and reach out through your UST email.</p>
      </div>
      {preview && <ViewModeNote>This is what applicants see after submitting. Nothing was saved, and the reference code is a sample.</ViewModeNote>}

      {result && (
        <section className="apply-result" aria-label="Your application">
          <div className="apply-result-code">
            <div>
              <span>Your reference code</span>
              <strong>{result.referenceCode}</strong>
            </div>
            <button type="button" onClick={copy}>{copied ? <><Check size={15} aria-hidden="true" /> Copied</> : <><Copy size={15} aria-hidden="true" /> Copy code</>}</button>
          </div>
          <p className="apply-result-note">Save this code. To check on your application, open <strong>Track application</strong> and enter it with your surname, <strong>{result.lastName}</strong>.</p>
          <dl className="apply-result-details">
            <div><dt>Name</dt><dd>{result.name}</dd></div>
            <div><dt>Division</dt><dd>{result.division}</dd></div>
            <div><dt>Position</dt><dd>{result.position}</dd></div>
            {result.interview && <div className="is-wide"><dt>Interview</dt><dd>{result.interview}</dd></div>}
            <div><dt>Submitted</dt><dd>{formatSubmitted(result.submittedAt)}</dd></div>
          </dl>
        </section>
      )}

      {preview ? (
        <footer className="apply-nav">
          <Link className="apply-back" href="/portal/recruitment"><ArrowLeft size={15} /> Back to portal</Link>
          <button className="button-primary" type="button" onClick={onRestart}>Start over <ArrowRight size={15} /></button>
        </footer>
      ) : (
        <footer className="apply-nav">
          <Link className="apply-back" href="/"><ArrowLeft size={15} /> Back to home</Link>
          <Link className="button-primary" href={result ? `/apply/track?ref=${result.referenceCode}` : "/apply/track"}>Track application <ArrowRight size={15} /></Link>
        </footer>
      )}
    </div>
  );
}

/** Reminds commissioners in view mode that nothing they enter is sent. */
function ViewModeNote({ children }: { children: ReactNode }) {
  return <p className="apply-view-mode" role="note"><Eye size={16} aria-hidden="true" /><span><strong>View mode.</strong> {children}</span></p>;
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

/** Solid green shield with a white check. */
function ShieldMark() {
  return (
    <svg className="verified-shield" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Marks something verified with the applicant's UST Google account. With `tooltip`, hovering or
 * focusing it explains what it means.
 */
function VerifiedBadge({ tooltip }: { tooltip?: string }) {
  if (!tooltip) return <span className="verified-badge"><ShieldMark /></span>;
  return (
    <span className="verified-badge has-tooltip" tabIndex={0} role="img" aria-label={tooltip}>
      <ShieldMark />
      <span className="verified-tooltip" role="tooltip">{tooltip}</span>
    </span>
  );
}

/** The privacy statement's four parts, shown as tiles on the Consent step. */
const privacySections: Array<{ icon: typeof ShieldCheck; title: string; text: string }> = [
  { icon: ClipboardList, title: "What we collect", text: "Your full name, student number, mobile number, UST email, Facebook profile link, college, program and year level; your preferred body, division, position and interview time; and the links to your CV, endorsement letter and portfolio. To confirm you’re from UST, you’ll also sign in once with your UST Google account, which shares your name and UST email with us; we don’t keep that sign-in record." },
  { icon: Target, title: "Why we collect it", text: "To evaluate your application, contact you about interviews and results, and keep a record of the commission’s recruitment." },
  { icon: Users, title: "Who can see it", text: "Only the Central COMELEC commissioners and officers handling recruitment. We don’t sell your information or share it outside the commission unless the law requires it." },
  { icon: Clock, title: "How long we keep it", text: "We store it securely and delete your application automatically 60 days after you submit it." },
];

/** Why verification didn't complete, from ?verify= after Google sends the applicant back. */
const verifyMessages: Record<string, string> = {
  "not-ust": "That wasn’t a UST account. Sign in with your @ust.edu.ph Google account to apply.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
  unavailable: "Verification isn’t available right now. Please email comelec@ust.edu.ph.",
};

export type VerifiedApplicant = { email: string; firstName: string; lastName: string };

/**
 * The Apply form. With `preview` (view mode, for commissioners), every step can be opened without
 * filling in the one before, Google verification is skipped, and nothing is sent to the server:
 * answers only last until the page is left or reloaded.
 */
export function ApplicationForm({ slots, interviews, verified: verifiedAtLoad, verifyStatus, preview = false }: { slots: SlotCounts; interviews: InterviewSlot[]; verified: VerifiedApplicant | null; verifyStatus?: string; preview?: boolean }) {
  const [state, formAction, pending] = useActionState(submitApplication, undefined);
  // Verified applicants have already given consent, so they start at About you.
  const [step, setStep] = useState(verifiedAtLoad ? 1 : 0);
  const [reached, setReached] = useState(preview ? lastStep : verifiedAtLoad ? 1 : 0);
  // View mode's stand-in for a saved application, built from the answers on screen.
  const [previewResult, setPreviewResult] = useState<SubmittedApplication | null>(null);
  const [redirecting, startRedirect] = useTransition();
  // Set when verification finishes in the popup, without reloading the page.
  const [verifiedNow, setVerifiedNow] = useState<VerifiedApplicant | null>(null);
  const [waitingForGoogle, setWaitingForGoogle] = useState(false);
  const [verifyError, setVerifyError] = useState(verifyStatus && verifyStatus !== "ok" ? verifyStatus : "");
  const popupRef = useRef<Window | null>(null);
  const profile = verifiedNow ?? verifiedAtLoad;
  const verified = state?.verificationExpired && !verifiedNow ? null : profile;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<ApplicationValues | null>(null);
  const [college, setCollege] = useState("");
  const [program, setProgram] = useState("");
  const [division, setDivision] = useState("");
  const [position, setPosition] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [interviewSlot, setInterviewSlot] = useState("");
  // Each division interviews on its own schedule; only the chosen division's times are offered.
  const divisionInterviews = interviews.filter((slot) => slot.division === division);
  const openInterviews = divisionInterviews.map((slot) => slot.id);
  const chosenInterview = divisionInterviews.find((slot) => slot.id === interviewSlot);
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
    setStep(target);
    setReached((current) => Math.max(current, target));
    setMoved(true);
  };

  const checkStep = (index: number) => {
    const stepErrors = checkFields(read(), steps[index].fields, slots, openInterviews);
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

  // The popup's last page reports here, then closes itself.
  useEffect(() => {
    if (preview || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(VERIFICATION_CHANNEL);
    channel.onmessage = (event: MessageEvent<VerificationMessage>) => {
      const { status, profile: verifiedProfile } = event.data ?? {};
      setWaitingForGoogle(false);
      if (status === "ok" && verifiedProfile?.email) {
        setVerifiedNow(verifiedProfile);
        setVerifyError("");
        setErrors((current) => {
          const next = { ...current };
          delete next.consent;
          return next;
        });
        setStep(1);
        setReached((current) => Math.max(current, 1));
        setMoved(true);
      } else {
        setVerifyError(status || "failed");
      }
    };
    return () => channel.close();
  }, [preview]);

  /** Opens Google sign-in in a centred popup, or in this window if popups are blocked. */
  const openVerification = () => {
    const url = "/apply/verify/start";
    const width = 480;
    const height = 640;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(url, "ust-verification", `popup,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
      window.open(url, "_self");
      return;
    }
    popup.focus();
    popupRef.current = popup;
    setVerifyError("");
    setWaitingForGoogle(true);
  };

  /** View mode's Submit: shows the Result step with the answers given, without sending anything. */
  const finishPreview = () => {
    const answers = read();
    const chosenDivision = divisions[answers.division as DivisionId];
    setPreviewResult({
      referenceCode: "CC-SAMP-LE00",
      lastName: answers.lastName || "your surname",
      name: [answers.firstName, answers.middleInitial && `${answers.middleInitial}.`, answers.lastName].filter(Boolean).join(" ") || "Not provided",
      division: chosenDivision?.label ?? "Not provided",
      position: (chosenDivision?.positions as Record<string, string> | undefined)?.[answers.position] ?? "Not provided",
      interview: chosenInterview ? describeSlot(chosenInterview) : null,
      submittedAt: new Date().toISOString(),
    });
  };

  /** Clears view mode's answers and goes back to the first step. */
  const restartPreview = () => {
    formRef.current?.reset();
    setCollege("");
    setProgram("");
    setDivision("");
    setPosition("");
    setYearLevel("");
    setInterviewSlot("");
    setErrors({});
    setValues(null);
    setPreviewResult(null);
    setStep(0);
    setMoved(true);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // View mode never checks answers or sends them; it only moves between steps.
    if (preview) return step < lastStep ? goTo(step + 1) : finishPreview();
    if (!checkStep(step)) return;
    // Consent given: off to Google to prove it's a UST account. They come back verified at About you.
    if (step === 0 && !verified) return openVerification();
    if (step < lastStep) return goTo(step + 1);

    // Last step: make sure no earlier step was left invalid, then send everything.
    for (let index = 0; index < lastStep; index++) {
      if (!checkStep(index)) return setStep(index);
    }
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  const submitted = Boolean(state?.submitted) || previewResult !== null;
  const current = submitted ? resultStep : step;
  const progress = Math.round(((current + 1) / trackerSteps.length) * 100);

  const tracker = (
    <div className="apply-tracker">
      <div className="apply-tracker-inner">
        <nav aria-label="Application progress">
          <ol className="apply-steps">
            {trackerSteps.map((title, index) => {
              const status = index === current ? "is-current" : submitted || index < reached || index < step ? "is-done" : "is-upcoming";
              // Once submitted there's nothing to go back to; the Result step is never a link.
              const reachable = !submitted && index < resultStep && index <= reached && index !== step && !pending;
              return (
                <li key={title} className={status}>
                  <button type="button" disabled={!reachable} onClick={() => goTo(index)} aria-current={index === current ? "step" : undefined}>
                    <span className="apply-step-marker">{status === "is-done" ? <Check size={14} strokeWidth={2.5} /> : index + 1}</span>
                    <span className="apply-step-text"><small>Step {index + 1}</small>{title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <div className="apply-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Progress">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );

  if (submitted) {
    return (
      <div className="apply-form">
        {tracker}
        <ApplicationResult result={previewResult ?? state?.result} preview={preview} onRestart={restartPreview} />
      </div>
    );
  }

  return (
    <form ref={formRef} className="apply-form" onSubmit={onSubmit} onInput={(event) => clearError((event.target as HTMLInputElement).name)} noValidate>
      {tracker}

      <div className="apply-body">
        <div className="apply-body-head">
          <span>Step {step + 1} of {trackerSteps.length}</span>
          <h2 ref={headingRef} tabIndex={-1}>{steps[step].title}</h2>
          {step === 1 && verified ? (
            <p className="apply-verified-line"><VerifiedBadge /><span>Verified as <strong>{verified.email}</strong></span></p>
          ) : (
            <p>{steps[step].description}</p>
          )}
        </div>

        {/* Every step stays in the form so all answers are sent together; only the current one shows. */}
        <div className="apply-step" hidden={step !== 0}>
          <section className={`apply-privacy${errors.consent ? " has-error" : ""}`} aria-labelledby="privacy-title">
            <header className="apply-privacy-head">
              <span className="apply-privacy-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
              <div>
                <h3 id="privacy-title">Privacy statement</h3>
                <span className="apply-privacy-law">Data Privacy Act of 2012 · Republic Act No. 10173</span>
              </div>
            </header>
            <p className="apply-privacy-intro">The UST Central Commission on Elections (Central COMELEC) respects your privacy. This statement explains what we collect through this form and how we use it.</p>
            <div className="apply-privacy-grid">
              {privacySections.map(({ icon: Icon, title, text }) => (
                <div className="apply-privacy-item" key={title}>
                  <span className="apply-privacy-item-icon" aria-hidden="true"><Icon size={17} /></span>
                  <div>
                    <h4>{title}</h4>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="apply-privacy-rights"><Mail size={16} aria-hidden="true" /><span>You may ask to access, correct or delete your information, or withdraw your consent, by emailing <Link href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</Link>.</span></p>
            <label className={`apply-consent${errors.consent ? " has-error" : ""}`}>
              {verified ? <><input type="checkbox" checked disabled readOnly /><input type="hidden" name="consent" value="on" /></> : <input name="consent" type="checkbox" />}
              <span><Required /> I have read this privacy statement and consent to the Central COMELEC collecting, using and processing my personal information for the purposes stated above.</span>
            </label>
          </section>
          {errors.consent && <span className="apply-field-error">{errors.consent}</span>}
          {preview ? null : verified ? (
            <div className="apply-verified">
              <VerifiedBadge />
              <p>Verified as <strong>{verified.email}</strong></p>
              <button type="button" onClick={() => startRedirect(() => forgetApplicantVerification())} disabled={redirecting}>Use a different account</button>
            </div>
          ) : waitingForGoogle ? (
            <div className="apply-verify-waiting" role="status">
              <p>Finish signing in with Google in the window that just opened. This page will continue on its own.</p>
              <div>
                <button type="button" onClick={openVerification}>Open the sign-in window again</button>
                <button type="button" onClick={() => { popupRef.current?.close(); setWaitingForGoogle(false); }}>Cancel</button>
              </div>
            </div>
          ) : verifyError && verifyMessages[verifyError] ? (
            <p className="apply-form-error" role="alert">{verifyMessages[verifyError]}</p>
          ) : null}
        </div>

        <div className="apply-step" hidden={step !== 1}>
          <fieldset className="apply-group">
            <legend>Name</legend>
            <div className="apply-grid">
              <Field label="Last name" error={errors.lastName} span={5}>
                <input name="lastName" autoComplete="family-name" autoCapitalize="characters" maxLength={80} required onInput={uppercase} key={`last-${profile?.email}`} defaultValue={profile?.lastName.toUpperCase()} />
              </Field>
              <Field label="First name" error={errors.firstName} span={5}>
                <input name="firstName" autoComplete="given-name" autoCapitalize="characters" maxLength={80} required onInput={uppercase} key={`first-${profile?.email}`} defaultValue={profile?.firstName.toUpperCase()} />
              </Field>
              <Field label="Middle initial" error={errors.middleInitial} span={2}>
                <input name="middleInitial" autoComplete="additional-name" autoCapitalize="characters" maxLength={1} placeholder="M" required onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^\p{L}]/gu, "").toUpperCase(); }} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="apply-group">
            <legend>Contact and student details</legend>
            <div className="apply-grid">
              <Field label="Student number" error={errors.studentNumber} span={3}>
                <input name="studentNumber" inputMode="numeric" maxLength={10} placeholder="2023123456" />
              </Field>
              <Field label="Mobile number" error={errors.contactNumber} span={3}>
                <input name="contactNumber" type="tel" autoComplete="tel" placeholder="0917 123 4567" maxLength={16} />
              </Field>
              <Field label="UST email" error={errors.email} span={6}>
                <span className={profile ? "apply-input-verified" : undefined}>
                  <input name="email" type="email" autoComplete="email" placeholder="juan.delacruz.cics@ust.edu.ph" maxLength={120} readOnly={Boolean(profile)} key={`email-${profile?.email}`} defaultValue={profile?.email} />
                  {profile && <VerifiedBadge tooltip="Verified with your UST Google account" />}
                </span>
              </Field>
              <Field label="Facebook profile link" error={errors.facebookUrl} span={12}>
                <input name="facebookUrl" type="url" inputMode="url" placeholder="facebook.com/yourname" maxLength={300} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="apply-group">
            <legend>Academic details</legend>
            <div className="apply-grid">
              <div className={`apply-field span-5${errors.college ? " has-error" : ""}`}>
                <span className="apply-field-label" id="college-label">College or faculty<Required /></span>
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
                  describedBy="college-label"
                />
                {errors.college && <span className="apply-field-error">{errors.college}</span>}
              </div>
              <div className={`apply-field span-5${errors.program ? " has-error" : ""}`}>
                <span className="apply-field-label" id="program-label">Program<Required /></span>
                <Combobox
                  key={college}
                  name="program"
                  options={programs}
                  value={program}
                  onChange={(next) => {
                    setProgram(next);
                    clearError("program");
                  }}
                  placeholder={college ? "Type or pick your program" : "Pick a college first"}
                  emptyText="No match. Try another program."
                  disabled={!college}
                  invalid={Boolean(errors.program)}
                  describedBy="program-label"
                />
                {errors.program && <span className="apply-field-error">{errors.program}</span>}
              </div>
              <div className={`apply-field span-2${errors.yearLevel ? " has-error" : ""}`}>
                <span className="apply-field-label" id="year-level-label">Year level<Required /></span>
                <Combobox
                  name="yearLevel"
                  options={yearLevelLabels}
                  value={yearLevel}
                  submitValue={yearLevelValue(yearLevel)}
                  onChange={(next) => {
                    setYearLevel(next);
                    clearError("yearLevel");
                  }}
                  placeholder="Select"
                  pickOnly
                  invalid={Boolean(errors.yearLevel)}
                  describedBy="year-level-label"
                />
                {errors.yearLevel && <span className="apply-field-error">{errors.yearLevel}</span>}
              </div>
            </div>
          </fieldset>
        </div>

        <div className="apply-step" hidden={step !== 2}>
          <div className={`apply-field${errors.preferredBody ? " has-error" : ""}`} role="radiogroup" aria-label="Where would you like to serve?">
            <span className="apply-field-label">Where would you like to serve?<Required /></span>
            <div className="apply-choices is-2">
              {Object.entries(preferredBodies).map(([value, label]) => (
                <label className="apply-choice" key={value}>
                  <input type="radio" name="preferredBody" value={value} />
                  <span className="apply-choice-text"><strong>{label}</strong><small>{preferredBodyDescriptions[value as keyof typeof preferredBodies]}</small></span>
                </label>
              ))}
            </div>
            {errors.preferredBody && <span className="apply-field-error">{errors.preferredBody}</span>}
          </div>

          <div className={`apply-field${errors.division ? " has-error" : ""}`} role="radiogroup" aria-label="Where would you like to apply?">
            <span className="apply-field-label">Where would you like to apply?<Required /></span>
            <div className="apply-divisions">
              {(Object.keys(divisions) as DivisionId[]).map((value) => (
                <DivisionOption
                  key={value}
                  id={value}
                  slots={slots}
                  checked={division === value}
                  onSelect={() => { if (value !== division) setInterviewSlot(""); setDivision(value); setPosition(""); clearError("division"); clearError("position"); }}
                />
              ))}
            </div>
            {errors.division && <span className="apply-field-error">{errors.division}</span>}
          </div>

          {division && (
            <div className={`apply-field${errors.position ? " has-error" : ""}`} role="radiogroup" aria-label="Position to apply for">
              <span className="apply-field-label">Position to apply for<Required /></span>
              <div className="apply-choices is-positions">
                {Object.entries(divisionPositions).map(([value, label]) => {
                  const count = slots[value] ?? 0;
                  return (
                    <label className={`apply-choice${count < 1 ? " is-full" : ""}`} key={value}>
                      <input type="radio" name="position" value={value} checked={position === value} disabled={count < 1} onChange={() => { setPosition(value); clearError("position"); }} />
                      <span className="apply-choice-text"><strong>{label}</strong><span className={`apply-slots${count < 1 ? " is-full" : ""}`}>{slotLabel(count)}</span></span>
                    </label>
                  );
                })}
              </div>
              {errors.position && <span className="apply-field-error">{errors.position}</span>}
            </div>
          )}
        </div>

        <div className="apply-step" hidden={step !== 3}>
          <p className="apply-note">Upload each file to Google Drive, set sharing to <strong>Anyone with the link can view</strong>, then paste the link here.</p>
          <div className="apply-grid">
            <Field label="CV or résumé" error={errors.cvUrl} span={12}>
              <input name="cvUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
            <Field label="Endorsement letter" error={errors.endorsementUrl} span={12} optional>
              <input name="endorsementUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
            <div className="span-12" hidden={!portfolio}>
              <Field label="Portfolio" hint="Required for the Public Information Division." error={errors.portfolioUrl} span={12}>
                <input name="portfolioUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
              </Field>
            </div>
          </div>
        </div>

        <div className="apply-step" hidden={step !== 4}>
          <div className={`apply-field${errors.interviewSlot ? " has-error" : ""}`}>
            <InterviewPicker key={division} slots={divisionInterviews} value={interviewSlot} invalid={Boolean(errors.interviewSlot)} onChange={(id) => { setInterviewSlot(id); clearError("interviewSlot"); }} />
            {errors.interviewSlot && <span className="apply-field-error" role="alert">{errors.interviewSlot}</span>}
          </div>
        </div>

        <div className="apply-step" hidden={step !== 5}>
          {values && (
            <div className="apply-review">
              <ReviewSection title="About you" onEdit={() => goTo(1)} rows={[
                ["Name", [values.lastName && `${values.lastName},`, values.firstName, values.middleInitial && `${values.middleInitial.toUpperCase()}.`].filter(Boolean).join(" ")],
                ["Student number", values.studentNumber],
                ["Mobile number", values.contactNumber],
                ["UST email", values.email],
                ["Facebook", values.facebookUrl],
                ["College or faculty", values.college],
                ["Program", values.program],
                ["Year level", yearLevels[values.yearLevel as keyof typeof yearLevels] ?? ""],
              ]} />
              <div className="apply-review-stack">
                <ReviewSection title="Your application" onEdit={() => goTo(2)} rows={[
                  ["Serve in", preferredBodies[values.preferredBody as keyof typeof preferredBodies] ?? ""],
                  ["Division", divisions[values.division as DivisionId]?.label ?? ""],
                  ["Position", divisionPositions[values.position] ?? ""],
                ]} />
                <ReviewSection title="Documents" onEdit={() => goTo(3)} rows={[
                  ["CV or résumé", values.cvUrl],
                  ["Endorsement letter", values.endorsementUrl],
                  ...(needsPortfolio(values.division) ? [["Portfolio", values.portfolioUrl] as [string, string]] : []),
                ]} />
                <ReviewSection title="Interview" onEdit={() => goTo(4)} rows={[
                  ["Time", chosenInterview ? describeSlot(chosenInterview) : divisionInterviews.length ? "" : "The commission will email you to schedule it"],
                ]} />
              </div>
            </div>
          )}
          {state?.error && !state.fieldErrors && <p className="apply-form-error" role="alert">{state.error}</p>}
        </div>

        {/* Honeypot: hidden from people, often filled in by spam bots. */}
        <div className="apply-honeypot" aria-hidden="true">
          <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        <footer className="apply-nav">
          {step > 0 ? (
            <button className="apply-back" type="button" onClick={() => goTo(step - 1)} disabled={pending}><ArrowLeft size={15} /> Back</button>
          ) : <span />}
          <button className="button-primary" type="submit" disabled={pending || redirecting || waitingForGoogle || !hydrated}>
            {step === 0 && !verified && !preview ? (waitingForGoogle ? "Waiting for Google…" : <>Continue with UST Google <ArrowRight size={15} /></>) : step < lastStep ? <>Continue <ArrowRight size={15} /></> : pending ? "Submitting…" : <>Submit application <ArrowRight size={15} /></>}
          </button>
        </footer>
      </div>
    </form>
  );
}
