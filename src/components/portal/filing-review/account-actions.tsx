"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Ban, LogOut, RotateCcw, Undo2 } from "lucide-react";
import { EditIcon, SaveIcon } from "@/components/action-icons";
import { Combobox } from "@/components/combobox";
import { colleges, programLocked, programsByCollege, yearLevelsFor, type College } from "@/lib/applications/options";
import { withdrawCandidacyForCandidate } from "@/lib/candidacy/review-actions";
import { endFilingAccountSessions, restoreFilingAccount, suspendFilingAccount, updateFilingAccount, type AccountsArea } from "@/lib/filing-portal/commission-actions";
import type { ProfileSummary } from "@/lib/filing-portal/types";
import { uppercaseInput, useHydrated } from "../portal-form";
import { useToast } from "../toast";
import { ConfirmAction, QuickAction } from "./confirm-action";
import "../filing-review.css";

/** Corrects an account's profile in a dialog, over the version the page loaded (`seen`). */
function EditAccount({ area, id, seen, profile }: { area: AccountsArea; id: string; seen: string; profile: ProfileSummary }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(updateFilingAccount.bind(null, area, id, seen), undefined);
  const [college, setCollege] = useState(profile.college);
  const [program, setProgram] = useState(profile.program);
  const levels = yearLevelsFor(college);
  const [yearLevel, setYearLevel] = useState((levels as Record<string, string>)[profile.yearLevel] ?? "");
  const hydrated = useHydrated();
  const errors = state?.fieldErrors ?? {};
  useToast(state?.error, "error", state);
  useToast(state?.saved, "ok", state);
  useEffect(() => { if (state?.saved) dialog.current?.close(); }, [state]);

  const programs: readonly string[] = programsByCollege[college as College] ?? [];
  const yearLabels = Object.values(levels);
  const yearValue = Object.entries(levels).find(([, label]) => label === yearLevel)?.[0] ?? "";
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  };
  const input = (name: string, label: string, value: string, extra: Record<string, unknown> = {}) => (
    <label className={`portal-field${errors[name] ? " has-error" : ""}`}>
      <span className="portal-field-label">{label}</span>
      <input className="portal-input" name={name} defaultValue={value} autoComplete="off" {...extra} />
      {errors[name] && <span className="portal-field-error">{errors[name]}</span>}
    </label>
  );

  return (
    <>
      <button type="button" className="portal-button is-ghost" onClick={() => dialog.current?.showModal()}><EditIcon size={15} aria-hidden="true" />Edit details</button>
      <dialog ref={dialog} className="portal-registrant-confirmation fr-dialog" aria-labelledby={titleId} onCancel={(event) => { if (pending) event.preventDefault(); }} onClick={(event) => { if (event.target === dialog.current && !pending) dialog.current?.close(); }}>
        <form onSubmit={onSubmit} noValidate>
          <h2 id={titleId}>Correct the details</h2>
          <p>Fix what the account holder typed when they signed up. Their party’s roster takes the change too, and they’re emailed. Their UST email can’t change: it’s how they sign in.</p>
          <div className="fr-dialog-grid">
            {input("lastName", "Last name", profile.lastName, { required: true, onInput: uppercaseInput })}
            {input("firstName", "First name", profile.firstName, { required: true, onInput: uppercaseInput })}
            {input("middleName", "Middle name (optional)", profile.middleName, { onInput: uppercaseInput })}
            {input("studentNumber", "Student number", profile.studentNumber, { required: true, inputMode: "numeric", maxLength: 10, pattern: "\\d{10}" })}
            {input("contactNumber", "Mobile number", profile.mobileNumber, { required: true, inputMode: "numeric", maxLength: 11, pattern: "09\\d{9}" })}
            {input("facebookUrl", "Facebook profile", profile.facebookUrl, { required: true })}
            <div className={`portal-field is-wide${errors.college ? " has-error" : ""}`}>
              <span className="portal-field-label" id={`${titleId}-college`}>College or faculty</span>
              <Combobox name="college" options={colleges} value={college} onChange={(next) => { if (next === college) return; setCollege(next); setProgram(""); setYearLevel(""); }} placeholder="Type or pick a college" required invalid={Boolean(errors.college)} labelledBy={`${titleId}-college`} />
              {errors.college && <span className="portal-field-error">{errors.college}</span>}
            </div>
            {!programLocked(college) && (
              <div className={`portal-field is-wide${errors.program ? " has-error" : ""}`}>
                <span className="portal-field-label" id={`${titleId}-program`}>Program</span>
                <Combobox key={college} name="program" options={programs} value={program} onChange={setProgram} placeholder={college ? "Type or pick a program" : "Pick a college first"} emptyText="No match. Try another program." disabled={!college} required invalid={Boolean(errors.program)} labelledBy={`${titleId}-program`} />
                {errors.program && <span className="portal-field-error">{errors.program}</span>}
              </div>
            )}
            <div className={`portal-field${errors.yearLevel ? " has-error" : ""}`}>
              <span className="portal-field-label" id={`${titleId}-year`}>Year level</span>
              <Combobox key={`year-${college}`} name="yearLevel" options={yearLabels} value={yearLevel} submitValue={yearValue} onChange={setYearLevel} placeholder="Select" pickOnly required invalid={Boolean(errors.yearLevel)} labelledBy={`${titleId}-year`} />
              {errors.yearLevel && <span className="portal-field-error">{errors.yearLevel}</span>}
            </div>
          </div>
          <div className="portal-registrant-confirmation-actions">
            <button type="button" className="portal-button is-ghost" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="submit" className="portal-button" disabled={pending || !hydrated}><SaveIcon size={15} aria-hidden="true" />{pending ? "Saving…" : "Save details"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** The account page's actions: correct the details, end its sessions, suspend or restore it. */
export function AccountActions({ area, id, seen, name, profile, suspended }: { area: AccountsArea; id: string; seen: string; name: string; profile: ProfileSummary; suspended: boolean }) {
  return (
    <div className="portal-head-actions">
      <EditAccount area={area} id={id} seen={seen} profile={profile} />
      {!suspended && <QuickAction label="Sign out everywhere" pendingLabel="Signing out…" icon={<LogOut size={15} aria-hidden="true" />} buttonClassName="portal-button is-ghost" action={() => endFilingAccountSessions(area, id)} />}
      {suspended
        ? <QuickAction label="Restore access" pendingLabel="Restoring…" icon={<RotateCcw size={15} aria-hidden="true" />} buttonClassName="portal-button is-ghost" action={() => restoreFilingAccount(area, id)} />
        : (
          <ConfirmAction label="Suspend" icon={<Ban size={15} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost" danger title={`Suspend ${name}?`}
            note={{ label: "Why it’s suspended", required: true, placeholder: "They’re emailed this." }}
            confirmLabel="Suspend account" pendingLabel="Suspending…" action={(note) => suspendFilingAccount(area, id, note)}>
            They’re signed out at once and can’t sign in or file anything until you restore them. Their party membership and candidacy stay as they are. They’re emailed why.
          </ConfirmAction>
        )}
    </div>
  );
}

/** Records a candidate's withdrawal on their sworn declaration. */
export function WithdrawCandidacyButton({ candidacyId, name }: { candidacyId: string; name: string }) {
  return (
    <ConfirmAction label="Record withdrawal" icon={<Undo2 size={15} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost" danger
      title={`Withdraw ${name}’s candidacy?`}
      note={{ label: "What it rests on", required: true, placeholder: "Like: sworn declaration of withdrawal received on 20 October 2026." }}
      confirmLabel="Withdraw candidacy" pendingLabel="Withdrawing…" action={(note) => withdrawCandidacyForCandidate(candidacyId, note)}>
      Record it once the candidate has given the unit their sworn declaration of withdrawal. They’re emailed, and can file again while filing is open. This can’t be undone here.
    </ConfirmAction>
  );
}
