"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { startTransition, useActionState, useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Info, UserPlus, Users, UserRound } from "lucide-react";
import { ApplyTracker, Field, Required, ReviewSection } from "@/components/apply-form-parts";
import { SESSION_SLOT } from "@/components/apply-banner";
import { Combobox } from "@/components/combobox";
import { DraftExpired, DraftStrip } from "@/components/draft-notice";
import { EventConsentStatement } from "@/components/events/event-form-ui";
import { FacebookProfileInput } from "@/components/facebook-profile-input";
import { DatePicker } from "@/components/portal/date-picker";
import { useHydrated } from "@/components/portal/portal-form";
import { useFormDraft } from "@/components/use-form-draft";
import { colleges, programLocked, programsByCollege, yearLevelsFor, type College } from "@/lib/applications/options";
import { digitsOnly, formatMobileNumber, formatNumericInput } from "@/lib/applications/numeric-input";
import { tidyPersonName, titleCaseText } from "@/lib/forms/input";
import { fileCandidacy } from "@/lib/candidacy/actions";
import { oathDeclarations } from "@/lib/candidacy/content";
import { candidacyErrors } from "@/lib/candidacy/schema";
import { councilOf } from "@/lib/candidacy/types";
import { forgetFilingVerification, loadSignUpContext } from "@/lib/filing-portal/actions";
import { FILING_CHANNEL, type FilingVerifyMessage } from "@/lib/filing-portal/channel";
import { profileErrors, readSignUp, today, type SignUpValues } from "@/lib/filing-portal/schema";
import type { ProfileSummary } from "@/lib/filing-portal/types";
import { registerParty } from "@/lib/party-portal/actions";
import { partyErrors, partyNameKey } from "@/lib/party-portal/schema";
import { unitName, yearLevelLabel, type JoinableParty } from "@/lib/party-portal/types";
import { scrollToElement, scrollToTop } from "@/lib/scroll";
import "@/components/application-form-ui.css";
import "./sign-up.css";

// The filing portal's sign-up, on Political Party Registration (`purpose="party"`) and Filing of
// Candidacy (`purpose="candidacy"`), in the same step-by-step form as the commissioner application
// (application-form.tsx): consent and a UST Google account first, then who they are, then the
// application. One account holds both: someone who already has it sees their profile on About you
// rather than filling it in again. Then they carry on in the filing portal (/filing).

type Purpose = "party" | "candidacy";
type UnitChoice = { value: string; label: string; closes: string | null };
type Verified = { email: string; firstName: string; lastName: string };
type Mode = "" | "join" | "create";

const stepsFor = (purpose: Purpose) => [
  { title: "Data Privacy Consent", description: "Read how we handle your personal information, give your consent, then verify with your UST Google account." },
  { title: "About you", description: "Your name, how to reach you, and where you study. This is your profile in the filing portal." },
  purpose === "party"
    ? { title: "Your party", description: "Join a party that’s already registering, or make a new one." }
    : { title: "Your candidacy", description: "The unit you’re filing with, the position you’re running for, and what your certificate of candidacy states." },
  purpose === "party"
    ? { title: "Submit", description: "Check your answers, then send them." }
    : { title: "Oath and submit", description: "Check your answers, take the oath, then file your certificate of candidacy." },
];
const lastStep = 3;
/** How long a step takes to slide out before the next one slides in (apply-body.is-leaving in globals.css). */
const STEP_LEAVE_MS = 180;

const profileKeys = ["lastName", "firstName", "middleName", "studentNumber", "contactNumber", "facebookUrl", "college", "program", "yearLevel"];
const stepOf = (field: string) => (field === "consent" ? 0 : profileKeys.includes(field) ? 1 : field === "oath" ? 3 : 2);

/** Why verification didn't complete, from the popup or ?verify= after Google sends them back. */
const verifyMessages: Record<string, string> = {
  "not-ust": "That wasn’t a UST account. Sign in with your @ust.edu.ph Google account.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
  unavailable: "Verification isn’t available right now. Please email comelec@ust.edu.ph.",
};

/** Uppercases a name as it's typed, keeping the cursor where it was. */
function uppercase(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const { selectionStart, selectionEnd } = input;
  input.value = input.value.toUpperCase();
  input.setSelectionRange(selectionStart, selectionEnd);
}

/** Capitalizes each word as it's typed (places), keeping the cursor. */
function titleCase(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const at = input.selectionStart;
  input.value = titleCaseText(input.value);
  if (at !== null) input.setSelectionRange(at, at);
}

const formatDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : iso);
const unitKey = (value: string) => (value === "central" ? "" : value);

type Birth = { year: string; month: string; day: string };
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Date of birth as Month, Day and Year pickers: years back from the youngest a student could be,
 * rather than a calendar that opens on this month. Sent as one date (dateOfBirth) once all three are picked.
 */
