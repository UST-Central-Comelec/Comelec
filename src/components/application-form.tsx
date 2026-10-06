"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardList, Clock, Copy, Download, Eye, Mail, ShieldCheck, Target, Users } from "lucide-react";
import { submitApplication, type ApplicationState, type SubmittedApplication } from "@/lib/applications/actions";
import { forgetApplicantVerification } from "@/lib/applications/verification-actions";
import { digitsOnly, formatMobileNumber, formatNumericInput } from "@/lib/applications/numeric-input";
import { existingCommissionAccount } from "@/lib/applications/account-eligibility";
import { VERIFICATION_CHANNEL, type VerifiedProfile, type VerificationMessage } from "@/lib/applications/verification-channel";
import { colleges, conflicts, positionsForUnit, preferredBodies, preferredBodyDescriptions, programsByCollege, programLocked, yearLevelsFor, qualifications, type College, type ConflictId, type QualificationField, type SlotCounts, type UnitSlotCounts } from "@/lib/applications/options";
import { checkFields, closedBodyError, conflictFields, needsPortfolio, readApplication, type ApplicationField, type ApplicationValues } from "@/lib/applications/schema";
import { isBodyOpen, type OpenBodies } from "@/lib/periods/summary";
import { useHydrated } from "@/components/portal/portal-form";
import { Combobox } from "@/components/combobox";
import { FacebookProfileInput } from "@/components/facebook-profile-input";
import { InterviewPicker } from "@/components/interview-picker";
import { describeSlot, type InterviewSlot } from "@/lib/applications/interview-format";
import { downloadReceipt } from "@/lib/applications/receipt-image";
import { describeAnswers, interviewLater, type AnswerSection, type AnswerSectionId } from "@/lib/applications/answers";

const steps: Array<{ title: string; description: string; fields: ApplicationField[] }> = [
  { title: "Consent", description: "Read how we handle your personal information, give your consent, then verify with your UST Google account.", fields: ["consent"] },
  { title: "Qualifications", description: "Confirm you meet the requirements to serve on the commission, and tell us about anything you’d have to give up to join.", fields: ["meetsUnits", "meetsGwa", "notRecentCandidate", "conflictOffice", "conflictOfficeDetail", "conflictParty", "conflictPartyDetail", "conflictPolitics", "conflictPoliticsDetail", "conflictPledge"] },
  { title: "About you", description: "Your name, how to reach you, and where you study.", fields: ["lastName", "firstName", "middleName", "studentNumber", "contactNumber", "email", "facebookUrl", "college", "program", "yearLevel"] },
  { title: "Position", description: "Where you’d like to serve and the position you’re applying for.", fields: ["preferredBody", "position"] },
  { title: "Documents", description: "Share your files as Google Drive links.", fields: ["cvUrl", "registrationFormUrl", "letterOfIntentUrl", "endorsementUrl", "portfolioUrl", "gradesUrl"] },
  { title: "Interview", description: "Pick a time for your interview with the commission. Times are in Philippine time.", fields: ["interviewSlot"] },
  { title: "Submit", description: "Check your answers, then submit your application.", fields: [] },
];

/** Shown in the progress tracker after the form steps, once the application is saved. */
const receiptStep = steps.length;
const trackerSteps = [...steps.map((step) => step.title), "Receipt"];


const twoDigits = (value: number) => String(value).padStart(2, "0");

const slotLabel = (count: number) => (count < 1 ? "No slots open" : count === 1 ? "1 slot open" : `${count} slots open`);

const lastStep = steps.length - 1;

/** How long a step takes to slide out before the next one slides in (apply-body.is-leaving in globals.css). */
const STEP_LEAVE_MS = 180;

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

type ConflictAnswers = Record<ConflictId, "" | "yes" | "no">;
const noConflictAnswers: ConflictAnswers = { office: "", party: "", politics: "" };
const conflictIds = Object.keys(conflicts) as ConflictId[];
const qualificationFields = Object.keys(qualifications) as QualificationField[];

/**
 * One conflict question. Answering "yes" doesn't rule the applicant out; it explains what they'd be
 * asked to do if appointed and asks them to name the office or group.
 */
