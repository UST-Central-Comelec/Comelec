"use client";

import { Check, Clock, type LucideIcon } from "lucide-react";
import { CloseIcon as X } from "@/components/action-icons";
import { requestKinds, requestDecisionStatus, type RequestKind, type RequestStatus } from "@/lib/events/options";

export type LogisticalRequest = { kind: RequestKind; label: string; facts: Array<[string, string]>; status?: RequestStatus };

/** The unit's answer, as the officers read it. Declining tells the registrant it's not available. */
const answers: Record<RequestStatus, { label: string; icon: LucideIcon }> = {
  pending: { label: "Waiting for an answer", icon: Clock },
  approved: { label: "Approved", icon: Check },
  unavailable: { label: "Declined", icon: X },
  revoked: { label: "Revoked", icon: X },
};

/**
 * One thing a registrant asked for under Logistics: what it is, what they wrote for it, and the unit's
 * answer. With `onPick` (the unit that manages the event), Approve and Decline pick an answer, which
 * waits for Save; the answer shown lit is the one picked, or else the one saved.
 */
function Need({ request, pick, onPick, disabled }: { request: LogisticalRequest; pick?: boolean; onPick?: (approved: boolean) => void; disabled?: boolean }) {
  const shown = request.status === undefined ? undefined : pick === undefined ? request.status : requestDecisionStatus(request.status, pick);
  const changed = shown !== request.status;
  const answer = shown ? answers[shown] : undefined;
  const AnswerIcon = answer?.icon;
  return (
    <li className={`portal-need is-${shown ?? "requested"}${changed ? " is-changed" : ""}`}>
      <div className="portal-need-main">
        <strong>{request.label}{changed && <em>Not saved</em>}</strong>
        {request.facts.length > 0 && (
          <dl className="portal-need-facts">
            {request.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
      </div>
      {onPick && request.status ? (
        <div className="portal-need-decide" role="group" aria-label={`Answer: ${request.label}`}>
          <button type="button" className="is-approve" aria-pressed={shown === "approved"} disabled={disabled} onClick={() => onPick(true)}>
            <Check size={14} strokeWidth={2.4} aria-hidden="true" />{shown === "approved" ? "Approved" : "Approve"}
          </button>
          <button type="button" className="is-decline" aria-pressed={shown === "unavailable" || shown === "revoked"} disabled={disabled} onClick={() => onPick(false)}>
            <X size={14} strokeWidth={2.4} aria-hidden="true" />{request.status === "approved" || request.status === "revoked" ? "Revoked" : shown === "unavailable" ? "Declined" : "Decline"}
          </button>
        </div>
      ) : (
        <span className="portal-need-answer">{AnswerIcon && <AnswerIcon size={13} strokeWidth={2.4} aria-hidden="true" />}{answer?.label ?? "Requested"}</span>
      )}
    </li>
  );
}

/** All logistics choices, with decisions staged until the footer's Update is confirmed. */
export function LogisticalRequests({ requests, picks = {}, onPick, pending = false }: { requests: LogisticalRequest[]; picks?: Partial<Record<RequestKind, boolean>>; onPick?: (kind: RequestKind, approved: boolean) => void; pending?: boolean }) {
  return (
    <section className="portal-needs">
      <h3 className="portal-needs-head">Logistical Requests</h3>
      <ul>{(Object.keys(requestKinds) as RequestKind[]).map((kind) => {
        const request = requests.find((entry) => entry.kind === kind);
        return request
          ? <Need key={kind} request={request} pick={picks[kind]} onPick={onPick ? (approved) => onPick(kind, approved) : undefined} disabled={pending} />
          : <li key={kind} className="portal-need is-not-requested"><div className="portal-need-main"><strong>{requestKinds[kind].short}</strong></div><span className="portal-need-answer">Not requested</span></li>;
      })}</ul>
    </section>
  );
}

