"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, useTransition, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Hash, Info, LoaderCircle, Maximize2, Minimize2, RotateCcw, Search, ShieldCheck, Ticket, UserRound, UserRoundPlus, X } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { confirmAttendance, lookupAttendance, type AttendancePerson } from "@/lib/events/evaluation-actions";
import type { RegistrationDetailGroup } from "@/lib/events/registration-details";
import { Field } from "./portal-form";
import "./event-workflows.css";

const lookupModes = [
  { value: "reference", label: "Reference code", icon: Ticket },
  { value: "student", label: "Student number", icon: Hash },
  { value: "name", label: "Full name", icon: UserRound },
] as const;
type LookupMode = typeof lookupModes[number]["value"];
type AttendanceStep = "lookup" | "review" | "confirmed";
const attendanceSteps: AttendanceStep[] = ["lookup", "review", "confirmed"];
const emptyInputs = { reference: "", student: "", lastName: "", firstName: "", middleName: "" };
function sanitizeLookupInput(value: string, mode: LookupMode) {
  if (mode === "student") return value.replace(/[^0-9]/g, "");
  if (mode === "reference") return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return value.normalize("NFC").replace(/[^\p{L} ]/gu, "").toUpperCase();
}
const when = (date: string) => new Date(date).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const clockDate = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", year: "numeric", month: "short", day: "numeric" });
const clockTime = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
const readClock = () => Math.floor(Date.now() / 1000) * 1000;
const serverClock = () => null;
function subscribeClock(update: () => void) {
  const interval = window.setInterval(update, 1000);
  return () => window.clearInterval(interval);
}

function CheckinClock() {
  const now = useSyncExternalStore(subscribeClock, readClock, serverClock);
  return <p className="portal-eyebrow event-booth-clock" role="timer" aria-live="off"><time dateTime={now === null ? undefined : new Date(now).toISOString()}>{now === null ? "\u00a0" : <><span>{clockDate.format(now)}</span><span aria-hidden="true">·</span><span>{clockTime.format(now)}</span></>}</time></p>;
}