function BirthDateField({ value, restores, error, onChange }: { value: Birth; restores: number; error?: string; onChange: (next: Birth) => void }) {
  const thisYear = Number(today().slice(0, 4));
  const years = Array.from({ length: 41 }, (_, index) => String(thisYear - 10 - index));
  const monthIndex = monthNames.indexOf(value.month);
  const daysIn = monthIndex < 0 ? 31 : new Date(Date.UTC(Number(value.year) || 2000, monthIndex + 1, 0)).getUTCDate();
  const days = Array.from({ length: daysIn }, (_, index) => String(index + 1));
  const complete = value.year && monthIndex >= 0 && value.day;
  const iso = complete ? `${value.year}-${String(monthIndex + 1).padStart(2, "0")}-${value.day.padStart(2, "0")}` : "";
  return (
    <div className={`apply-field span-6${error ? " has-error" : ""}`}>
      <span className="apply-field-label" id="signup-birth-label">Date of birth<Required /></span>
      <div className="pp-birth">
        <span className="visually-hidden" id="signup-birth-month">Birth month</span>
        <span className="visually-hidden" id="signup-birth-day">Birth day</span>
        <span className="visually-hidden" id="signup-birth-year">Birth year</span>
        <Combobox key={`month-${restores}`} name="birthMonth" options={monthNames} value={value.month} onChange={(month) => onChange({ ...value, month, day: Number(value.day) > new Date(Date.UTC(Number(value.year) || 2000, monthNames.indexOf(month) + 1, 0)).getUTCDate() ? "" : value.day })} placeholder="Month" pickOnly required invalid={Boolean(error)} labelledBy="signup-birth-month" />
        <Combobox key={`day-${restores}`} name="birthDay" options={days} value={value.day} onChange={(day) => onChange({ ...value, day })} placeholder="Day" pickOnly required invalid={Boolean(error)} labelledBy="signup-birth-day" />
        <Combobox key={`year-${restores}`} name="birthYear" options={years} value={value.year} onChange={(year) => onChange({ ...value, year })} placeholder="Year" pickOnly required invalid={Boolean(error)} labelledBy="signup-birth-year" />
      </div>
      <input type="hidden" name="dateOfBirth" value={iso} />
      {error && <span className="apply-field-error">{error}</span>}
    </div>
  );
}

