"use client";

import { scrollToElement } from "@/lib/scroll";
import { cleanMobileNumber, cleanStudentNumber, tidyPersonName } from "@/lib/forms/input";
import { DownloadIcon } from "@/components/lucide-animated/download";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { CopyIcon as Copy } from "@/components/action-icons";
import { Combobox } from "@/components/combobox";
import { DraftNotice } from "@/components/draft-notice";
import { useFormDraft } from "@/components/use-form-draft";
import { FacebookProfileInput } from "@/components/facebook-profile-input";
import { GoogleMark } from "@/components/portal/login-form";
import { Dropdown, optionsOf } from "@/components/portal/dropdown";
import { useHydrated } from "@/components/portal/portal-form";
import { RoleSelect, useRoleChoice } from "@/components/portal/role-field";
import { forgetAccessVerification, loadJoinProfile, submitAccessRequest, type SubmittedAccessRequest } from "@/lib/access-requests/actions";
import { ACCESS_CHANNEL, accessStatusMessages, type AccessMessage, type AccessProfile, type AccessStep, type JoinProfile } from "@/lib/access-requests/channel";
import { checkAccessRequest, readAccessRequest } from "@/lib/access-requests/schema";
import { colleges, programsByCollege, programLocked, yearLevelsFor, type College } from "@/lib/applications/options";
import { downloadReceipt } from "@/lib/applications/receipt-image";
import { accountPositions, affiliations, commissionerPositions, describeAffiliation, type Affiliation } from "@/lib/data/types";
import { formatAccepted, requestOnboardingSteps, type OnboardingDocument, type OnboardingDocumentKey } from "@/lib/onboarding/documents";
import { LegalText } from "./legal-text";
import "./onboarding.css";

const formatSubmitted = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

const receiptLabels = { kind: "Portal access request", heading: "Access request received", subject: "request" };

const PROFILE = 1;

/** Uppercases a name as it's typed, keeping the cursor where it was. */
function uppercase(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const { selectionStart, selectionEnd } = input;
  input.value = input.value.toUpperCase();
  input.setSelectionRange(selectionStart, selectionEnd);
}