function Details({ title, group }: { title: string; group: RegistrationDetailGroup }) {
  return <section className="event-attendance-detail-group"><h4>{title}</h4><p>{group.label}</p>{group.facts.length > 0 && <dl>{group.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}</section>;
}

function AttendanceDetails({ person }: { person: AttendancePerson }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return <>
    <button className="portal-button is-ghost" type="button" aria-haspopup="dialog" aria-controls={id} onClick={() => dialog.current?.showModal()}><Info size={15} aria-hidden="true" />Show details</button>
    <dialog ref={dialog} id={id} className="event-attendance-details-modal" aria-labelledby={`${id}-title`} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="event-attendance-details-shell">
        <header><div><p className="portal-eyebrow">Registration details</p><h3 id={`${id}-title`}>{person.name}</h3></div><button className="portal-button is-ghost" type="button" aria-label="Close details" autoFocus onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button></header>
        <div className="event-attendance-details-body">
          <dl className="event-attendance-identity"><div><dt>Reference code</dt><dd className="event-person-reference">{person.referenceCode}</dd></div>{person.studentNumber && <div><dt>Student number</dt><dd>{person.studentNumber}</dd></div>}</dl>
          <Details title="Affiliation" group={person.affiliation} />
          <Details title="Participation" group={person.participation} />
          {person.confirmedAt && <p className="event-previous-checkin"><Check size={14} aria-hidden="true" />Attendance was recorded on {when(person.confirmedAt)}.</p>}
        </div>
        <footer><button className="portal-button" type="button" onClick={() => dialog.current?.close()}>Close</button></footer>
      </div>
    </dialog>
  </>;
}

export function EventAttendance({ eventId }: { eventId: string }) {
  const booth = useRef<HTMLElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const focusLookup = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<LookupMode>("reference");
  const [step, setStep] = useState<AttendanceStep>("lookup");
  const [inputs, setInputs] = useState(emptyInputs);
  const [people, setPeople] = useState<AttendancePerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState(0);
  const [confirmedPerson, setConfirmedPerson] = useState<AttendancePerson | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const lookupStatusId = useId();
  const [working, setWorking] = useState<"lookup" | string | null>(null);
  const [pending, startTransition] = useTransition();
  const reached = step === "confirmed" ? 3 : attendanceSteps.indexOf(step);

  function updateLookupInput(event: ChangeEvent<HTMLInputElement>, name: keyof typeof emptyInputs, inputMode: LookupMode) {
    const input = event.currentTarget;
    const cursor = input.selectionStart;
    const value = sanitizeLookupInput(input.value, inputMode);
    const nextCursor = cursor === null ? null : sanitizeLookupInput(input.value.slice(0, cursor), inputMode).length;
    input.value = value;
    setInputs(current => ({ ...current, [name]: value }));
    if (nextCursor !== null) input.setSelectionRange(nextCursor, nextCursor);
  }

  const returnToLookup = useCallback((reset = false) => {
    if (reset) {
      setInputs({ ...emptyInputs });
      setMode("reference");
    }
    setPeople([]);
    setSelectedPerson(0);
    setConfirmedPerson(null);
    setFeedback(null);
    setNotFound(false);
    focusLookup.current = true;
    setStep("lookup");
  }, []);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === booth.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (step !== "lookup") stepHeading.current?.focus({ preventScroll: true });
    else if (focusLookup.current) {
      form.current?.querySelector<HTMLInputElement>("input:not([type=hidden]):not(:disabled)")?.focus({ preventScroll: true });
      focusLookup.current = false;
    }
  }, [step, notFound]);
  useEffect(() => {
    if (!notFound) return;
    const timeout = window.setTimeout(() => returnToLookup(true), 10_000);
    return () => window.clearTimeout(timeout);
  }, [notFound, returnToLookup]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await booth.current?.requestFullscreen();
    } catch {
      setFeedback({ text: "Your browser could not enter full screen. Use the browser’s full-screen shortcut.", error: true });
    }
  }
  function lookup(data: FormData) {
    if (notFound) {
      returnToLookup(true);
      return;
    }
    setPeople([]);
    setSelectedPerson(0);
    setConfirmedPerson(null);
    setFeedback(null);
    setWorking("lookup");
    startTransition(async () => {
      try {
        const result = await lookupAttendance(eventId, data);
        if (result.notFound) setNotFound(true);
        else if (result.error) setFeedback({ text: result.error, error: true });
        else if (result.people?.length) {
          setPeople(result.people);
          setStep("review");
        } else setNotFound(true);
      } catch (error) {
        unstable_rethrow(error);
        setFeedback({ text: "Couldn’t look up the participant. Please try again.", error: true });
      } finally { setWorking(null); }
    });
  }
  function confirm(person: AttendancePerson) {
    setFeedback(null);
    setWorking(person.id);
    startTransition(async () => {
      try {
        const result = await confirmAttendance(eventId, person.id);
        if (result.error) setFeedback({ text: result.error, error: true });
        else if (result.confirmedAt) {
          setConfirmedPerson({ ...person, confirmedAt: result.confirmedAt });
          setStep("confirmed");
        } else setFeedback({ text: "Attendance was not confirmed. Please try again.", error: true });
      } catch (error) {
        unstable_rethrow(error);
        setFeedback({ text: "Couldn’t confirm attendance. Please try again.", error: true });
      } finally { setWorking(null); }
    });
  }

  return (
    <section ref={booth} className={`portal-attendance${fullscreen ? " is-fullscreen" : ""}${notFound ? " is-not-found" : ""}`} aria-label="Event attendance booth">
      <header className="portal-attendance-header">
        <div className="event-booth-brand"><Image src="/images/Logo-1.png" alt="" width={48} height={48} /><div><span>University of Santo Tomas</span><strong>Central Comelec</strong></div></div>
        <div className="event-booth-actions">
          <a className="portal-button is-ghost" href={`/events/${eventId}/register`} target="_blank" rel="noreferrer"><UserRoundPlus size={15} aria-hidden="true" /><span>Register</span></a>
          <button className="portal-button is-ghost event-booth-fullscreen" type="button" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}<span>{fullscreen ? "Exit full screen" : "Full screen"}</span></button>
        </div>
      </header>
      <div className="portal-attendance-content">
        <div className="event-booth-welcome"><CheckinClock /><h2>Event <em>Check-in</em></h2></div>
        <section className="portal-card is-flush event-attendance-card">
          <ol className="event-checkin-progress" aria-label="Attendance steps">{["Find registration", "Review details", "Confirm attendance"].map((label, i) => <li key={label} className={i < reached ? "is-done" : i === reached ? "is-current" : undefined} aria-current={i === reached ? "step" : undefined}><b>{i < reached ? <Check size={12} aria-hidden="true" /> : i + 1}</b><span>{label}</span>{i < 2 && <ChevronRight size={13} aria-hidden="true" />}</li>)}</ol>

          {step === "lookup" && <form ref={form} action={lookup} className={notFound ? "is-not-found" : undefined} onChange={() => setFeedback(null)}>
            <header className="event-lookup-head"><h3>Find your registration</h3></header>
            <fieldset disabled={pending} className="event-attendance-fields"><legend className="portal-visually-hidden">Look up a participant</legend>
              <input type="hidden" name="mode" value={mode} />
              <div className="event-lookup-modes" role="group" aria-label="Find registration by">{lookupModes.map(({ value, label, icon: Icon }) => <button type="button" key={value} disabled={notFound} aria-pressed={mode === value} onClick={() => { setMode(value); setFeedback(null); }}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}</div>
              <div className="event-lookup-inputs">
                {lookupModes.map(({ value, label }) => (
                  <fieldset key={value} className={`event-lookup-panel${mode === value ? " is-active" : ""}`} disabled={pending || mode !== value} aria-hidden={mode !== value} inert={mode !== value}>
                    <legend className="portal-visually-hidden">{label}</legend>
                    {value === "name" ? <div className="portal-attendance-names">{([ ["lastName", "Last Name", "DELA CRUZ"], ["firstName", "First Name", "JUAN"], ["middleName", "Middle Name", "SANTOS"] ] as const).map(([name, nameLabel, placeholder]) => <Field key={name} label={nameLabel}><input name={name} readOnly={notFound} aria-invalid={notFound || undefined} aria-describedby={notFound ? lookupStatusId : undefined} placeholder={placeholder} maxLength={80} pattern="[\p{L} ]*" required={name !== "middleName"} autoComplete="off" autoCapitalize="characters" value={inputs[name]} onChange={e => updateLookupInput(e, name, "name")} /></Field>)}</div> : <Field label={label}><input className={value === "reference" ? "event-reference-input" : ""} name="query" readOnly={notFound} aria-invalid={notFound || undefined} aria-describedby={notFound ? lookupStatusId : undefined} maxLength={value === "reference" ? 5 : 10} pattern={value === "reference" ? "[A-Za-z0-9]*" : "[0-9]*"} required autoComplete="off" autoCapitalize="characters" inputMode={value === "student" ? "numeric" : "text"} spellCheck={false} placeholder={value === "student" ? "2026123456" : "7K3MX"} value={inputs[value]} onChange={e => updateLookupInput(e, value, value)} /></Field>}
                  </fieldset>
                ))}
              </div>
              <button className={`portal-button event-attendance-primary event-lookup-submit${notFound ? " is-danger" : ""}`} type={notFound ? "button" : "submit"} aria-describedby={notFound ? lookupStatusId : undefined} onClick={notFound ? () => returnToLookup(true) : undefined}>{notFound ? <RotateCcw size={16} aria-hidden="true" /> : pending && working === "lookup" ? <LoaderCircle size={16} className="event-icon-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}{notFound ? "Registrant Not Found" : pending && working === "lookup" ? "Finding registration…" : "Preview details"}<ArrowRight size={15} aria-hidden="true" /></button>
              {notFound && <span id={lookupStatusId} className="portal-visually-hidden" role="alert">Registrant Not Found. Click to reset the attendance sheet, or wait 10 seconds for it to reset automatically.</span>}
            </fieldset>
          </form>}

          {step === "review" && <div className="event-attendance-review">
            <header className="event-lookup-head event-review-head"><div><h3 ref={stepHeading} tabIndex={-1}>Review your details</h3></div><button className="portal-button is-ghost" type="button" disabled={pending} onClick={() => returnToLookup()}><ArrowLeft size={14} aria-hidden="true" />Back</button></header>
            {people.length > 1 && <div className="event-attendance-match-select"><Field label="Choose your registration"><select value={selectedPerson} disabled={pending} onChange={event => { setSelectedPerson(Number(event.target.value)); setFeedback(null); }}>{people.map((person, index) => <option key={person.id} value={index}>{person.referenceCode} · {person.name}</option>)}</select></Field></div>}
            {people.slice(selectedPerson, selectedPerson + 1).map(person => <article className="event-attendance-person" key={person.id}>
              <header><span className="event-person-icon"><UserRound size={23} aria-hidden="true" /></span><div><h3>{person.name}</h3><p className="event-attendance-reference">Reference code <strong>{person.referenceCode}</strong></p></div></header>
              <span className={`portal-tag${person.confirmedAt ? " is-ok" : " is-gold"}`}>{person.confirmedAt ? "Already checked in" : "Registered"}</span>
              <div className="event-attendance-confirm"><AttendanceDetails person={person} /><button className="portal-button event-attendance-primary" type="button" disabled={pending} onClick={() => confirm(person)}>{pending && working === person.id ? <LoaderCircle size={15} className="event-icon-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{pending && working === person.id ? "Confirming…" : person.confirmedAt ? "View confirmation" : "Confirm Attendance"}</button></div>
            </article>)}
          </div>}

          {step === "confirmed" && confirmedPerson?.confirmedAt && <div className="event-attendance-complete">
            <span className="event-attendance-success-mark"><CheckCircle2 size={32} aria-hidden="true" /></span><h3 ref={stepHeading} tabIndex={-1}>Attendance confirmed.</h3><p>You’re all set, <strong>{confirmedPerson.name}</strong>.</p><dl><div><dt>Reference code</dt><dd className="event-person-reference">{confirmedPerson.referenceCode}</dd></div><div><dt>Checked in</dt><dd>{when(confirmedPerson.confirmedAt)}</dd></div></dl><button className="portal-button event-attendance-primary event-lookup-submit" type="button" onClick={() => returnToLookup(true)}><RotateCcw size={16} aria-hidden="true" />Next participant<ArrowRight size={15} aria-hidden="true" /></button>
          </div>}

          {feedback && <p className={`event-workflow-feedback event-attendance-feedback${feedback.error ? " is-error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.error ? <Info size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}{feedback.text}</p>}
          <footer className="event-booth-help"><ShieldCheck size={15} aria-hidden="true" /><span>{step === "confirmed" ? "Your attendance is recorded for this event only." : step === "review" ? "Confirm attendance after reviewing your details." : "Need help finding your registration? Ask the Central Comelec team."}</span></footer>
        </section>
      </div>
    </section>
  );
}