export function FilingSignUp({ purpose, units, initialUnit, verified: verifiedAtLoad, profile: profileAtLoad, parties: partiesAtLoad, positions, verifyStatus }: {
  purpose: Purpose;
  /** The units taking this application now: "central", or a Local unit's college. */
  units: UnitChoice[];
  initialUnit: string;
  verified: Verified | null;
  /** The account this verified email already has, if any: About you shows it instead of asking. */
  profile: ProfileSummary | null;
  /** Parties to pick, loaded once verified: pending ones to join, or accredited ones to run under. */
  parties: JoinableParty[];
  /** Filing of Candidacy: each unit's elective positions, by unit ("" for the Central Comelec). */
  positions: Record<string, string[]>;
  verifyStatus?: string;
}) {
  const steps = stepsFor(purpose);
  const trackerSteps = [...steps.map((step) => step.title), "Your portal"];
  const [state, formAction, pending] = useActionState(purpose === "party" ? registerParty : fileCandidacy, undefined);
  const [step, setStep] = useState(verifiedAtLoad ? 1 : 0);
  const [reached, setReached] = useState(verifiedAtLoad ? 1 : 0);
  const [verifiedNow, setVerifiedNow] = useState<Verified | null>(null);
  const verified = state?.expired && !verifiedNow ? null : (verifiedNow ?? verifiedAtLoad);
  const [profile, setProfile] = useState(profileAtLoad);
  const [hasFiled, setHasFiled] = useState(verifyStatus === "has-account");
  const [waitingForGoogle, setWaitingForGoogle] = useState(false);
  const [verifyError, setVerifyError] = useState(verifyStatus && verifyMessages[verifyStatus] ? verifyStatus : "");
  const [redirecting, startRedirect] = useTransition();
  const [parties, setParties] = useState(partiesAtLoad);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<SignUpValues | null>(null);
  const [college, setCollege] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  // Political Party Registration
  const [mode, setMode] = useState<Mode>("");
  const [joinName, setJoinName] = useState("");
  const [partyName, setPartyName] = useState("");
  const [establishedAt, setEstablishedAt] = useState("");
  // Both: the unit filed with
  const [unit, setUnit] = useState(initialUnit);
  // Filing of Candidacy
  const [position, setPosition] = useState("");
  const [runningFor, setRunningFor] = useState<"" | "party" | "independent">("");
  const [runningParty, setRunningParty] = useState("");
  const [birth, setBirth] = useState<Birth>({ year: "", month: "", day: "" });
  // Pickers draw their answer once, as they mount; after a reload brings answers back they're drawn again.
  const [restores, setRestores] = useState(0);
  const [handledState, setHandledState] = useState(state);
  const [moved, setMoved] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const transitionLock = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const popupRef = useRef<Window | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hydrated = useHydrated();

  const programs: readonly string[] = programsByCollege[college as College] ?? [];
  const levels = yearLevelsFor(college);
  const yearLevelLabels = Object.values(levels);
  const yearLevelValue = (label: string) => Object.entries(levels).find(([, text]) => text === label)?.[0] ?? "";
  const openKeys = units.map((item) => unitKey(item.value));
  const pickedUnit = units.find((item) => item.value === unit);
  // Political Party Registration: the party joined, or a new name that's already taken.
  const joining = parties.find((party) => party.name === joinName) ?? null;
  const clash = mode === "create" && partyName.trim() ? parties.find((party) => partyNameKey(party.name) === partyNameKey(partyName)) ?? null : null;
  // Filing of Candidacy: the unit's positions, and its accredited parties to run under.
  const unitPositions = unit ? positions[unitKey(unit)] ?? [] : [];
  const unitParties = unit ? parties.filter((party) => party.college === unitKey(unit)) : [];
  const runningUnder = unitParties.find((party) => party.name === runningParty) ?? null;

  const read = () => readSignUp(new FormData(formRef.current ?? undefined));

  // When the server rejects an answer, show its message and go back to the step that holds it.
  if (state !== handledState) {
    setHandledState(state);
    const fields = Object.keys(state?.fieldErrors ?? {});
    if (fields.length) {
      setErrors(state!.fieldErrors!);
      setStep(Math.min(...fields.map(stepOf)));
      setMoved(true);
    } else if (state?.expired) {
      setStep(0);
      setMoved(true);
    }
  }

  // Answers stay on this device until sent, kept per verified account, so a reload doesn't mean
  // starting again and nobody else's answers come back on a shared computer.
  const draft = useFormDraft({
    key: verified?.email ? `${purpose}-signup:${verified.email.toLowerCase()}` : null,
    form: formRef,
    state: { step, reached, college, program, yearLevel, mode, joinName, partyName, establishedAt, unit, position, runningFor, runningParty, birth },
    restore: (saved) => {
      setCollege(saved.college ?? "");
      setProgram(saved.program ?? "");
      setYearLevel(saved.yearLevel ?? "");
      setMode(saved.mode ?? "");
      setJoinName(saved.joinName ?? "");
      setPartyName(saved.partyName ?? "");
      setEstablishedAt(saved.establishedAt ?? "");
      if (units.some((item) => item.value === saved.unit)) setUnit(saved.unit);
      setPosition(saved.position ?? "");
      setRunningFor(saved.runningFor ?? "");
      setRunningParty(saved.runningParty ?? "");
      setBirth({ year: saved.birth?.year ?? "", month: saved.birth?.month ?? "", day: saved.birth?.day ?? "" });
      setRestores((count) => count + 1);
      setStep(Math.min(Math.max(1, saved.step ?? 1), lastStep));
      setReached((current) => Math.max(current, Math.min(saved.reached ?? 1, lastStep)));
      setMoved(true);
    },
    onRestored: () => setValues(read()),
  });
  const sessionSlot = hydrated ? document.getElementById(SESSION_SLOT) : null;

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  // Reset before painting the new step so it opens at the top.
  useLayoutEffect(() => {
    if (!moved) return;
    headingRef.current?.focus({ preventScroll: true });
    scrollToTop(0);
  }, [step, moved]);

  // The popup's last page reports here, then closes itself.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(FILING_CHANNEL);
    channel.onmessage = (event: MessageEvent<FilingVerifyMessage>) => {
      const { status, profile: verifiedProfile } = event.data ?? {};
      setWaitingForGoogle(false);
      if (status === "has-account") {
        setHasFiled(true);
        setVerifyError("");
      } else if (status === "ok" && verifiedProfile?.email) {
        setVerifiedNow(verifiedProfile);
        setVerifyError("");
        setErrors((current) => { const next = { ...current }; delete next.consent; return next; });
        setStep(1);
        setReached((current) => Math.max(current, 1));
        setMoved(true);
        void loadSignUpContext(purpose).then((context) => {
          setProfile(context.profile);
          setParties(context.parties);
        });
      } else {
        setVerifyError(status || "failed");
      }
    };
    return () => channel.close();
  }, [purpose]);

  /** Opens Google sign-in in a centred popup, or in this window if popups are blocked. */
  const openVerification = () => {
    const url = `/filing/auth/start?mode=${purpose}`;
    const width = 480;
    const height = 640;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(url, "ust-filing-verification", `popup,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
      window.open(url, "_self");
      return;
    }
    popup.focus();
    popupRef.current = popup;
    setVerifyError("");
    setWaitingForGoogle(true);
  };

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

  /** The problems on one step, from the answers given. */
  const problemsOn = (index: number, answers: SignUpValues): Record<string, string> => {
    if (index === 0) return answers.consent ? {} : { consent: "Tick this box to continue." };
    if (index === 1) return profile ? {} : profileErrors(answers);
    if (index === 2 && purpose === "party") {
      if (!mode) return { mode: "Choose whether you’re joining a party or making a new one." };
      if (mode === "join") return answers.partyId ? {} : { partyId: "Pick your party from the list." };
      const found = partyErrors(answers, openKeys);
      if (clash) found.partyName ??= "A party with that name is already registering. Ask to join it, or use another name.";
      return found;
    }
    if (index === 2) {
      const found = candidacyErrors(answers, openKeys, positions, parties, { oath: false });
      if (found.runningFor) found.runningFor = "Choose whether you’re running under a party or as an independent.";
      return found;
    }
    if (index === 3 && purpose === "candidacy") return answers.oath ? {} : { oath: "Take the oath to file your certificate of candidacy." };
    return {};
  };

  const checkStep = (index: number) => {
    const found = problemsOn(index, read());
    setErrors((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([field]) => stepOf(field) !== index)), ...found }));
    if (Object.keys(found).length) requestAnimationFrame(() => {
      const problem = formRef.current?.querySelector(".apply-step:not([hidden]) :is(.has-error, .apply-field-error)");
      if (problem) scrollToElement(problem, { smooth: true, center: true });
    });
    return Object.keys(found).length === 0;
  };

  const clearError = (field: string) => {
    if (!errors[field]) return;
    setErrors((current) => { const next = { ...current }; delete next[field]; return next; });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (transitionLock.current || pending) return;
    if (!checkStep(step)) return;
    // Consent given: off to Google to prove it's a UST account. They come back verified at About you.
    if (step === 0 && !verified) return openVerification();
    if (step < lastStep) return goTo(step + 1);
    for (let index = 0; index < lastStep; index++) {
      if (!checkStep(index)) return goTo(index);
    }
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  const complete = steps.map((_, index) => !values || Object.keys(problemsOn(index, values)).length === 0);
  // Who the person is, from the account if it has one, else from About you as typed.
  const person = profile
    ? { name: [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" "), mobile: profile.mobileNumber }
    : { name: values ? [values.firstName, values.middleName, values.lastName].filter(Boolean).join(" ") : "", mobile: values?.contactNumber ?? "" };
  const aboutRows: Array<[string, string]> = profile
    ? [["Name", [profile.lastName, [profile.firstName, profile.middleName].filter(Boolean).join(" ")].filter(Boolean).join(", ")], ["Student number", profile.studentNumber], ["Mobile number", profile.mobileNumber], ["UST email", profile.email], ["Facebook", profile.facebookUrl], ["College or faculty", profile.college], ["Program", programLocked(profile.college) ? "None" : profile.program], ["Year level", yearLevelLabel(profile.yearLevel)]]
    : values ? [["Name", [values.lastName, [values.firstName, values.middleName].filter(Boolean).join(" ")].filter(Boolean).join(", ")], ["Student number", values.studentNumber], ["Mobile number", values.contactNumber], ["UST email", verified?.email ?? ""], ["Facebook", values.facebookUrl], ["College or faculty", values.college], ["Program", programLocked(values.college) ? "None" : values.program], ["Year level", yearLevelLabel(values.yearLevel)]] : [];
  const unitChoices = (noun: string) => (
    <div className={`apply-field${errors.unit ? " has-error" : ""}`} role="radiogroup" aria-labelledby="signup-unit-label">
      <span className="apply-field-label" id="signup-unit-label">{noun}<Required /></span>
      <div className={`apply-choices${units.length <= 2 ? " is-2" : ""}`}>
        {units.map((item) => (
          <label className="apply-choice" key={item.value}>
            <input type="radio" name="unit" value={item.value} checked={unit === item.value} required onChange={() => { setUnit(item.value); setPosition(""); setRunningParty(""); clearError("unit"); }} />
            <span className="apply-choice-text"><strong>{item.label}</strong><small>{item.closes ? `Open until ${item.closes}` : "Open, with no closing date"}</small></span>
          </label>
        ))}
      </div>
      {errors.unit && <span className="apply-field-error">{errors.unit}</span>}
    </div>
  );

  return (
    <form ref={formRef} className="apply-form" onSubmit={onSubmit} onInput={(event) => clearError((event.target as HTMLInputElement).name)} noValidate>
      <ApplyTracker titles={trackerSteps} current={step} step={step} reached={reached} submitted={false} complete={complete} busy={pending || transitioning} onGo={goTo} label="Sign-up progress" />
      <DraftExpired draft={draft} actionClassName="button-primary" />
      {sessionSlot && createPortal(<DraftStrip draft={draft} />, sessionSlot)}

      <div className={`apply-body${leaving ? " is-leaving" : ""}`} data-direction={direction}>
        <div className="apply-body-head" key={step}>
          <span>Step {step + 1} of {trackerSteps.length}</span>
          <h2 ref={headingRef} tabIndex={-1}>{steps[step].title}</h2>
          <p>{steps[step].description}</p>
        </div>

        {/* Every step stays in the form so all answers are sent together; only the current one shows. */}
        <div className="apply-step" hidden={step !== 0}>
          <section className={`apply-privacy${errors.consent ? " has-error" : ""}`} aria-label="Data Privacy Consent">
            <EventConsentStatement id={`${purpose}-privacy`} />
            <label className={`apply-consent${errors.consent ? " has-error" : ""}`}>
              {verified ? <><input type="checkbox" checked disabled readOnly /><input type="hidden" name="consent" value="on" /></> : <input name="consent" type="checkbox" required />}
              <span>I have read the UST Central Comelec Data Privacy Statement and consent to the collection and processing of my personal information for my {purpose === "party" ? "party’s registration" : "candidacy"}.<Required /></span>
            </label>
          </section>
          {errors.consent && <span className="apply-field-error">{errors.consent}</span>}
          {hasFiled ? (
            <div className="apply-verified" role="status">
              <Check size={18} aria-hidden="true" />
              <p>{purpose === "party" ? "This UST account is already in a party here" : "This UST account has already filed a candidacy"}, so you’re signed in to the filing portal.</p>
              <a className="pp-link" href={purpose === "party" ? "/filing" : "/filing/candidacy"}>Open the filing portal</a>
            </div>
          ) : verified ? (
            <div className="apply-verified">
              <Check size={18} aria-hidden="true" />
              <p>Verified as <strong>{verified.email}</strong></p>
              <button type="button" onClick={() => startRedirect(() => forgetFilingVerification(purpose))} disabled={redirecting}>Use a different account</button>
            </div>
          ) : waitingForGoogle ? (
            <div className="apply-verify-waiting" role="status">
              <p>Finish signing in with Google in the window that just opened. This page will continue on its own.</p>
              <div>
                <button type="button" onClick={openVerification}>Open the sign-in window again</button>
                <button type="button" onClick={() => { popupRef.current?.close(); setWaitingForGoogle(false); }}>Cancel</button>
              </div>
            </div>
          ) : verifyError ? (
            <p className="apply-form-error" role="alert">{verifyMessages[verifyError]}</p>
          ) : null}
          {!verified && !hasFiled && <p className="pp-signin-note">Already have an account? <a className="pp-link" href="/filing/login">Sign in to the filing portal</a></p>}
        </div>

        <div className="apply-step" hidden={step !== 1}>
          {profile ? (
            <section className="pp-profile" aria-label="Your profile">
              <p className="apply-note pp-profile-note"><UserRound size={16} aria-hidden="true" /><span>You already have a filing portal account, so this is your profile as saved. To change it, write to <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a>.</span></p>
              <ReviewSection title="Your profile" rows={aboutRows} />
            </section>
          ) : (
            <>
              <fieldset className="apply-group">
                <legend>Name</legend>
                <div className="apply-grid">
                  <Field label="Last name" error={errors.lastName} span={4}>
                    <input name="lastName" autoComplete="family-name" autoCapitalize="characters" maxLength={80} placeholder="DELA CRUZ" required onInput={uppercase} key={`last-${verified?.email}`} defaultValue={verified ? tidyPersonName(verified.lastName) : undefined} />
                  </Field>
                  <Field label="First name" error={errors.firstName} span={4}>
                    <input name="firstName" autoComplete="given-name" autoCapitalize="characters" maxLength={80} placeholder="JUAN" required onInput={uppercase} key={`first-${verified?.email}`} defaultValue={verified ? tidyPersonName(verified.firstName) : undefined} />
                  </Field>
                  <Field label="Middle name" error={errors.middleName} span={4}>
                    <input name="middleName" autoComplete="additional-name" autoCapitalize="characters" maxLength={80} placeholder="SANTOS" required onInput={uppercase} />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="apply-group">
                <legend>Contact and student details</legend>
                <div className="apply-grid">
                  <Field label="Student number" error={errors.studentNumber} span={3}>
                    <input name="studentNumber" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="2023123456" onInput={(event) => formatNumericInput(event.currentTarget, (value) => digitsOnly(value, 10))} />
                  </Field>
                  <Field label="Mobile number" error={errors.contactNumber} span={3}>
                    <input name="contactNumber" type="tel" inputMode="numeric" autoComplete="tel" pattern="09[0-9]{9}" placeholder="09171234567" maxLength={11} required onInput={(event) => formatNumericInput(event.currentTarget, formatMobileNumber)} />
                  </Field>
                  <Field label="UST email" error={errors.email} hint={verified ? "Verified with your UST Google account" : undefined} span={6}>
                    <input name="email" type="email" autoComplete="email" placeholder="juan.delacruz.cics@ust.edu.ph" readOnly key={`email-${verified?.email}`} defaultValue={verified?.email} />
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
                    <span className="apply-field-label" id="signup-college-label">College or faculty<Required /></span>
                    <Combobox key={`college-${restores}`} name="college" options={colleges} value={college} onChange={(next) => { if (next === college) return; setCollege(next); setProgram(""); setYearLevel(""); clearError("college"); }} placeholder="Type or pick your college" required invalid={Boolean(errors.college)} labelledBy="signup-college-label" />
                    {errors.college && <span className="apply-field-error">{errors.college}</span>}
                  </div>
                  <div className={`apply-field span-5${errors.program ? " has-error" : ""}`}>
                    <span className="apply-field-label" id="signup-program-label">Program{!programLocked(college) && <Required />}</span>
                    {programLocked(college) ? <input value="None" readOnly aria-label="Program" /> : (
                      <Combobox key={`${college}-${restores}`} name="program" options={programs} value={program} onChange={(next) => { setProgram(next); clearError("program"); }} placeholder={college ? "Type or pick your program" : "Pick a college first"} emptyText="No match. Try another program." disabled={!college} required invalid={Boolean(errors.program)} labelledBy="signup-program-label" />
                    )}
                    {errors.program && <span className="apply-field-error">{errors.program}</span>}
                  </div>
                  <div className={`apply-field span-2${errors.yearLevel ? " has-error" : ""}`}>
                    <span className="apply-field-label" id="signup-year-label">Year level<Required /></span>
                    <Combobox key={`year-${college}-${restores}`} name="yearLevel" options={yearLevelLabels} value={yearLevel} submitValue={yearLevelValue(yearLevel)} onChange={(next) => { setYearLevel(next); clearError("yearLevel"); }} placeholder="Select" pickOnly required invalid={Boolean(errors.yearLevel)} labelledBy="signup-year-label" />
                    {errors.yearLevel && <span className="apply-field-error">{errors.yearLevel}</span>}
                  </div>
                </div>
              </fieldset>
            </>
          )}
        </div>

        <div className="apply-step" hidden={step !== 2}>
          {purpose === "party" ? (
            <>
              <div className={`apply-field${errors.mode ? " has-error" : ""}`} role="radiogroup" aria-labelledby="signup-mode-label">
                <span className="apply-field-label" id="signup-mode-label">Your party<Required /></span>
                <div className="apply-choices is-2">
                  <label className={`apply-choice${parties.length ? "" : " is-full"}`}>
                    <input type="radio" name="mode" value="join" checked={mode === "join"} disabled={!parties.length} required onChange={() => { setMode("join"); clearError("mode"); }} />
                    <span className="apply-choice-text"><strong><Users size={15} aria-hidden="true" /> Join a party that’s registering</strong><small>{parties.length ? "Pick it from the list. Its contact person approves new members." : "No party is registering yet. Make a new one."}</small></span>
                  </label>
                  <label className={`apply-choice${units.length ? "" : " is-full"}`}>
                    <input type="radio" name="mode" value="create" checked={mode === "create"} disabled={!units.length} required onChange={() => { setMode("create"); clearError("mode"); }} />
                    <span className="apply-choice-text"><strong><UserPlus size={15} aria-hidden="true" /> Make a new party</strong><small>{units.length ? "You’ll be its contact person, and approve the members who join." : "No unit is taking new parties right now."}</small></span>
                  </label>
                </div>
                {errors.mode && <span className="apply-field-error">{errors.mode}</span>}
              </div>

              {mode === "join" && (
                <fieldset className="apply-group">
                  <legend>Party to join</legend>
                  <div className="apply-grid">
                    <div className={`apply-field span-12${errors.partyId ? " has-error" : ""}`}>
                      <span className="apply-field-label" id="signup-join-label">Political party<Required /></span>
                      <Combobox key={`join-${restores}`} name="joinParty" options={parties.map((party) => party.name)} value={joinName} onChange={(next) => { setJoinName(next); clearError("partyId"); }} placeholder="Type or pick your party" emptyText="No party by that name is registering. Check the spelling, or make a new party." required invalid={Boolean(errors.partyId)} labelledBy="signup-join-label" />
                      <input type="hidden" name="partyId" value={joining?.id ?? ""} />
                      {errors.partyId && <span className="apply-field-error">{errors.partyId}</span>}
                    </div>
                  </div>
                  {joining && (
                    <div className="pp-join">
                      <dl className="pp-facts">
                        <div><dt>Registering with</dt><dd>{joining.unit}</dd></div>
                        <div><dt>Date of establishment</dt><dd>{formatDate(joining.establishedAt)}</dd></div>
                        <div><dt>Principal headquarters</dt><dd>{joining.headquarters || "Not given"}</dd></div>
                        <div><dt>Contact person</dt><dd>{joining.contactName || "Not given"}</dd></div>
                      </dl>
                      <p className="pp-join-note"><Info size={15} aria-hidden="true" /><span>{joining.contactName ? `${joining.contactName}, the party’s contact person,` : "The party’s contact person"} approves your request. You’ll see the party’s documents once they do.</span></p>
                    </div>
                  )}
                </fieldset>
              )}

              {mode === "create" && (
                <>
                  {unitChoices("Register with")}
                  <fieldset className="apply-group">
                    <legend>New party</legend>
                    <div className="apply-grid">
                      <Field label="Political party name" error={errors.partyName} span={8}>
                        <input name="partyName" value={partyName} autoComplete="off" autoCapitalize="characters" maxLength={120} placeholder="Full name of the party" required onChange={(event) => { setPartyName(event.target.value.toLocaleUpperCase("en-PH")); clearError("partyName"); }} />
                      </Field>
                      <Field label="Date of establishment" error={errors.establishedAt} span={4} labelId="signup-established-label">
                        <DatePicker name="establishedAt" value={establishedAt} max={today()} onChange={(value) => { setEstablishedAt(value); clearError("establishedAt"); }} required invalid={Boolean(errors.establishedAt)} label="Date of establishment" />
                      </Field>
                      <Field label="Principal headquarters" error={errors.headquarters} hint={unit === "central" ? "Where the party holds office. Central Comelec parties need one." : "Where the party holds office, if it has one."} span={12} optional={unit !== "central"}>
                        <input name="headquarters" autoComplete="off" autoCapitalize="words" maxLength={250} placeholder="Building and room" required={unit === "central"} onInput={titleCase} />
                      </Field>
                    </div>
                    {clash && (
                      <p className="apply-note pp-clash" role="status">
                        <strong>{clash.name}</strong> is already registering with the {clash.unit}.{" "}
                        <button type="button" className="pp-link" onClick={() => { setMode("join"); setJoinName(clash.name); clearError("partyName"); }}>Ask to join it instead</button>
                      </p>
                    )}
                  </fieldset>

                  <fieldset className="apply-group">
                    <legend>Contact person</legend>
                    <label className="apply-consent pp-contact">
                      <input type="checkbox" checked disabled readOnly aria-describedby="signup-contact-note" />
                      <span>
                        <strong>I’m the party’s contact person</strong>
                        <small id="signup-contact-note">Whoever makes the party is its contact person: the Commission writes to you about the registration, and you approve the members who ask to join and endorse the party’s candidates.</small>
                      </span>
                    </label>
                    <dl className="pp-facts">
                      <div><dt>Name</dt><dd>{person.name || "From About you"}</dd></div>
                      <div><dt>Mobile number</dt><dd>{person.mobile || "From About you"}</dd></div>
                      <div><dt>Email</dt><dd>{verified?.email ?? "From your UST account"}</dd></div>
                    </dl>
                  </fieldset>
                </>
              )}
            </>
          ) : (
            <>
              {unitChoices("File with")}

              <div className={`apply-field${errors.position ? " has-error" : ""}`} role="radiogroup" aria-labelledby="signup-position-label">
                <span className="apply-field-label" id="signup-position-label">Position<Required /></span>
                {unit ? (
                  <div className="apply-office">
                    <span className="apply-office-name">{councilOf(unitKey(unit))}</span>
                    <div className="apply-choices is-positions">
                      {unitPositions.map((name) => (
                        <label className="apply-choice" key={name}>
                          <input type="radio" name="position" value={name} checked={position === name} required onChange={() => { setPosition(name); clearError("position"); }} />
                          <span className="apply-choice-text"><strong>{name}</strong></span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : <p className="apply-note" role="status">Choose the unit you’re filing with to see its positions.</p>}
                {errors.position && <span className="apply-field-error">{errors.position}</span>}
              </div>

              <div className={`apply-field${errors.runningFor ? " has-error" : ""}`} role="radiogroup" aria-labelledby="signup-running-label">
                <span className="apply-field-label" id="signup-running-label">Running<Required /></span>
                <div className="apply-choices is-2">
                  <label className={`apply-choice${unit && !unitParties.length ? " is-full" : ""}`}>
                    <input type="radio" name="runningFor" value="party" checked={runningFor === "party"} disabled={Boolean(unit) && !unitParties.length} required onChange={() => { setRunningFor("party"); clearError("runningFor"); }} />
                    <span className="apply-choice-text"><strong><Users size={15} aria-hidden="true" /> Under a political party</strong><small>{unit && !unitParties.length ? "No party is accredited with this unit." : "An accredited party you’re a member of. Its contact person endorses you."}</small></span>
                  </label>
                  <label className="apply-choice">
                    <input type="radio" name="runningFor" value="independent" checked={runningFor === "independent"} required onChange={() => { setRunningFor("independent"); setRunningParty(""); clearError("runningFor"); }} />
                    <span className="apply-choice-text"><strong><UserRound size={15} aria-hidden="true" /> As an independent</strong><small>Your filing goes straight to the unit for review.</small></span>
                  </label>
                </div>
                {errors.runningFor && <span className="apply-field-error">{errors.runningFor}</span>}
              </div>

              {runningFor === "party" && (
                <fieldset className="apply-group">
                  <legend>Party</legend>
                  <div className="apply-grid">
                    <div className={`apply-field span-12${errors.candidacyParty ? " has-error" : ""}`}>
                      <span className="apply-field-label" id="signup-party-label">Political party<Required /></span>
                      <Combobox key={`party-${unit}-${restores}`} name="runningParty" options={unitParties.map((party) => party.name)} value={runningParty} onChange={(next) => { setRunningParty(next); clearError("candidacyParty"); }} placeholder="Type or pick your party" emptyText="No accredited party by that name. Check the spelling." required invalid={Boolean(errors.candidacyParty)} labelledBy="signup-party-label" />
                      <input type="hidden" name="candidacyParty" value={runningUnder?.id ?? ""} />
                      {errors.candidacyParty && <span className="apply-field-error">{errors.candidacyParty}</span>}
                    </div>
                  </div>
                  {runningUnder && <p className="pp-join-note"><Info size={15} aria-hidden="true" /><span>{runningUnder.contactName ? `${runningUnder.contactName}, the party’s contact person,` : "The party’s contact person"} endorses you before your filing goes to the {runningUnder.unit}.</span></p>}
                </fieldset>
              )}

              <fieldset className="apply-group">
                <legend>Certificate of candidacy</legend>
                <div className="apply-grid">
                  <BirthDateField value={birth} restores={restores} error={errors.dateOfBirth} onChange={(next) => { setBirth(next); clearError("dateOfBirth"); }} />
                  <Field label="Address for election matters" error={errors.residence} hint="Where the Commission can reach you during the elections." span={6}>
                    <input name="residence" autoComplete="street-address" autoCapitalize="words" maxLength={250} placeholder="House number, street, city" required onInput={titleCase} />
                  </Field>
                </div>
                <dl className="pp-facts pp-facts-below">
                  <div><dt>Contact number</dt><dd>{person.mobile || "From About you"}</dd></div>
                  <div><dt>Official email</dt><dd>{verified?.email ?? "From your UST account"}</dd></div>
                </dl>
              </fieldset>
            </>
          )}
        </div>

        <div className="apply-step" hidden={step !== lastStep}>
          {values && (
            <div className="apply-review">
              <div className="apply-review-stack">
                <ReviewSection title="About you" onEdit={profile ? undefined : () => goTo(1)} rows={aboutRows} />
              </div>
              <div className="apply-review-stack">
                {purpose === "party" ? (
                  mode === "join" && joining ? (
                    <ReviewSection title="Your party" onEdit={() => goTo(2)} rows={[["Joining", joining.name], ["Registering with", joining.unit], ["Contact person", joining.contactName], ["What happens next", "The contact person approves your request. Until then, your portal shows that you’re waiting."]]} />
                  ) : (
                    <ReviewSection title="Your party" onEdit={() => goTo(2)} rows={[["New party", values.partyName.toLocaleUpperCase("en-PH")], ["Registering with", pickedUnit?.label ?? ""], ["Date of establishment", formatDate(values.establishedAt)], ["Principal headquarters", values.headquarters], ["Contact person", "You"]]} />
                  )
                ) : (
                  <ReviewSection title="Your candidacy" onEdit={() => goTo(2)} rows={[
                    ["Running for", values.position ? `${values.position}, ${councilOf(unitKey(values.unit))}` : ""],
                    ["Filed with", values.unit ? unitName(unitKey(values.unit)) : ""],
                    ["Party", values.runningFor === "party" ? `${runningUnder?.name ?? ""} (needs its endorsement)` : "Independent"],
                    ["Date of birth", formatDate(values.dateOfBirth)],
                    ["Address", values.residence],
                  ]} />
                )}
              </div>
            </div>
          )}
          {purpose === "candidacy" && (
            <section className="apply-privacy pp-oath" aria-labelledby="signup-oath-title">
              <h3 id="signup-oath-title">Oath</h3>
              <p>By filing, I declare under oath:</p>
              <ol className="pp-oath-list">{oathDeclarations.map((line) => <li key={line}>{line}</li>)}</ol>
              <label className={`apply-consent${errors.oath ? " has-error" : ""}`}>
                <input name="oath" type="checkbox" required onChange={() => clearError("oath")} />
                <span>I swear to the above, and I’ll file my signed, sworn certificate of candidacy with the Comelec unit.<Required /></span>
              </label>
              {errors.oath && <span className="apply-field-error">{errors.oath}</span>}
            </section>
          )}
          {state?.error && !state.fieldErrors && <p className="apply-form-error" role="alert">{state.error}</p>}
        </div>

        <footer className="apply-nav">
          {step > 0 ? (
            <button className="apply-back" type="button" onClick={() => goTo(step - 1)} disabled={pending || transitioning}><ArrowLeft size={15} /> Back</button>
          ) : <span />}
          {hasFiled ? (
            <Link className="button-primary" href={purpose === "party" ? "/filing" : "/filing/candidacy"}>Open the filing portal <ArrowRight size={15} /></Link>
          ) : (
            <button className="button-primary" type="submit" disabled={pending || transitioning || redirecting || waitingForGoogle || !hydrated}>
              {step === 0 && !verified ? (waitingForGoogle ? "Waiting for Google…" : <>Continue with UST Google <ArrowRight size={15} /></>)
                : step < lastStep ? <>Continue <ArrowRight size={15} /></>
                : pending ? (purpose === "party" ? "Sending…" : "Filing…")
                : <>{purpose === "candidacy" ? "File my candidacy" : mode === "join" ? "Ask to join" : "Make the party"} <ArrowRight size={15} /></>}
            </button>
          )}
        </footer>
      </div>
    </form>
  );
}
