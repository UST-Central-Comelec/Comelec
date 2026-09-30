"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Download } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { GoogleMark } from "@/components/portal/login-form";
import { useHydrated } from "@/components/portal/portal-form";
import { forgetAccessVerification, submitAccessRequest, type SubmittedAccessRequest } from "@/lib/access-requests/actions";
import { ACCESS_CHANNEL, accessStatusMessages, type AccessMessage, type AccessProfile, type AccessStep } from "@/lib/access-requests/channel";
import { checkAccessRequest, readAccessRequest } from "@/lib/access-requests/schema";
import { colleges, programsByCollege, yearLevels, type College } from "@/lib/applications/options";
import { downloadReceipt } from "@/lib/applications/receipt-image";
import { affiliations } from "@/lib/data/types";

const yearLevelLabels: readonly string[] = Object.values(yearLevels);
const yearLevelValue = (label: string) => Object.entries(yearLevels).find(([, text]) => text === label)?.[0] ?? "";

const formatSubmitted = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

const receiptLabels = { kind: "Portal access request", heading: "Access request received", subject: "request" };

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

/** Shown once the request is saved: the reference code to track it with, and a copy to keep. */
function AccessReceipt({ result, onBack }: { result?: SubmittedAccessRequest; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "failed">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);

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
      <p className="portal-eyebrow">Request access</p>
      <h1 ref={headingRef} tabIndex={-1}>Request received</h1>
      <p className="portal-muted portal-login-lede">A Central Comelec executive will review it. We’ll email your UST account once it’s decided.</p>

      {result && (
        <>
          <div className="portal-receipt-code">
            <div>
              <span>Your reference code</span>
              <strong>{result.referenceCode}</strong>
            </div>
            <button type="button" onClick={copy}>{copied ? <><Check size={15} aria-hidden="true" /> Copied</> : <><Copy size={15} aria-hidden="true" /> Copy</>}</button>
          </div>
          <p className="portal-receipt-note">Save this code. To check on your request, open <strong>Track application</strong> and enter it with your student number.</p>
          <dl className="portal-receipt-details">
            {result.answers.flatMap((section) => section.rows).filter(([, value]) => value).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{label === "UST email" ? <span className="portal-receipt-verified">{value} <VerifiedMark label="Verified with Google" /></span> : value}</dd></div>
            ))}
            <div><dt>Submitted</dt><dd>{formatSubmitted(result.submittedAt)}</dd></div>
          </dl>
          <div className="portal-receipt-save">
            <p className="portal-muted">{saving === "failed" ? "Couldn’t create the image. Take a screenshot instead." : "Keep a copy of this receipt as an image."}</p>
            <button className="portal-button is-ghost is-small" type="button" onClick={save} disabled={saving === "saving"}><Download size={14} aria-hidden="true" /> {saving === "saving" ? "Preparing…" : "Download receipt"}</button>
          </div>
        </>
      )}

      <div className="portal-request-nav">
        <button className="portal-button is-ghost" type="button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</button>
        <Link className="portal-button" href={result ? `/apply/track?ref=${result.referenceCode}` : "/apply/track"}>Track request <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}

/**
 * Request access, on the portal's sign-in page. The requester verifies their UST Google account
 * first (the email is then filled in and locked), fills in About you, and confirms the same
 * account with Google again to submit. Both Google steps run in a popup that reports back over a
 * BroadcastChannel (src/lib/access-requests/callback.ts).
 */
