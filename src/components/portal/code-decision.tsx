"use client";

import { useState, useTransition } from "react";
import { Check, CornerUpLeft } from "lucide-react";
import type { ApproverRole } from "@/lib/codes/options";
import type { FormState } from "@/lib/portal/form";
import { useHydrated, usePortalForm } from "./portal-form";

type Props = {
  /** The office the signed-in account signs as. */
  role: ApproverRole;
  /** Their office has already approved: only sending it back is left. */
  signed: boolean;
  /** Theirs is the last approval missing, so approving publishes it. */
  last: boolean;
  approve: () => Promise<void>;
  sendBack: (state: FormState, formData: FormData) => Promise<FormState>;
};

/**
 * What one of the three who sign can do with a revision that's waiting: approve it, or send it back
 * to its editors with what should change. Approving asks once more first, since the last approval
 * publishes it.
 */
export function CodeDecision({ role, signed, last, approve, sendBack }: Props) {
  const [mode, setMode] = useState<"idle" | "approving" | "returning">("idle");
  const [approving, startApprove] = useTransition();
  const { state, pending: returning, onSubmit } = usePortalForm(sendBack);
  const hydrated = useHydrated();

  if (mode === "approving") {
    return (
      <div className="code-decision is-asking">
        <p>Approve this revision as {role}?{last && <> Yours is the last approval missing, so <strong>it’s published on the website straight away</strong>.</>}</p>
        <div className="portal-form-actions">
          <button className="portal-button is-ghost" type="button" disabled={approving} onClick={() => setMode("idle")}>Not yet</button>
          <button className="portal-button is-ok" type="button" disabled={approving} onClick={() => startApprove(() => approve())}><Check size={15} aria-hidden="true" /> {approving ? "Approving…" : last ? "Yes, approve and publish" : "Yes, approve"}</button>
        </div>
      </div>
    );
  }

  if (mode === "returning") {
    return (
      <form className="code-decision is-asking" onSubmit={onSubmit} noValidate>
        <label className={`portal-field${state?.error ? " has-error" : ""}`}>
          <span className="portal-field-label">What should change?</span>
          <textarea name="note" rows={4} maxLength={2000} required autoFocus placeholder="e.g. Section 5’s new wording leaves out independent candidates. Please restore the second sentence." />
          {state?.error && <span className="portal-field-error" role="alert">{state.error}</span>}
        </label>
        <p className="portal-muted">Its editors are emailed what you write. It becomes a draft again, and every approval so far is cleared.</p>
        <div className="portal-form-actions">
          <button className="portal-button is-ghost" type="button" disabled={returning} onClick={() => setMode("idle")}>Cancel</button>
          <button className="portal-button" type="submit" disabled={returning || !hydrated}><CornerUpLeft size={15} aria-hidden="true" /> {returning ? "Sending back…" : "Send back"}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="code-decision">
      {!signed && <button className="portal-button is-ok" type="button" disabled={!hydrated} onClick={() => setMode("approving")}><Check size={15} aria-hidden="true" /> Approve</button>}
      <button className="portal-button is-ghost" type="button" disabled={!hydrated} onClick={() => setMode("returning")}><CornerUpLeft size={15} aria-hidden="true" /> Send back for changes</button>
    </div>
  );
}
