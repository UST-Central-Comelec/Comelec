"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Check, CircleSlash, MessageSquareText, RotateCcw } from "lucide-react";
import { SaveIcon } from "@/components/action-icons";
import { useHydrated } from "@/components/portal/portal-form";
import { SlidingSegments } from "@/components/portal/sliding-filters";
import { useToast } from "@/components/portal/toast";
import type { DocumentStatus } from "@/lib/filing-portal/types";
import "./documents.css";

// The Comelec unit's review in the commission portal: of each document (a party's or a
// candidate's), and its decision on the party or the candidacy. The page passes the bound Server
// Action. What happened pops up on the header; a field's problem shows under it.

type ReviewState = { error?: string; fieldErrors?: Record<string, string>; saved?: string } | undefined;
type ReviewAction = (state: ReviewState, form: FormData) => Promise<ReviewState>;

function useReviewForm(action: ReviewAction) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useToast(state?.error, "error", state);
  useToast(state?.saved, "ok", state);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  };
  return { pending, onSubmit, errors: state?.fieldErrors ?? {} };
}

/** Approve a document, or send it back with what to change. */
export function DocumentReviewForm({ action, status, feedback, filer }: { action: ReviewAction; status: DocumentStatus; feedback: string; /** "the party", "the candidate": who the note goes to. */ filer: string }) {
  const { pending, onSubmit, errors } = useReviewForm(action);
  const [decision, setDecision] = useState<"approved" | "changes">(status === "changes" ? "changes" : "approved");
  const hydrated = useHydrated();
  return (
    <form className="portal-form pp-review-form" onSubmit={onSubmit} noValidate>
      <SlidingSegments active={decision} role="radiogroup" aria-label="Your review">
        <label className={`portal-segment${decision === "approved" ? " is-selected" : ""}`}>
          <input type="radio" name="decision" value="approved" checked={decision === "approved"} onChange={() => setDecision("approved")} />
          <Check size={15} aria-hidden="true" />Approve
        </label>
        <label className={`portal-segment${decision === "changes" ? " is-selected" : ""}`}>
          <input type="radio" name="decision" value="changes" checked={decision === "changes"} onChange={() => setDecision("changes")} />
          <MessageSquareText size={15} aria-hidden="true" />Ask for changes
        </label>
      </SlidingSegments>
      <label className={`portal-field${errors.feedback ? " has-error" : ""}`}>
        <span className="portal-field-label">{decision === "changes" ? "What to change" : `Note to ${filer} (optional)`}</span>
        <textarea name="feedback" rows={3} maxLength={3000} defaultValue={feedback} required={decision === "changes"} placeholder={decision === "changes" ? "Say what’s wrong, and what to upload instead." : `Anything ${filer} should know.`} />
        {errors.feedback && <span className="portal-field-error">{errors.feedback}</span>}
      </label>
      <div className="pp-review-actions">
        <button type="submit" className={`portal-button is-small${decision === "approved" ? " is-ok" : ""}`} disabled={pending || !hydrated}>
          <SaveIcon size={14} aria-hidden="true" />{pending ? "Saving…" : decision === "approved" ? "Approve document" : "Send back with feedback"}
        </button>
      </div>
    </form>
  );
}

type Choice = { value: string; label: string; icon: typeof Check };

/** A decision with a reason required for the one that goes against the filer. */
function DecisionForm({ action, status, remarks, choices, against, againstLabel, filer }: { action: ReviewAction; status: string; remarks: string; choices: Choice[]; against: string; againstLabel: string; filer: string }) {
  const { pending, onSubmit, errors } = useReviewForm(action);
  const [decision, setDecision] = useState(choices.some((choice) => choice.value === status) ? status : choices[0].value);
  const hydrated = useHydrated();
  return (
    <form className="portal-form pp-review-form" onSubmit={onSubmit} noValidate>
      <SlidingSegments active={decision} role="radiogroup" aria-label="Decision">
        {choices.map(({ value, label, icon: Icon }) => (
          <label key={value} className={`portal-segment${decision === value ? " is-selected" : ""}`}>
            <input type="radio" name="decision" value={value} checked={decision === value} onChange={() => setDecision(value)} />
            <Icon size={15} aria-hidden="true" />{label}
          </label>
        ))}
      </SlidingSegments>
      <label className={`portal-field${errors.remarks ? " has-error" : ""}`}>
        <span className="portal-field-label">{decision === against ? againstLabel : `Remarks to ${filer} (optional)`}</span>
        <textarea name="remarks" rows={3} maxLength={3000} defaultValue={remarks} required={decision === against} placeholder={decision === against ? "Say why, and what they can do next." : `Anything ${filer} should know.`} />
        {errors.remarks && <span className="portal-field-error">{errors.remarks}</span>}
      </label>
      <div className="pp-review-actions">
        <button type="submit" className="portal-button" disabled={pending || !hydrated}><SaveIcon size={15} aria-hidden="true" />{pending ? "Saving…" : "Save decision"}</button>
      </div>
    </form>
  );
}

/** The party's decision: accredited, declined (with a reason), or back to pending. */
export function PartyDecisionForm({ action, status, remarks }: { action: ReviewAction; status: string; remarks: string }) {
  return <DecisionForm action={action} status={status} remarks={remarks} filer="the party" against="declined" againstLabel="Why it isn’t accredited"
    choices={[{ value: "pending", label: "Pending review", icon: RotateCcw }, { value: "accredited", label: "Accredited", icon: Check }, { value: "declined", label: "Declined", icon: CircleSlash }]} />;
}

/** The candidacy's decision: qualified, disqualified (with a reason), or back to pending. */
export function CandidacyDecisionForm({ action, status, remarks }: { action: ReviewAction; status: string; remarks: string }) {
  return <DecisionForm action={action} status={status} remarks={remarks} filer="the candidate" against="disqualified" againstLabel="Why they aren’t qualified"
    choices={[{ value: "pending", label: "Pending review", icon: RotateCcw }, { value: "qualified", label: "Qualified", icon: Check }, { value: "disqualified", label: "Disqualified", icon: CircleSlash }]} />;
}