export function RequestAccessForm({ profile, onProfileChange, initialStatus, onBack }: { profile: AccessProfile | null; onProfileChange: (profile: AccessProfile | null) => void; initialStatus?: string; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(submitAccessRequest, undefined);
  const hydrated = useHydrated();
  const [waiting, setWaiting] = useState<AccessStep | null>(null);
  const [message, setMessage] = useState(initialStatus ? accessStatusMessages[initialStatus as keyof typeof accessStatusMessages] ?? "" : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [college, setCollege] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [forgetting, startForgetting] = useTransition();
  /** The answers waiting for the Google confirmation, sent once it comes back. */
  const waitingData = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const programs: readonly string[] = programsByCollege[college as College] ?? [];

  // Take in the server's field errors.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setErrors(state?.fieldErrors ?? {});
  }

  // The verification ran out before the request was saved: back to verifying.
  useEffect(() => {
    if (state?.verification === "expired") onProfileChange(null);
  }, [state, onProfileChange]);

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
  const openGoogle = (step: AccessStep) => {
    const url = `/portal/request-access/start?step=${step}`;
    const width = 480;
    const height = 640;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(url, "ust-access-verification", `popup,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
      // Nothing is typed yet when verifying, so leaving the page loses nothing. Confirming would lose the answers.
      if (step === "verify") window.open(url, "_self");
      else setMessage("Your browser blocked the Google window. Allow pop-ups for this site, then submit again.");
      return;
    }
    popup.focus();
    setMessage("");
    setWaiting(step);
  };

  const cancelWaiting = () => {
    waitingData.current = null;
    setWaiting(null);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return openGoogle("verify");
    const formData = new FormData(event.currentTarget);
    const found = checkAccessRequest({ ...readAccessRequest(formData), email: profile.email });
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage("Check the highlighted fields.");
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(".has-error input")?.focus());
      return;
    }
    // Checked; now prove it's still the same UST account, then send.
    waitingData.current = formData;
    openGoogle("confirm");
  };

  const clearError = (field: string) => setErrors((current) => (current[field] ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)) : current));

  if (state?.submitted) return <AccessReceipt result={state.result} onBack={onBack} />;

  // A new attempt under way hides the last one's error.
  const alert = message || (waiting || pending ? "" : state?.error ?? "");

  if (!profile) {
    return (
      <div className="portal-request">
        <p className="portal-eyebrow">Request access</p>
        <h1>Request portal access</h1>
        <p className="portal-muted portal-login-lede">For Central Comelec commissioners and officers who don’t have an account yet. First, verify your UST Google account; then tell us about yourself. An executive reviews every request.</p>

        {alert && <p className="portal-form-error portal-login-alert" role="alert">{alert}</p>}

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

        <div className="portal-request-nav">
          <button className="portal-button is-ghost" type="button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</button>
        </div>
      </div>
    );
  }

  const busy = pending || waiting === "confirm";

  return (
    <form className="portal-request" ref={formRef} onSubmit={onSubmit} noValidate>
      <p className="portal-eyebrow">Request access</p>
      <h1>About you</h1>
      <p className="portal-verified-line"><VerifiedMark /><span>Verified as <strong>{profile.email}</strong></span>
        <button type="button" onClick={() => startForgetting(async () => { await forgetAccessVerification(); onProfileChange(null); })} disabled={busy || forgetting}>Use a different account</button>
      </p>

      {/* Hidden from people; bots that fill it in are ignored. */}
      <input className="portal-visually-hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <fieldset className="portal-request-group" disabled={busy}>
        <legend>Name</legend>
        <div className="portal-form-grid portal-request-name">
          <Field label="Last name" error={errors.lastName}>
            <input name="lastName" autoComplete="family-name" autoCapitalize="characters" maxLength={80} onInput={uppercase} onChange={() => clearError("lastName")} key={`last-${profile.email}`} defaultValue={profile.lastName.toUpperCase()} />
          </Field>
          <Field label="First name" error={errors.firstName}>
            <input name="firstName" autoComplete="given-name" autoCapitalize="characters" maxLength={80} onInput={uppercase} onChange={() => clearError("firstName")} key={`first-${profile.email}`} defaultValue={profile.firstName.toUpperCase()} />
          </Field>
          <Field label="M.I." error={errors.middleInitial}>
            <input name="middleInitial" autoComplete="additional-name" autoCapitalize="characters" maxLength={1} placeholder="M" onChange={() => clearError("middleInitial")} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^\p{L}]/gu, "").toUpperCase(); }} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="portal-request-group" disabled={busy}>
        <legend>Contact and student details</legend>
        <div className="portal-form-grid">
          <Field label="UST email" wide>
            <span className="portal-input-verified">
              <input name="email" type="email" value={profile.email} readOnly className="is-fixed" />
              <VerifiedMark label="Verified with your UST Google account" />
            </span>
          </Field>
          <Field label="Student number" error={errors.studentNumber}>
            <input name="studentNumber" inputMode="numeric" maxLength={10} placeholder="2023123456" onChange={() => clearError("studentNumber")} />
          </Field>
          <Field label="Mobile number" error={errors.contactNumber} optional>
            <input name="contactNumber" type="tel" autoComplete="tel" placeholder="0917 123 4567" maxLength={16} onChange={() => clearError("contactNumber")} />
          </Field>
          <Field label="Serves in" error={errors.affiliation}>
            <select name="affiliation" defaultValue="" required onChange={() => clearError("affiliation")}>
              <option value="" disabled>Select</option>
              {Object.entries(affiliations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Position in the commission" error={errors.position}>
            <input name="position" maxLength={120} placeholder="e.g. Commissioner, Documentation" onChange={() => clearError("position")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="portal-request-group" disabled={busy}>
        <legend>Academic details</legend>
        <div className="portal-form-grid">
          <div className={`portal-field is-wide${errors.college ? " has-error" : ""}`}>
            <span className="portal-field-label" id="request-college-label">College or faculty</span>
            <Combobox name="college" options={colleges} value={college} onChange={(next) => { if (next === college) return; setCollege(next); setProgram(""); clearError("college"); }} placeholder="Type or pick your college" invalid={Boolean(errors.college)} labelledBy="request-college-label" />
            {errors.college && <span className="portal-field-error">{errors.college}</span>}
          </div>
          <div className={`portal-field${errors.program ? " has-error" : ""}`}>
            <span className="portal-field-label" id="request-program-label">Program</span>
            <Combobox key={college} name="program" options={programs} value={program} onChange={(next) => { setProgram(next); clearError("program"); }} placeholder={college ? "Type or pick your program" : "Pick a college first"} emptyText="No match. Try another program." disabled={!college} invalid={Boolean(errors.program)} labelledBy="request-program-label" />
            {errors.program && <span className="portal-field-error">{errors.program}</span>}
          </div>
          <div className={`portal-field${errors.yearLevel ? " has-error" : ""}`}>
            <span className="portal-field-label" id="request-year-label">Year level</span>
            <Combobox name="yearLevel" options={yearLevelLabels} value={yearLevel} submitValue={yearLevelValue(yearLevel)} onChange={(next) => { setYearLevel(next); clearError("yearLevel"); }} placeholder="Select" pickOnly invalid={Boolean(errors.yearLevel)} labelledBy="request-year-label" />
            {errors.yearLevel && <span className="portal-field-error">{errors.yearLevel}</span>}
          </div>
        </div>
      </fieldset>

      {alert && <p className="portal-form-error portal-login-alert" role="alert">{alert}</p>}
      {waiting === "confirm" && (
        <div className="portal-request-waiting" role="status">
          <p><strong>Confirm it’s you.</strong> Sign in again with {profile.email} in the window that opened; your request is sent as soon as you do.</p>
          <div>
            <button type="button" onClick={() => openGoogle("confirm")}>Open the window again</button>
            <button type="button" onClick={cancelWaiting}>Cancel</button>
          </div>
        </div>
      )}

      <div className="portal-request-nav">
        <button className="portal-button is-ghost" type="button" onClick={onBack} disabled={pending}><ArrowLeft size={15} aria-hidden="true" /> Back</button>
        <button className="portal-button" type="submit" disabled={busy || !hydrated}>
          {pending ? "Submitting…" : waiting === "confirm" ? "Waiting for Google…" : <>Confirm with Google and submit <ArrowRight size={15} aria-hidden="true" /></>}
        </button>
      </div>
      <p className="portal-request-fineprint portal-muted">Submitting asks you to sign in with Google once more, to confirm the request comes from {profile.email}. Your request is deleted 60 days after you send it.</p>
    </form>
  );
}
