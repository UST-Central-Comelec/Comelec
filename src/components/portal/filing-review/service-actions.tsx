"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Ban, CalendarCheck2, CheckCircle2, Gavel, MessageSquareWarning, RotateCcw } from "lucide-react";
import { DatePicker } from "../date-picker";
import { TimePicker } from "../time-picker";
import { useToast } from "../toast";
import { ConfirmAction } from "./confirm-action";
import type { AnswerState } from "@/lib/filing-portal/services-review-actions";
import "../filing-review.css";
import { Busy } from "@/components/busy";

// The commission's buttons on the filing portal's Services and a candidate's campaign: each opens
// a dialog that says what will happen and takes the note the filer reads. What happened pops up on
// the header. The actions come bound to their record and the version the page loaded.

type Result = { ok?: string; error?: string };
type Act = (note: string) => Promise<Result>;

const manilaDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

/** Confirm a consultation or a commissioner request with a time, a place and who goes (or change what was confirmed). */
export function ConfirmRequestDialog({ action, kind, mode, initial, changing }: {
  action: (state: AnswerState, form: FormData) => Promise<AnswerState>;
  kind: "consultation" | "commissioner";
  mode: "in-person" | "online";
  initial: { date: string; start: string; end: string; location: string; assigned: string; response: string };
  changing: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const id = useId();
  const [state, formAction, pending] = useActionState(action, undefined);
  useToast(state?.error, "error", state);
  useToast(state?.ok, "ok", state);
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const errors = state?.fieldErrors ?? {};
  useEffect(() => { if (state?.ok) dialog.current?.close(); }, [state]);
  const close = () => { if (!pending) dialog.current?.close(); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  };

  return (
    <>
      <button type="button" className={changing ? "portal-button is-ghost is-small" : "portal-button is-ok is-small"} onClick={() => dialog.current?.showModal()}><CalendarCheck2 size={14} aria-hidden="true" />{changing ? "Change what’s confirmed" : "Confirm"}</button>
      <dialog ref={dialog} className="portal-registrant-confirmation fr-dialog" aria-labelledby={titleId} onCancel={(event) => { if (pending) event.preventDefault(); }} onClick={(event) => { if (event.target === dialog.current) close(); }}>
        <form onSubmit={submit} noValidate>
          <h2 id={titleId}>{changing ? "Change what’s confirmed" : kind === "consultation" ? "Confirm the consultation" : "Confirm the commissioner"}</h2>
          <p>The filer is emailed when, where and {kind === "consultation" ? "who meets them" : "who goes"}, with your note.</p>
          <div className="fr-dialog-grid">
            <div className={`portal-field${errors.date ? " has-error" : ""}`}>
              <span className="portal-field-label" id={`${id}-date`}>Day</span>
              <DatePicker name="date" value={date} onChange={setDate} min={manilaDay()} required invalid={Boolean(errors.date)} label="Day" />
              {errors.date && <span className="portal-field-error">{errors.date}</span>}
            </div>
            <div className={`portal-field${errors.start ? " has-error" : ""}`}>
              <span className="portal-field-label" id={`${id}-start`}>Starts</span>
              <TimePicker name="start" value={start} onChange={setStart} invalid={Boolean(errors.start)} labelledBy={`${id}-start`} />
              {errors.start && <span className="portal-field-error">{errors.start}</span>}
            </div>
            <div className={`portal-field${errors.end ? " has-error" : ""}`}>
              <span className="portal-field-label" id={`${id}-end`}>Ends</span>
              <TimePicker name="end" value={end} onChange={setEnd} invalid={Boolean(errors.end)} labelledBy={`${id}-end`} />
              {errors.end && <span className="portal-field-error">{errors.end}</span>}
            </div>
            <label className={`portal-field is-wide${errors.location ? " has-error" : ""}`}>
              <span className="portal-field-label">{mode === "online" ? "Meeting link" : "Where"}</span>
              <input className="portal-input" name="location" maxLength={300} defaultValue={initial.location} placeholder={mode === "online" ? "https://" : "e.g. Comelec office, Tan Yan Kee Student Center"} autoComplete="off" required />
              {errors.location && <span className="portal-field-error">{errors.location}</span>}
            </label>
            <label className={`portal-field is-wide${errors.assigned ? " has-error" : ""}`}>
              <span className="portal-field-label">{kind === "consultation" ? "Who meets them" : "Commissioner"}</span>
              <input className="portal-input" name="assigned" maxLength={300} defaultValue={initial.assigned} placeholder="Name and position" autoComplete="off" required />
              {errors.assigned && <span className="portal-field-error">{errors.assigned}</span>}
            </label>
            <label className={`portal-field is-wide${errors.response ? " has-error" : ""}`}>
              <span className="portal-field-label">Note for the filer (optional)</span>
              <textarea name="response" rows={3} maxLength={3000} defaultValue={initial.response} placeholder="What to bring, or how to find the room" />
              {errors.response && <span className="portal-field-error">{errors.response}</span>}
            </label>
          </div>
          <div className="portal-registrant-confirmation-actions">
            <button type="button" className="portal-button is-ghost" autoFocus disabled={pending} onClick={close}>Cancel</button>
            <button type="submit" className="portal-button" disabled={pending}>{pending ? <Busy>Saving</Busy> : changing ? "Save and email" : "Confirm and email"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function DeclineRequest({ action, kind }: { action: Act; kind: "consultation" | "commissioner" }) {
  return (
    <ConfirmAction label="Decline" icon={<Ban size={14} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost is-small" title={kind === "consultation" ? "Decline the consultation?" : "Decline the request?"}
      note={{ label: "Why, for the filer", required: true, placeholder: "e.g. No commissioner is free then. Ask for another day." }} confirmLabel="Decline and email" pendingLabel="Declining" danger action={action}>
      The filer is emailed that it can’t go ahead, with your reason. They can ask again.
    </ConfirmAction>
  );
}

export function MarkRequestDone({ action }: { action: Act }) {
  return (
    <ConfirmAction label="Mark done" icon={<CheckCircle2 size={14} aria-hidden="true" />} title="Mark it done?" note={{ label: "Note for the record", required: false }} confirmLabel="Mark done" pendingLabel="Saving" action={action}>
      It moves to the past requests. The filer sees it’s done; no email is sent.
    </ConfirmAction>
  );
}

/** A petition's next steps: docket it, resolve it or dismiss it; or reopen a decided one. */
export function PetitionActions({ status, docket, resolve, dismiss }: { status: "filed" | "docketed" | "resolved" | "dismissed"; docket: Act; resolve: Act; dismiss: Act }) {
  if (status === "resolved" || status === "dismissed") {
    return (
      <ConfirmAction label="Reopen" icon={<RotateCcw size={14} aria-hidden="true" />} title="Reopen the petition?" note={{ label: "Why, for the filer", required: false }} confirmLabel="Reopen and email" pendingLabel="Reopening" action={docket}>
        It goes back to being heard, and the filer is emailed. Resolve or dismiss it again when it’s decided.
      </ConfirmAction>
    );
  }
  return (
    <span className="fr-actions">
      {status === "filed" && (
        <ConfirmAction label="Docket" icon={<Gavel size={14} aria-hidden="true" />} buttonClassName="portal-button is-ok is-small" title="Docket the petition?" note={{ label: "What happens next, for the filer", required: false, placeholder: "e.g. The respondent is asked to answer by October 28." }} confirmLabel="Docket and email" pendingLabel="Docketing" action={docket}>
          It’s taken up for hearing. Serve a copy on whoever it’s against, who answers in writing within five school days; decide within five school days of that answer (Elections Code, Article XII, Sections 5 and 6).
        </ConfirmAction>
      )}
      <ConfirmAction label="Resolve" icon={<CheckCircle2 size={14} aria-hidden="true" />} title="Resolve the petition?" note={{ label: "The resolution", required: true, placeholder: "What the unit decided, and why" }} confirmLabel="Resolve and email" pendingLabel="Resolving" action={resolve}>
        The filer is emailed the resolution.
      </ConfirmAction>
      <ConfirmAction label="Dismiss" icon={<Ban size={14} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost is-small" title="Dismiss the petition?" note={{ label: "Why", required: true, placeholder: "e.g. Filed after five school days, or without basis on its face" }} confirmLabel="Dismiss and email" pendingLabel="Dismissing" danger action={dismiss}>
        The filer is emailed that it’s dismissed, with your reasons.
      </ConfirmAction>
    </span>
  );
}

/** A campaign material's review: approve it, ask for changes, or not approve it. */
export function MaterialReview({ status, approve, changes, decline }: { status: string; approve: Act; changes: Act; decline: Act }) {
  return (
    <span className="fr-actions">
      {status !== "approved" && (
        <ConfirmAction label="Approve" icon={<CheckCircle2 size={14} aria-hidden="true" />} buttonClassName="portal-button is-ok is-small" title="Approve the material?" note={{ label: "Note for the candidate", required: false, placeholder: "e.g. Post only on the ground-floor bulletin board." }} confirmLabel="Approve and email" pendingLabel="Approving" action={approve}>
          The candidate can use it as approved, during the campaign period.
        </ConfirmAction>
      )}
      {status !== "changes" && (
        <ConfirmAction label="Ask for changes" icon={<MessageSquareWarning size={14} aria-hidden="true" />} title="Ask for changes?" note={{ label: "What to change", required: true }} confirmLabel="Send back and email" pendingLabel="Sending" action={changes}>
          The candidate revises it and sends it again. It can’t be used until it’s approved.
        </ConfirmAction>
      )}
      {status !== "declined" && (
        <ConfirmAction label="Don’t approve" icon={<Ban size={14} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost is-small" title="Not approve the material?" note={{ label: "Why", required: true, placeholder: "e.g. Bigger than the Code allows for an independent candidate" }} confirmLabel="Don’t approve, and email" pendingLabel="Saving" danger action={decline}>
          It can’t be used in the campaign. The candidate is emailed your reason.
        </ConfirmAction>
      )}
    </span>
  );
}

/** An activity on a campaign schedule: approve it, or not. */
export function ActivityReview({ status, approve, decline }: { status: string; approve: Act; decline: Act }) {
  return (
    <span className="fr-actions">
      {status !== "approved" && (
        <ConfirmAction label="Approve" icon={<CheckCircle2 size={14} aria-hidden="true" />} buttonClassName="portal-button is-ok is-small" title="Approve the activity?" note={{ label: "Note for the candidate", required: false }} confirmLabel="Approve and email" pendingLabel="Approving" action={approve}>
          It goes on their approved schedule.
        </ConfirmAction>
      )}
      {status !== "declined" && (
        <ConfirmAction label="Don’t approve" icon={<Ban size={14} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost is-small" title="Not approve the activity?" note={{ label: "Why", required: true, placeholder: "e.g. It clashes with the mandatory debate" }} confirmLabel="Don’t approve, and email" pendingLabel="Saving" danger action={decline}>
          It can’t go ahead as planned. The candidate is emailed your reason.
        </ConfirmAction>
      )}
    </span>
  );
}