/** Solid green shield with a white check: verified with the requester's UST Google account. */
function VerifiedMark({ label }: { label?: string }) {
  return (
    <span className="portal-verified-mark" role={label ? "img" : undefined} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Field({ label, error, optional, wide, children }: { label: string; error?: string; optional?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`portal-field${wide ? " is-wide" : ""}${error ? " has-error" : ""}`}>
      <span className="portal-field-label">{label}{optional && <span className="portal-muted"> (optional)</span>}</span>
      {children}
      {error && <span className="portal-field-error">{error}</span>}
    </label>
  );
}

/** A neutral panel for a word about this step: an icon carries the colour, the words stay plain. */
function StepNote({ children }: { children: ReactNode }) {
  return <p className="onboarding-note"><Info size={15} aria-hidden="true" /><span>{children}</span></p>;
}

/** Shown once the request is saved: the reference code to track it with, and a copy to keep. */
function AccessReceipt({ result, onBack }: { result?: SubmittedAccessRequest; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "failed">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const approved = Boolean(result?.approved);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);

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
      await downloadReceipt(result, receiptLabels);
      setSaving("idle");
    } catch {
      setSaving("failed");
    }
  };

  return (
    <div className="portal-request" role="status">
      <p className="portal-eyebrow">{approved ? "Join the Commission" : "Request access"}</p>
      <h1 ref={headingRef} tabIndex={-1}>{approved ? <>Welcome to the <em>commission</em></> : "Request received"}</h1>
      <p className="portal-muted portal-login-lede">
        {approved
          ? `Your account is ready, and your declarations are on file. Sign in with Google using ${result?.email}. We’ve emailed you your account’s details.`
          : "The Executive Board will review it. We’ll email your UST account once it’s decided."}
      </p>

      {result && (
        <>
          <div className="portal-receipt-code">
            <div>
              <span>Your reference code</span>
              <strong>{result.referenceCode}</strong>
            </div>
            <button type="button" onClick={copy}>{copied ? <><Check size={15} aria-hidden="true" /> Copied</> : <><Copy size={15} aria-hidden="true" /> Copy</>}</button>
          </div>
          {!approved && <p className="portal-receipt-note">Save this code. To check on your request, open <strong>Track application</strong> and enter it with your student number or last name.</p>}
          <dl className="portal-receipt-details">
            {result.answers.flatMap((section) => section.rows).filter(([, value]) => value).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{label === "UST email" ? <span className="portal-receipt-verified">{value} <VerifiedMark label="Verified with Google" /></span> : value}</dd></div>
            ))}
            <div><dt>Submitted</dt><dd>{formatSubmitted(result.submittedAt)}</dd></div>
          </dl>
          <div className="portal-receipt-save">
            <p className="portal-muted">{saving === "failed" ? "Couldn’t create the image. Take a screenshot instead." : "Keep a copy of this receipt as an image."}</p>
            <button className="portal-button is-ghost is-small" type="button" onClick={save} disabled={saving === "saving"}><DownloadIcon size={14} aria-hidden="true" /> {saving === "saving" ? "Preparing…" : "Download receipt"}</button>
          </div>
        </>
      )}

      <div className="portal-request-nav">
        {approved ? (
          <button className="portal-button" type="button" onClick={onBack}>Sign in <ArrowRight size={15} aria-hidden="true" /></button>
        ) : (
          <>
            <button className="portal-button is-ghost" type="button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</button>
            <Link className="portal-button" href={result ? `/apply/track?ref=${result.referenceCode}` : "/apply/track"}>Track request <ArrowRight size={15} aria-hidden="true" /></Link>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One document to agree to. Its tick box opens once the text has been scrolled to the end; a text
 * short enough to show whole counts as read.
 */
function DocumentStep({ document, acceptedAt, read, onRead, onAccept }: { document: OnboardingDocument; acceptedAt?: string; read: boolean; onRead: () => void; onAccept: (accepted: boolean) => void }) {
  const reader = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (read || !reader.current || !end.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) onRead(); }, { root: reader.current, threshold: 0 });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [read, onRead]);

  return (
    <section className="onboarding-document" aria-label={document.title}>
      <div className="onboarding-reader" ref={reader} tabIndex={0} aria-label={`${document.title}, full text`}>
        <LegalText body={document.body} />
        <span ref={end} className="onboarding-reader-end" aria-hidden="true" />
      </div>
      <label className={`onboarding-agree${read ? "" : " is-locked"}`}>
        <input type="checkbox" checked={Boolean(acceptedAt)} disabled={!read} onChange={(event) => onAccept(event.target.checked)} />
        <span>
          {document.statement}
          <small>{acceptedAt ? `Accepted ${formatAccepted(acceptedAt)} · version ${document.version}` : read ? `Version ${document.version}` : "Scroll to the end of the text to agree."}</small>
        </span>
      </label>
    </section>
  );
}

/**
 * Request access, on the portal's sign-in page, in steps: 0 the Data Privacy Notice and Consent,
 * 1 the requester's profile (they verify their UST Google account first; the email is then filled
 * in and locked), 2–11 the onboarding documents to accept, and 12 Submit, which confirms the same
 * account with Google again. Both Google steps run in a popup that reports back over a
 * BroadcastChannel (src/lib/access-requests/callback.ts).
 *
 * With `join` (an accepted application's reference code, from the acceptance email's Join the
 * Commission button) the profile is filled in from the application, its unit, position and role
 * are fixed, and the request is approved as soon as it's sent. Every other request waits for the
 * Executive Board under Accounts.
 */