function ConflictQuestion({ id, answer, onAnswer, errors }: { id: ConflictId; answer: ConflictAnswers[ConflictId]; onAnswer: (answer: "yes" | "no") => void; errors: Record<string, string> }) {
  const labelId = useId();
  const item = conflicts[id];
  const [answerField, detailField] = conflictFields[id];
  return (
    <div className={`apply-field apply-conflict${errors[answerField] ? " has-error" : ""}`}>
      <div className="apply-conflict-head">
        <div className="apply-conflict-question">
          <span className="apply-field-label" id={labelId}>{item.question}<Required /></span>
          <span className="apply-field-hint">{item.rule}</span>
        </div>
        <div className="apply-choices is-2 is-compact" role="radiogroup" aria-labelledby={labelId}>
          {(["no", "yes"] as const).map((value) => (
            <label className="apply-choice" key={value}>
              <input type="radio" name={answerField} value={value} checked={answer === value} onChange={() => onAnswer(value)} />
              <span className="apply-choice-text"><strong>{value === "yes" ? "Yes" : "No"}</strong></span>
            </label>
          ))}
        </div>
      </div>
      {errors[answerField] && <span className="apply-field-error">{errors[answerField]}</span>}
      <div className={`apply-conflict-reveal${answer === "yes" ? " is-open" : ""}`} inert={answer !== "yes"} aria-hidden={answer !== "yes"}>
        <div className="apply-conflict-reveal-inner">
          <div className="apply-conflict-note">
            <Field label={item.detailLabel} error={errors[detailField]} span={12}>
              <input name={detailField} maxLength={200} placeholder={item.detailPlaceholder} disabled={answer !== "yes"} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

const formatSubmitted = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** The Receipt step: confirms the application and hands over the reference code for tracking. */
function ApplicationResult({ result, preview, onRestart }: { result?: SubmittedApplication; preview?: boolean; onRestart?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "failed">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
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

  const save = async () => {
    if (!result) return;
    setSaving("saving");
    try {
      await downloadReceipt(result);
      setSaving("idle");
    } catch {
      setSaving("failed");
    }
  };

  return (
    <div className="apply-body" role="status">
      <div className="apply-body-head">
        <span>Step {receiptStep + 1} of {trackerSteps.length}</span>
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
          <p className="apply-result-note">Save this code. To check on your application, open <strong>Track application</strong> and enter it with your student number or last name.</p>
          <dl className="apply-result-details">
            <div><dt>Applicant</dt><dd>{result.name}</dd></div>
            <div><dt>Submitted</dt><dd>{formatSubmitted(result.submittedAt)}</dd></div>
          </dl>
          <div className="apply-result-save">
            <p>{saving === "failed" ? "Couldn’t create the image. Take a screenshot of this page instead." : "Keep a copy of this receipt, with your reference code and all your answers, as an image."}</p>
            <button type="button" onClick={save} disabled={saving === "saving"}><Download size={15} aria-hidden="true" /> {saving === "saving" ? "Preparing…" : "Download receipt"}</button>
          </div>
        </section>
      )}

      {result && (
        <section className="apply-result-answers" aria-labelledby="receipt-answers-title">
          <h3 id="receipt-answers-title">Your answers</h3>
          <AnswerSections sections={result.answers} />
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

/** The step that holds each answer section, for the Review step's Edit links. */
const sectionSteps: Record<AnswerSectionId, number> = { qualifications: 1, about: 2, application: 3, documents: 4, interview: 5 };

function ReviewSection({ title, onEdit, rows }: { title: string; onEdit?: () => void; rows: Array<[string, string]> }) {
  return (
    <section className="apply-review-section">
      <header><h3>{title}</h3>{onEdit && <button type="button" onClick={onEdit}>Edit</button>}</header>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="is-empty">Not provided</span>}</dd></div>)}
      </dl>
    </section>
  );
}

/** About you and Qualifications on the left, with the remaining answers stacked beside them. */
function AnswerSections({ sections, onEdit }: { sections: AnswerSection[]; onEdit?: (id: AnswerSectionId) => void }) {
  const left = sections.filter(({ id }) => id === "about" || id === "qualifications");
  const right = sections.filter(({ id }) => id !== "about" && id !== "qualifications");
  const section = ({ id, title, rows }: AnswerSection) => <ReviewSection key={id} title={title} rows={rows} onEdit={onEdit && (() => onEdit(id))} />;
  return (
    <div className="apply-review">
      <div className="apply-review-stack">{left.map(section)}</div>
      <div className="apply-review-stack">{right.map(section)}</div>
    </div>
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
  { icon: ClipboardList, title: "What we collect", text: "Your full name, student number, mobile number, UST email, Facebook profile link, college, program and year level; your preferred body, position and interview time; and the links to your CV, latest registration form, letter of intent, recommendation letter, portfolio and latest copy of grades. To confirm you’re from UST, you’ll also sign in once with your UST Google account, which shares your name and UST email with us; we don’t keep that sign-in record." },
  { icon: Target, title: "Why we collect it", text: "To evaluate your application, contact you about interviews and results, and keep a record of the commission’s recruitment." },
  { icon: Users, title: "Who can see it", text: "Authorized commissioners and officers handling recruitment for the relevant unit, within their portal permissions. Service providers process information needed to operate the form, database and email delivery. See the full privacy statement for access and disclosure details." },
  { icon: Clock, title: "How long we keep it", text: "We store it securely and delete your application automatically 60 days after you submit it." },
];

/** Why verification didn't complete, from ?verify= after Google sends the applicant back. */
const verifyMessages: Record<string, string> = {
  "not-ust": "That wasn’t a UST account. Sign in with your @ust.edu.ph Google account to apply.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
  unavailable: "Verification isn’t available right now. Please email comelec@ust.edu.ph.",
};

export type VerifiedApplicant = VerifiedProfile;

/**
 * The Apply form. With `preview` (view mode, for commissioners), every step can be opened without
 * filling in the one before, Google verification is skipped, and nothing is sent to the server:
 * answers only last until the page is left or reloaded.
 */
export function ApplicationForm({ slots: centralSlots, unitSlots, interviews, bodies, preset, verified: verifiedAtLoad, verifyStatus, preview = false }: {
  slots: SlotCounts;
  unitSlots?: UnitSlotCounts;
  interviews: InterviewSlot[];
  /** The units recruiting right now: each opens and closes its own. Left out in view mode, where every choice can be tried. */
  bodies?: OpenBodies;
  /** The unit the applicant came for, from an Apply button on the Events page: the form starts on it. */
  preset?: { body: "central" | "local"; college: string | null };
  verified: VerifiedApplicant | null;
  verifyStatus?: string;
  preview?: boolean;
}) {
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
  const [college, setCollege] = useState(preset?.college ?? "");
  const [preferredBody, setPreferredBody] = useState(preset?.body ?? "");
  const [program, setProgram] = useState("");
  const [position, setPosition] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [interviewSlot, setInterviewSlot] = useState("");
  const [conflictAnswers, setConflictAnswers] = useState<ConflictAnswers>(noConflictAnswers);
  const hasConflict = conflictIds.some((id) => conflictAnswers[id] === "yes");
  // Interview times belong to the selected Comelec unit.
  const unitInterviews = interviews.filter((slot) => (slot.college ?? "") === (preferredBody === "local" ? college : ""));
  const openInterviews = unitInterviews.map((slot) => slot.id);
  const chosenInterview = unitInterviews.find((slot) => slot.id === interviewSlot);
  const [handledState, setHandledState] = useState<ApplicationState>(undefined);
  const [moved, setMoved] = useState(false);
  // Switching steps: the current one slides out the way the applicant is heading, then the next slides in.
  const [leaving, setLeaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const transitionLock = useRef(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hydrated = useHydrated();
  const programs: readonly string[] = programsByCollege[college as College] ?? [];
  const levels = yearLevelsFor(college);
  const yearLevelLabels = Object.values(levels);
  const yearLevelValue = (label: string) => Object.entries(levels).find(([, text]) => text === label)?.[0] ?? "";
  const portfolio = needsPortfolio(position);
  const availableBodies = Object.keys(preferredBodies).filter((body) =>
    (body !== "local" || Boolean(college)) &&
    (preview || !existingCommissionAccount(profile?.commissionAccounts, body, college)) &&
    (!bodies || isBodyOpen(bodies, body, college)),
  );
  const selectedBody = availableBodies.includes(preferredBody) ? preferredBody : "";
  const slots = unitSlots ? (unitSlots[selectedBody === "local" ? college : ""] ?? {}) : centralSlots;
  const openPositions = selectedBody ? positionsForUnit(selectedBody === "local" ? college : "").filter((position) => (slots[position.id] ?? 0) > 0) : [];
  const canOfferPositions = availableBodies.some((body) => {
    const counts = unitSlots ? unitSlots[body === "local" ? college : ""] ?? {} : centralSlots;
    return positionsForUnit(body === "local" ? college : "").some((position) => (counts[position.id] ?? 0) > 0);
  });

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

  // Reset before painting the new step so it opens at the top, even after a long form.
  useLayoutEffect(() => {
    if (!moved) return;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, moved]);

  const read = () => readApplication(new FormData(formRef.current ?? undefined));

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const goTo = (target: number) => {
    if (transitionLock.current || target === step) return;
    transitionLock.current = true;
    setTransitioning(true);
    setValues(read());
    setDirection(target < step ? "back" : "forward");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const unlock = () => {
      transitionLock.current = false;
      setTransitioning(false);
    };
    const show = () => {
      setLeaving(false);
      setStep(target);
      setReached((current) => Math.max(current, target));
      setMoved(true);
      if (reducedMotion) unlock();
      else leaveTimer.current = setTimeout(unlock, 500);
    };
    clearTimeout(leaveTimer.current);
    if (reducedMotion) return show();
    setLeaving(true);
    leaveTimer.current = setTimeout(show, STEP_LEAVE_MS);
  };

  const checkStep = (index: number) => {
    const answers = read();
    const stepErrors = checkFields(answers, steps[index].fields, slots, openInterviews, bodies);
    const accountError = !preview && existingCommissionAccount(profile?.commissionAccounts, answers.preferredBody, answers.college);
    if (steps[index].fields.includes("preferredBody") && accountError) stepErrors.preferredBody = accountError;
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

  /** View mode's Submit: shows the Receipt step with the answers given, without sending anything. */
  const finishPreview = () => {
    const answers = read();
    const chosenPosition = positionsForUnit(answers.preferredBody === "local" ? answers.college : "").find((position) => position.id === answers.position);
    setPreviewResult({
      referenceCode: "CC-SAMP-LE00",
      name: [answers.firstName, answers.middleName, answers.lastName].filter(Boolean).join(" ") || "Not provided",
      division: "",
      position: chosenPosition?.label ?? "Not provided",
      interview: chosenInterview ? describeSlot(chosenInterview) : null,
      submittedAt: new Date().toISOString(),
      answers: describeAnswers(answers, chosenInterview ?? interviewLater),
    });
  };

  /** Clears view mode's answers and goes back to the first step. */
  const restartPreview = () => {
    formRef.current?.reset();
    setCollege("");
    setPreferredBody("");
    setProgram("");
    setPosition("");
    setYearLevel("");
    setInterviewSlot("");
    setConflictAnswers(noConflictAnswers);
    setErrors({});
    setValues(null);
    setPreviewResult(null);
    setStep(0);
    setMoved(true);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (transitionLock.current) return;
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
  const current = submitted ? receiptStep : step;
  const progress = Math.round(((current + 1) / trackerSteps.length) * 100);
  // A step counts as done only when every required answer on it is valid, as of the last step change.
  // Before the first one there's nothing to check: the only step behind is Consent, done by verifying.
  const complete = steps.map((item) => !values || Object.keys(checkFields(values, item.fields, slots, openInterviews, bodies)).length === 0);

  const tracker = (
    <div className="apply-tracker">
      <div className="apply-tracker-inner">
        <nav aria-label="Application progress">
          <ol className="apply-steps">
            {trackerSteps.map((title, index) => {
              const status = index === current ? "is-current" : submitted || ((index < reached || index < step) && complete[index]) ? "is-done" : "is-upcoming";
              // Once submitted there's nothing to go back to; the Receipt step is never a link.
              const reachable = !submitted && index < receiptStep && index <= reached && index !== step && !pending && !transitioning;
              return (
                <li key={title} className={status}>
                  <button type="button" disabled={!reachable} onClick={() => goTo(index)} aria-current={index === current ? "step" : undefined}>
                    <span className="apply-step-rail" aria-hidden="true" />
                    <span className="apply-step-label">
                      <span className="apply-step-index"><span className="visually-hidden">Step </span>{twoDigits(index + 1)}</span>
                      <span className="apply-step-text">{title}{status === "is-done" && <span className="visually-hidden"> (done)</span>}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        {/* Phones and tablets hide the step names, so the current one is spelled out here. */}
        <div className="apply-tracker-readout" aria-hidden="true">
          <span><strong>{twoDigits(current + 1)}</strong> / {twoDigits(trackerSteps.length)}</span>
          <span className="apply-tracker-readout-title" key={current}>{trackerSteps[current]}</span>
          <span className="apply-tracker-readout-percent">{progress}%</span>
        </div>
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

      <div className={`apply-body${leaving ? " is-leaving" : ""}`} data-direction={direction}>
        <div className="apply-body-head" key={step}>
          <span>Step {step + 1} of {trackerSteps.length}</span>
          <h2 ref={headingRef} tabIndex={-1}>{steps[step].title}</h2>
          {step === 2 && verified ? (
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
            <p className="apply-privacy-intro"><Link href="/privacy" target="_blank" rel="noreferrer">Read the full website and portal privacy statement</Link>.</p>
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
            <legend>Requirements</legend>
            <div className="apply-checklist">
              <p className="apply-group-intro">Check each one you meet. You need all four to apply.</p>
              <ul className="apply-requirements">
                <li>
                  <label className="apply-requirement is-locked">
                    <input type="checkbox" checked disabled readOnly />
                    <span className="apply-requirement-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                    <span className="apply-requirement-text">Bona fide student of the faculty, college, school or institute you’ll serve.</span>
                    <span className="apply-requirement-verified"><VerifiedBadge /> {preview ? "Verified at sign-in" : "Verified with UST Google"}</span>
                  </label>
                </li>
                {qualificationFields.map((field) => (
                  <li key={field}>
                    <label className={`apply-requirement${errors[field] ? " has-error" : ""}`}>
                      <input name={field} type="checkbox" />
                      <span className="apply-requirement-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                      <span className="apply-requirement-text">
                        {qualifications[field]}
                        {errors[field] && <span className="apply-field-error">{errors[field]}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </fieldset>

          <fieldset className="apply-group">
            <legend>Conflicts to resolve</legend>
            <div className="apply-checklist is-conflicts">
              {conflictIds.map((id) => (
                <ConflictQuestion
                  key={id}
                  id={id}
                  answer={conflictAnswers[id]}
                  errors={errors}
                  onAnswer={(answer) => { setConflictAnswers((current) => ({ ...current, [id]: answer })); clearError(conflictFields[id][0]); }}
                />
              ))}
              <div className={`apply-conflict-reveal is-pledge${hasConflict ? " is-open" : ""}`} inert={!hasConflict} aria-hidden={!hasConflict}>
                <div className="apply-conflict-reveal-inner">
                  <div className="apply-check">
                    <label className={`apply-consent apply-conflict-pledge${errors.conflictPledge ? " has-error" : ""}`}>
                      <input name="conflictPledge" type="checkbox" disabled={!hasConflict} />
                      <span><Required /> Should I be appointed, I will step down from the office or end the affiliation I named above before my term begins, and remain apart from it while I serve. I understand my appointment depends on this.</span>
                    </label>
                    {errors.conflictPledge && <span className="apply-field-error">{errors.conflictPledge}</span>}
                  </div>
                </div>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="apply-step" hidden={step !== 2}>
          <fieldset className="apply-group">
            <legend>Name</legend>
            <div className="apply-grid">
              <Field label="Last name" error={errors.lastName} span={4}>
                <input name="lastName" autoComplete="family-name" autoCapitalize="characters" maxLength={80} required onInput={uppercase} key={`last-${profile?.email}`} defaultValue={profile?.lastName.toUpperCase()} />
              </Field>
              <Field label="First name" error={errors.firstName} span={4}>
                <input name="firstName" autoComplete="given-name" autoCapitalize="characters" maxLength={80} required onInput={uppercase} key={`first-${profile?.email}`} defaultValue={profile?.firstName.toUpperCase()} />
              </Field>
              <Field label="Middle name" error={errors.middleName} span={4}>
                <input name="middleName" autoComplete="additional-name" autoCapitalize="characters" maxLength={80} required onInput={uppercase} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="apply-group">
            <legend>Contact and student details</legend>
            <div className="apply-grid">
              <Field label="Student number" error={errors.studentNumber} span={3}>
                <input name="studentNumber" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="2023123456" onInput={(event) => formatNumericInput(event.currentTarget, (value) => digitsOnly(value, 10))} />
              </Field>
              <Field label="Mobile number" error={errors.contactNumber} span={3} optional>
                <input name="contactNumber" type="tel" inputMode="numeric" autoComplete="tel" pattern="09[0-9]{2}-[0-9]{3}-[0-9]{4}" placeholder="0917-123-4567" maxLength={13} onInput={(event) => formatNumericInput(event.currentTarget, formatMobileNumber)} />
              </Field>
              <Field label="UST email" error={errors.email} span={6}>
                <span className={profile ? "apply-input-verified" : undefined}>
                  <input name="email" type="email" autoComplete="email" placeholder="juan.delacruz.cics@ust.edu.ph" maxLength={120} readOnly={Boolean(profile)} key={`email-${profile?.email}`} defaultValue={profile?.email} />
                  {profile && <VerifiedBadge tooltip="Verified with your UST Google account" />}
                </span>
              </Field>
              <Field label="Facebook profile link" error={errors.facebookUrl} span={12}>
                <FacebookProfileInput required invalid={Boolean(errors.facebookUrl)} onChange={() => clearError("facebookUrl")} />
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
                    setCollege(next); setYearLevel("");
                    setProgram("");
                    if (preferredBody === "local") {
                      setPreferredBody("");
                      setPosition("");
                      setInterviewSlot("");
                    }
                    clearError("college");
                  }}
                  placeholder="Type or pick your college"
                  invalid={Boolean(errors.college)}
                  describedBy="college-label"
                />
                {errors.college && <span className="apply-field-error">{errors.college}</span>}
              </div>
              <div className={`apply-field span-5${errors.program ? " has-error" : ""}`}>
                <span className="apply-field-label" id="program-label">Program{!programLocked(college) && <Required />}</span>
                {programLocked(college) ? <input value="None" readOnly aria-label="Program" /> : (
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
                )}
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

        <div className="apply-step" hidden={step !== 3}>
          <div className={`apply-field${errors.preferredBody ? " has-error" : ""}`} role="radiogroup" aria-label="Where would you like to serve?">
            <span className="apply-field-label">Where would you like to serve?<Required /></span>
            <div className="apply-choices is-2">
              {Object.entries(preferredBodies).map(([value, label]) => {
                // Each unit recruits on its own: the Central Comelec, and the Local Comelec of the applicant's college.
                const accountError = !preview && existingCommissionAccount(profile?.commissionAccounts, value, college);
                const open = availableBodies.includes(value);
                return (
                  <label className={`apply-choice${open ? "" : " is-full"}`} key={value}>
                    <input type="radio" name="preferredBody" value={value} disabled={!open} checked={selectedBody === value} onChange={() => { setPreferredBody(value); setPosition(""); setInterviewSlot(""); clearError("preferredBody"); clearError("position"); }} />
                    <span className="apply-choice-text"><strong>{label}</strong><small>{open ? preferredBodyDescriptions[value as keyof typeof preferredBodies] : accountError || closedBodyError(value, college)}</small></span>
                  </label>
                );
              })}
            </div>
            {errors.preferredBody && <span className="apply-field-error">{errors.preferredBody}</span>}
          </div>

          {!canOfferPositions ? (
            <p className="apply-note" role="status">We can’t offer you any positions right now. There are no open positions in a Comelec unit you’re eligible to join.</p>
          ) : !selectedBody ? (
            <p className="apply-note" role="status">Select where you’d like to serve to see open positions.</p>
          ) : !openPositions.length ? (
            <p className="apply-note" role="status">We can’t offer you any positions in this Comelec unit right now. Please choose another available unit or check back later.</p>
          ) : null}

          {selectedBody && openPositions.length > 0 && (
            <div className={`apply-field${errors.position ? " has-error" : ""}`} role="radiogroup" aria-label="Position to apply for">
              <span className="apply-field-label">Position to apply for<Required /></span>
              <div className="apply-choices is-positions">
                {openPositions.map(({ id: value, label }) => {
                  const count = slots[value] ?? 0;
                  return (
                    <label className="apply-choice" key={value}>
                      <input type="radio" name="position" value={value} checked={position === value} onChange={() => { setPosition(value); clearError("position"); }} />
                      <span className="apply-choice-text"><strong>{label}</strong><span className="apply-slots">{slotLabel(count)}</span></span>
                    </label>
                  );
                })}
              </div>
              {errors.position && <span className="apply-field-error">{errors.position}</span>}
            </div>
          )}
        </div>

        <div className="apply-step" hidden={step !== 4}>
          <p className="apply-note">Upload each file to Google Drive, set sharing to <strong>Anyone with the link can view</strong>, then paste the link here.</p>
          <div className="apply-grid">
            <Field label="CV or résumé" error={errors.cvUrl} span={12}>
              <input name="cvUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
            <Field label="Latest Registration Form" error={errors.registrationFormUrl} span={12}>
              <input name="registrationFormUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
            <Field label="Letter of Intent" error={errors.letterOfIntentUrl} span={12}>
              <input name="letterOfIntentUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
            <Field label="Recommendation Letter" error={errors.endorsementUrl} span={12} optional>
              <input name="endorsementUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
            <Field label="Portfolio" hint="Optional, but required for public information and creatives positions." error={errors.portfolioUrl} span={12} optional={!portfolio}>
              <input name="portfolioUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
            <Field label="Latest Copy of Grades" error={errors.gradesUrl} span={12} optional>
              <input name="gradesUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" maxLength={500} />
            </Field>
          </div>
        </div>

        <div className="apply-step" hidden={step !== 5}>
          <div className={`apply-field${errors.interviewSlot ? " has-error" : ""}`}>
            <InterviewPicker key={`${selectedBody}:${college}`} slots={unitInterviews} value={interviewSlot} invalid={Boolean(errors.interviewSlot)} onChange={(id) => { setInterviewSlot(id); clearError("interviewSlot"); }} />
            {errors.interviewSlot && <span className="apply-field-error" role="alert">{errors.interviewSlot}</span>}
          </div>
        </div>

        <div className="apply-step" hidden={step !== 6}>
          {values && <AnswerSections sections={describeAnswers(values, chosenInterview ?? (unitInterviews.length ? "" : interviewLater))} onEdit={(id) => goTo(sectionSteps[id])} />}
          {state?.error && !state.fieldErrors && <p className="apply-form-error" role="alert">{state.error}</p>}
        </div>

        {/* Honeypot: hidden from people, often filled in by spam bots. */}
        <div className="apply-honeypot" aria-hidden="true">
          <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        <footer className="apply-nav">
          {step > 0 ? (
            <button className="apply-back" type="button" onClick={() => goTo(step - 1)} disabled={pending || transitioning}><ArrowLeft size={15} /> Back</button>
          ) : <span />}
          {(step !== 3 || (canOfferPositions && (!selectedBody || openPositions.length > 0))) && (
            <button className="button-primary" type="submit" disabled={pending || transitioning || redirecting || waitingForGoogle || !hydrated}>
              {step === 0 && !verified && !preview ? (waitingForGoogle ? "Waiting for Google…" : <>Continue with UST Google <ArrowRight size={15} /></>) : step === 1 ? <>I confirm <ArrowRight size={15} /></> : step < lastStep ? <>Continue <ArrowRight size={15} /></> : pending ? "Submitting…" : <>Submit application <ArrowRight size={15} /></>}
            </button>
          )}
        </footer>
      </div>
    </form>
  );
}