export function RequestAccessForm({ profile, onProfileChange, initialStatus, onBack, join, documents }: { profile: AccessProfile | null; onProfileChange: (profile: AccessProfile | null) => void; initialStatus?: string; onBack: () => void; join: string | null; documents: OnboardingDocument[] }) {
  const onboardingSteps = requestOnboardingSteps(documents);
  const LAST = onboardingSteps.length - 1;
  const [state, formAction, pending] = useActionState(submitAccessRequest, undefined);
  const hydrated = useHydrated();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [accepted, setAccepted] = useState<Partial<Record<OnboardingDocumentKey, string>>>({});
  const [read, setRead] = useState<Partial<Record<OnboardingDocumentKey, boolean>>>({});
  const [waiting, setWaiting] = useState<AccessStep | null>(null);
  const [message, setMessage] = useState(initialStatus ? accessStatusMessages[initialStatus as keyof typeof accessStatusMessages] ?? "" : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [college, setCollege] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const unit = useRoleChoice({ affiliation: "", position: "", role: "" }, college);
  const [forgetting, startForgetting] = useTransition();
  /** What Join the Commission found for the verified account: the application, or why there's none. */
  const [joined, setJoined] = useState<{ email: string; profile: JoinProfile | null; note: string } | null>(null);
  /** The answers waiting for the Google confirmation, sent once it comes back. */
  const waitingData = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const levels = yearLevelsFor(college);
  const yearLevelLabels = Object.values(levels);
  const yearLevelValue = (label: string) => Object.entries(levels).find(([, text]) => text === label)?.[0] ?? "";
  const programs: readonly string[] = programsByCollege[college as College] ?? [];
  const documentFor = (key: string) => documents.find((document) => document.key === key);

  const joinFound = joined && profile && joined.email === profile.email ? joined : null;
  const application = joinFound?.profile ?? null;
  const joinLoading = Boolean(join && profile && !joinFound);

  // Take in the server's field errors; they're all on the profile step.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setErrors(state?.fieldErrors ?? {});
    if (state?.fieldErrors && Object.keys(state.fieldErrors).length) setStep(PROFILE);
    if (state?.verification === "expired") setStep(PROFILE);
  }

  // The verification ran out before the request was saved: back to verifying.
  useEffect(() => {
    if (state?.verification === "expired") onProfileChange(null);
  }, [state, onProfileChange]);

  // A new step starts at its top, with its heading read out. Not on opening: the page is already there.
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    const card = headingRef.current?.closest(".portal-login-card");
    if (card) scrollToElement(card, { smooth: true });
  }, [step]);

  // Join the Commission: once the account is verified, its accepted application fills in the profile.
  useEffect(() => {
    if (!join || !profile) return;
    let live = true;
    loadJoinProfile(join).then((result) => {
      if (!live) return;
      const found = "profile" in result ? result.profile : null;
      setJoined({ email: profile.email, profile: found, note: "error" in result ? result.error : "" });
      if (found) {
        setCollege(found.college);
        setProgram(found.program);
        setYearLevel(yearLevelsFor(found.college)[found.yearLevel] ?? "");
      }
    }).catch(() => {
      if (live) setJoined({ email: profile.email, profile: null, note: "Couldn’t load your application. Fill in your details; your request will go to the Executive Board for review." });
    });
    return () => { live = false; };
  }, [join, profile]);

  // The popup's last page reports here, then closes itself.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(ACCESS_CHANNEL);
    channel.onmessage = (event: MessageEvent<AccessMessage>) => {
      const { status, profile: next } = event.data ?? {};
      setWaiting(null);
      if (status === "verified" && next?.email) {
        onProfileChange(next);
        setMessage("");
      } else if (status === "confirmed") {
        const data = waitingData.current;
        waitingData.current = null;
        setMessage("");
        if (data) startTransition(() => formAction(data));
      } else {
        waitingData.current = null;
        if (status === "expired") onProfileChange(null);
        setMessage((status && accessStatusMessages[status]) || accessStatusMessages.failed!);
      }
    };
    return () => channel.close();
  }, [formAction, onProfileChange]);

  /** Opens Google sign-in in a centred popup. Verifying falls back to this window if popups are blocked. */
  const openGoogle = (googleStep: AccessStep) => {
    const url = `/portal/request-access/start?step=${googleStep}${googleStep === "verify" && join ? `&join=${encodeURIComponent(join)}` : ""}`;
    const width = 480;
    const height = 640;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(url, "ust-access-verification", `popup,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
      // Only the consent is given when verifying, so leaving the page loses little. Confirming would lose the answers.
      if (googleStep === "verify") window.open(url, "_self");
      else setMessage("Your browser blocked the Google window. Allow pop-ups for this site, then submit again.");
      return;
    }
    popup.focus();
    setMessage("");
    setWaiting(googleStep);
  };

  const cancelWaiting = () => {
    waitingData.current = null;
    setWaiting(null);
  };

  // Answers stay on this device until sent, kept per verified account, through a reload or a dropped connection.
  const restoring = useRef<{ choice?: string; role?: string } | null>(null);
  const draft = useFormDraft({
    key: profile?.email ? `request-access:${profile.email.toLowerCase()}` : null,
    form: formRef,
    state: { step, furthest, accepted, read, college, program, yearLevel, affiliation: unit.affiliation, choice: unit.choice, role: unit.role },
    restore: (saved) => {
      setAccepted(saved.accepted ?? {});
      setRead(saved.read ?? {});
      setCollege(saved.college ?? "");
      setProgram(saved.program ?? "");
      setYearLevel(saved.yearLevel ?? "");
      if (saved.affiliation) unit.setAffiliation(saved.affiliation);
      restoring.current = { choice: saved.choice, role: saved.role };
      setStep(Math.min(Math.max(0, saved.step ?? 0), LAST));
      setFurthest(Math.min(Math.max(0, saved.furthest ?? 0), LAST));
    },
    // The position and role choices depend on the unit, so they follow once it's back.
    onRestored: () => {
      if (restoring.current?.choice) unit.setChoice(restoring.current.choice);
    },
  });
  const { clear: clearDraft } = draft;
  useEffect(() => { if (state?.submitted) clearDraft(); }, [state?.submitted, clearDraft]);
  // Then the role, once the position's roles are drawn.
  useEffect(() => {
    const role = restoring.current?.role;
    if (!role || !unit.options.includes(role)) return;
    restoring.current = null;
    unit.setRole(role);
  }, [unit]);

  const clearError = (field: string) => setErrors((current) => (current[field] ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)) : current));

  /** The profile's answers as the server will check them; marks the fields that need fixing. */
  const checkProfile = () => {
    if (!profile || !formRef.current) return false;
    const found = checkAccessRequest({ ...readAccessRequest(new FormData(formRef.current)), email: profile.email });
    setErrors(found);
    if (!Object.keys(found).length) return true;
    setStep(PROFILE);
    setMessage("Check the highlighted fields.");
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(".has-error input")?.focus());
    return false;
  };

  /** Whether a step is done, so the next one can open. */
  const complete = (index: number): boolean => {
    const id = onboardingSteps[index]!.id;
    if (id === "profile") return Boolean(profile) && !joinLoading;
    if (id === "submit") return false;
    return Boolean(accepted[id]);
  };

  const goTo = (index: number) => {
    setMessage("");
    setStep(index);
    setFurthest((current) => Math.max(current, index));
  };

  const next = () => {
    if (step === PROFILE && !checkProfile()) return;
    if (!complete(step)) return;
    goTo(Math.min(step + 1, LAST));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Enter in a field moves on, until the last step.
    if (step !== LAST) return next();
    if (!profile) return goTo(PROFILE);
    if (!checkProfile()) return;
    const missing = onboardingSteps.findIndex((item, index) => index !== PROFILE && index !== LAST && !complete(index));
    if (missing !== -1) {
      setStep(missing);
      setMessage("Agree to this document to continue.");
      return;
    }
    // Checked; now prove it's still the same UST account, then send.
    waitingData.current = new FormData(event.currentTarget);
    openGoogle("confirm");
  };

  if (state?.submitted) return <AccessReceipt result={state.result} onBack={onBack} />;

  // A new attempt under way hides the last one's error.
  const alert = message || (waiting || pending ? "" : state?.error ?? "");
  const busy = pending || waiting === "confirm";
  const current = onboardingSteps[step]!;
  const shown = documentFor(current.id);
  const joinLabel = join ? "Join the Commission" : "Request access";
  const groups = [...new Set(onboardingSteps.map((item) => item.group))];

  return (
    <form className="portal-request onboarding" ref={formRef} onSubmit={onSubmit} noValidate>
      {/* Hidden from people; bots that fill it in are ignored. */}
      <input className="portal-visually-hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {join && <input type="hidden" name="join" value={join} />}
      {/* What was agreed to, version and time, for the server to keep. */}
      {documents.map((item) => <input key={item.key} type="hidden" name={`declaration.${item.key}`} value={accepted[item.key] ? `${item.version}|${accepted[item.key]}` : ""} />)}

      <nav className="onboarding-steps" aria-label="Steps">
        {groups.map((group) => (
          <div key={group} className="onboarding-step-group">
            <p>{group}</p>
            <ol>
              {onboardingSteps.map((item, index) => item.group !== group ? null : (
                <li key={item.id}>
                  <button type="button" className={`${index === step ? "is-current" : ""}${index < furthest && complete(index) ? " is-done" : ""}`} aria-current={index === step ? "step" : undefined} disabled={index > furthest || busy} onClick={() => goTo(index)}>
                    <span className="onboarding-step-mark" aria-hidden="true">{index !== step && index < furthest && complete(index) ? <Check size={11} strokeWidth={3} /> : index}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </nav>

      <div className="onboarding-main">
        <div className="onboarding-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(step + 1) / onboardingSteps.length})` }} /></div>
        <p className="portal-eyebrow">{joinLabel} · Step {step} of {LAST}</p>
        <h1 ref={headingRef} tabIndex={-1}>{shown?.title ?? (current.id === "profile" ? (profile ? "Your profile" : "Verify your UST account") : "Review and submit")}</h1>

        {step === 0 && (join
          ? <StepNote>You’ve been accepted into the commission. Finish these steps to join: your profile is filled in from your application, and your access is approved as soon as you submit.</StepNote>
          : <StepNote>For Central and Local Comelec commissioners who don’t have an account yet. Read and agree to each step; the Executive Board reviews every request.</StepNote>)}

        {alert && <p className="portal-form-error portal-login-alert" role="alert">{alert}</p>}
        <DraftNotice draft={draft} buttonClassName="portal-button is-ghost is-small" actionClassName="portal-button" />

        {shown && <DocumentStep key={shown.key} document={shown} acceptedAt={accepted[shown.key]} read={Boolean(read[shown.key])} onRead={() => setRead((was) => (was[shown.key] ? was : { ...was, [shown.key]: true }))} onAccept={(yes) => setAccepted((was) => { const nextAccepted = { ...was }; if (yes) nextAccepted[shown.key] = new Date().toISOString(); else delete nextAccepted[shown.key]; return nextAccepted; })} />}

        {/* The profile stays mounted while other steps show, so its answers go with the form. */}
        <div hidden={step !== PROFILE}>
          {!profile ? (
            <>
              <p className="portal-muted portal-login-lede">{join ? "Verify the UST Google account you applied with. Your accepted application then fills in your profile." : "Verify your UST Google account first. Its email is filled in for you, and confirmed again when you submit."}</p>
              {waiting === "verify" ? (
                <div className="portal-request-waiting" role="status">
                  <p><strong>Waiting for Google…</strong> Finish signing in in the window that opened.</p>
                  <div>
                    <button type="button" onClick={() => openGoogle("verify")}>Open the window again</button>
                    <button type="button" onClick={cancelWaiting}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="portal-button is-block is-google" type="button" onClick={() => openGoogle("verify")} disabled={!hydrated}>
                  <GoogleMark /> Verify with UST Google
                </button>
              )}
            </>
          ) : (
            <>
              <p className="portal-verified-line"><VerifiedMark /><span>Verified as <strong>{profile.email}</strong></span>
                <button type="button" onClick={() => startForgetting(async () => { await forgetAccessVerification(); onProfileChange(null); setJoined(null); })} disabled={busy || forgetting}>Use a different account</button>
              </p>
              {joinLoading && <StepNote>Finding your application…</StepNote>}
              {application && <StepNote>Filled in from your application {application.referenceCode}. Your unit, position and role come from your acceptance; correct anything else that’s changed.</StepNote>}
              {joinFound && !application && <StepNote>{joinFound.note}</StepNote>}

              <fieldset className="portal-request-group" disabled={busy || joinLoading} key={`profile-${profile.email}-${application?.referenceCode ?? ""}`}>
                <legend>Name</legend>
                <div className="portal-form-grid portal-request-name">
                  <Field label="Last name" error={errors.lastName}>
                    <input name="lastName" required autoComplete="family-name" autoCapitalize="characters" maxLength={80} onInput={uppercase} onChange={() => clearError("lastName")} defaultValue={tidyPersonName(application?.lastName ?? profile.lastName)} />
                  </Field>
                  <Field label="First name" error={errors.firstName}>
                    <input name="firstName" required autoComplete="given-name" autoCapitalize="characters" maxLength={80} onInput={uppercase} onChange={() => clearError("firstName")} defaultValue={tidyPersonName(application?.firstName ?? profile.firstName)} />
                  </Field>
                  <Field label="Middle name" error={errors.middleName}>
                    <input name="middleName" autoComplete="additional-name" autoCapitalize="characters" maxLength={80} defaultValue={tidyPersonName(application?.middleName ?? "")} onChange={() => clearError("middleName")} onInput={uppercase} required />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="portal-request-group" disabled={busy || joinLoading} key={`contact-${profile.email}-${application?.referenceCode ?? ""}`}>
                <legend>Contact and student details</legend>
                <div className="portal-form-grid">
                  <Field label="UST email" wide>
                    <span className="portal-input-verified">
                      <input name="email" type="email" value={profile.email} readOnly className="is-fixed" />
                      <VerifiedMark label="Verified with your UST Google account" />
                    </span>
                  </Field>
                  <Field label="Student number" error={errors.studentNumber}>
                    <input name="studentNumber" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="2023123456" defaultValue={cleanStudentNumber(application?.studentNumber ?? "")} onChange={() => clearError("studentNumber")} />
                  </Field>
                  <Field label="Mobile number" error={errors.contactNumber} optional>
                    <input name="contactNumber" type="tel" inputMode="numeric" autoComplete="tel" pattern="09[0-9]{9}" placeholder="09171234567" maxLength={11} defaultValue={cleanMobileNumber(application?.contactNumber ?? "")} onChange={() => clearError("contactNumber")} />
                  </Field>
                  <Field label="Facebook link" error={errors.facebookUrl} optional wide>
                    <FacebookProfileInput defaultValue={application?.facebookUrl ?? ""} invalid={Boolean(errors.facebookUrl)} onChange={() => clearError("facebookUrl")} />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="portal-request-group" disabled={busy || joinLoading}>
                <legend>Academic details</legend>
                <div className="portal-form-grid">
                  <div className={`portal-field is-wide${errors.college ? " has-error" : ""}`}>
                    <span className="portal-field-label" id="request-college-label">College or faculty</span>
                    {application ? (
                      <><input type="hidden" name="college" value={application.college} /><input value={application.college} readOnly className="is-fixed" aria-labelledby="request-college-label" /></>
                    ) : (
                      <Combobox required name="college" options={colleges} value={college} onChange={(nextValue) => { if (nextValue === college) return; setCollege(nextValue); setYearLevel(""); setProgram(""); clearError("college"); }} placeholder="Type or pick your college" invalid={Boolean(errors.college)} labelledBy="request-college-label" />
                    )}
                    {errors.college && <span className="portal-field-error">{errors.college}</span>}
                  </div>
                  <div className={`portal-field${errors.program ? " has-error" : ""}`}>
                    <span className="portal-field-label" id="request-program-label">Program</span>
                    {programLocked(college) ? <input value="None" readOnly aria-label="Program" /> : (
                      <Combobox required key={`${college}-${application?.referenceCode ?? ""}`} name="program" options={programs} value={program} onChange={(nextValue) => { setProgram(nextValue); clearError("program"); }} placeholder={college ? "Type or pick your program" : "Pick a college first"} emptyText="No match. Try another program." disabled={!college} invalid={Boolean(errors.program)} labelledBy="request-program-label" />
                    )}
                    {errors.program && <span className="portal-field-error">{errors.program}</span>}
                  </div>
                  <div className={`portal-field${errors.yearLevel ? " has-error" : ""}`}>
                    <span className="portal-field-label" id="request-year-label">Year level</span>
                    <Combobox required key={`year-${college}-${application?.referenceCode ?? ""}`} name="yearLevel" options={yearLevelLabels} value={yearLevel} submitValue={yearLevelValue(yearLevel)} onChange={(nextValue) => { setYearLevel(nextValue); clearError("yearLevel"); }} placeholder="Select" pickOnly invalid={Boolean(errors.yearLevel)} labelledBy="request-year-label" />
                    {errors.yearLevel && <span className="portal-field-error">{errors.yearLevel}</span>}
                  </div>
                </div>
              </fieldset>

              <fieldset className="portal-request-group" disabled={busy || joinLoading}>
                <legend>In the commission</legend>
                {application ? (
                  <div className="portal-form-grid">
                    {/* Set by the acceptance; the server takes them from the application. */}
                    <input type="hidden" name="affiliation" value={application.affiliation} />
                    <input type="hidden" name="position" value={application.position} />
                    <input type="hidden" name="role" value={application.role} />
                    <Field label="Serves in" wide><input value={describeAffiliation(application.affiliation, application.college)} readOnly className="is-fixed" /></Field>
                    <Field label="Position"><input value={accountPositions[application.position]} readOnly className="is-fixed" /></Field>
                    <Field label="Role"><input value={application.role} readOnly className="is-fixed" title={`Accepted as ${application.appliedFor}`} /></Field>
                  </div>
                ) : (
                  <div className="portal-form-grid">
                    <Field label="Serves in" error={errors.affiliation}>
                      <Dropdown required name="affiliation" value={unit.affiliation} onChange={(nextValue) => { unit.setAffiliation(nextValue as Affiliation); clearError("affiliation"); clearError("role"); }} options={optionsOf(affiliations)} invalid={Boolean(errors.affiliation)} />
                    </Field>
                    <Field label="Position" error={errors.position}>
                      {/* Commissioners ask here; advisers and admins are added by the Executive Board. */}
                      <input type="hidden" name="position" value={unit.position} />
                      <Dropdown required name="positionChoice" value={unit.choice} onChange={(nextValue) => { unit.setChoice(nextValue); clearError("position"); clearError("role"); }} options={unit.choices(commissionerPositions)} invalid={Boolean(errors.position)} />
                    </Field>
                    <Field label="Role" error={errors.role} wide>
                      <RoleSelect name="role" position={unit.position} role={unit.role} options={unit.options} onChange={(nextValue) => { unit.setRole(nextValue); clearError("role"); }} />
                    </Field>
                  </div>
                )}
              </fieldset>
            </>
          )}
        </div>

        {step === LAST && (
          <section className="onboarding-review" aria-label="What you’ve agreed to">
            <p className="portal-muted">{application ? "Check what you’ve agreed to. Submitting asks you to sign in with Google once more; your account is then ready straight away." : "Check what you’ve agreed to. Submitting asks you to sign in with Google once more, then the Executive Board reviews your request."}</p>
            <ul>
              {documents.map((item) => (
                <li key={item.key}>
                  <span className={`onboarding-review-mark${accepted[item.key] ? " is-done" : ""}`} aria-hidden="true">{accepted[item.key] && <Check size={11} strokeWidth={3} />}</span>
                  <span>{item.title}<small>{accepted[item.key] ? `Accepted ${formatAccepted(accepted[item.key]!)} · version ${item.version}` : "Not yet agreed to"}</small></span>
                </li>
              ))}
            </ul>
            {waiting === "confirm" && profile && (
              <div className="portal-request-waiting" role="status">
                <p><strong>Confirm it’s you.</strong> Sign in again with {profile.email} in the window that opened; your request is sent as soon as you do.</p>
                <div>
                  <button type="button" onClick={() => openGoogle("confirm")}>Open the window again</button>
                  <button type="button" onClick={cancelWaiting}>Cancel</button>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="portal-request-nav">
          {step === 0 ? (
            <button className="portal-button is-ghost" type="button" onClick={onBack} disabled={pending}><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</button>
          ) : (
            <button className="portal-button is-ghost" type="button" onClick={() => goTo(step - 1)} disabled={busy}><ArrowLeft size={15} aria-hidden="true" /> Back</button>
          )}
          {step === LAST ? (
            <button className="portal-button" type="submit" disabled={busy || !hydrated || !profile}>
              {pending ? "Submitting…" : waiting === "confirm" ? "Waiting for Google…" : <>{application ? "Confirm with Google and join" : "Confirm with Google and submit"} <ArrowRight size={15} aria-hidden="true" /></>}
            </button>
          ) : (
            <button className="portal-button" type="submit" disabled={!hydrated || busy || !complete(step)}>
              Next <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        {step === LAST && profile && <p className="portal-request-fineprint portal-muted">Submitting asks you to sign in with Google once more, to confirm it comes from {profile.email}. Your request is deleted 60 days after you send it; what you agreed to stays on your account.</p>}
      </div>
    </form>
  );
}
