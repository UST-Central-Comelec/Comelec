"use client";

import { useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ChevronRight, ShieldCheck, X } from "lucide-react";
import { Busy } from "@/components/busy";
import { positionName } from "@/lib/data/accounts";
import type { AccessRequest } from "@/lib/access-requests/admin";
import { unitAbbreviations } from "@/lib/applications/options";
import type { SubmissionEditRequest, SubmissionEditReview } from "@/lib/applications/edit-requests";
import { affiliations, type Affiliation, type CommissionerPosition } from "@/lib/data/types";
import { approveAccessRequest, declineAccessRequest } from "@/lib/portal/access-request-actions";
import { grantableCommissionerPositions, type Manager } from "@/lib/portal/account-scope";
import { AccountKindLabel, AccountStatusLabel } from "./account-badges";
import { DeleteButton } from "./delete-button";
import { Dropdown, optionsOf } from "./dropdown";
import { useHydrated } from "./portal-form";
import { CopyableReviewFact, ReviewModalDetailsGroup, ReviewModalFooter, ReviewModalHeader, ReviewModalToolbar } from "./review-modal-ui";
import { RoleSelect, useRoleChoice } from "./role-field";
import { toast } from "./toast";

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const shortUnit = (college: string) => unitAbbreviations[college] ?? college;

/** Opens the row's review on a click anywhere in it, except on its own buttons and links. */
function useReview() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = () => dialog.current?.showModal();
  const close = () => dialog.current?.close();
  const rowProps = {
    className: "portal-request-row is-reviewable",
    onClick: (event: React.MouseEvent) => { if (!(event.target as Element).closest("button, a, dialog, [popover]")) open(); },
  };
  return { dialog, open, close, rowProps };
}

type ReviewView = "profile" | "declarations" | "approval" | "logs";

/** The complete stored history, including earlier edit requests and the access decision. */
function RequestLogs({ request, edits, error }: { request: AccessRequest; edits: SubmissionEditRequest[]; error?: string }) {
  const items = [
    { id: "submitted", at: request.submittedAt, action: "Access requested", detail: request.email },
    ...request.declarations.map(declaration => ({ id: `declaration-${declaration.key}`, at: declaration.acceptedAt, action: "E-declaration accepted", detail: declaration.title })),
    ...edits.flatMap(edit => [
      { id: edit.id, at: edit.created_at, action: "Edit requested", detail: edit.requested_changes },
      ...(edit.addressed_at ? [{ id: `${edit.id}-addressed`, at: edit.addressed_at, action: "Edit request marked as addressed", detail: edit.addressed_by ?? "" }] : []),
    ]),
    ...(request.decidedAt && request.status !== "pending" ? [{ id: "decision", at: request.decidedAt, action: request.status === "approved" ? "Access request approved" : "Access request declined", detail: request.decidedBy ?? "" }] : []),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return <section className="portal-registrant-group portal-application-logs" aria-label="Request logs">
    <h3>Logs</h3>
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    <div className="portal-table-wrap">
      <table className="portal-table portal-application-log-table">
        <thead><tr><th>Date and time</th><th>Activity</th><th>Details</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}><td><time dateTime={item.at}>{formatDate(item.at)}</time></td><td>{item.action}</td><td>{item.detail}</td></tr>)}</tbody>
      </table>
    </div>
    {request.status === "pending" && <p className="portal-muted">Awaiting an access decision.</p>}
  </section>;
}

/** Pending, with "Edit request" under it while one waits. */
function RequestStatus({ edit, status = "pending" }: { edit: boolean; status?: AccessRequest["status"] }) {
  return <div className="portal-account-status-stack">
    {status === "pending" ? <AccountStatusLabel status="pending" /> : <span className={`portal-tag ${status === "approved" ? "is-ok" : "is-warn"}`}>{status === "approved" ? "Approved" : "Declined"}</span>}
    {edit && <span className="portal-tag is-gold">Edit request</span>}
  </div>;
}

function CloseButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="portal-icon-button is-light portal-registrant-close" aria-label={label} autoFocus disabled={disabled} onClick={onClick}><X size={18} aria-hidden="true" /></button>;
}

/**
 * A portal access request waiting to be decided, as a row of the Approvals table: name, student ID,
 * affiliation, position and status. Clicking it opens the request's details, where it's approved
 * or declined. It came from Request access on the sign-in page, and its email was verified with
 * Google twice by the requester. Approving adds a commissioner's account with the details they gave,
 * as the affiliation, position and role picked in the review (they start as what the requester
 * said). `manager` is whoever is deciding: they can only give out positions up to their own, and a
 * Local manager only adds to its own Local Comelec. With no `manager` (an Adviser or Admin reading
 * the list) the review only shows the request.
 */
export function AccessRequestRow({ request, manager, edit, history = [], historyError }: { request: AccessRequest; manager: Manager | null; edit?: SubmissionEditReview; history?: SubmissionEditRequest[]; historyError?: string }) {
  const hydrated = useHydrated();
  const titleId = useId();
  const { dialog, open, close, rowProps } = useReview();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<ReviewView>("profile");
  const body = useRef<HTMLDivElement>(null);
  const editOpen = Boolean(edit);
  const canDecide = Boolean(manager) && request.status === "pending";
  const localManager = manager?.affiliation === "local";
  const start: Affiliation = localManager ? "local" : request.affiliation;
  const { affiliation, setAffiliation, position, role, setRole, options, choice, choices, setChoice } = useRoleChoice({
    affiliation: start,
    position: request.position && (!manager || grantableCommissionerPositions(manager, start).includes(request.position)) ? request.position : "",
    role: request.role,
  }, request.college);
  const positions: CommissionerPosition[] = manager && affiliation ? grantableCommissionerPositions(manager, affiliation) : [];
  // A request sent before positions were asked for says what they do in their own words.
  const ownWords = request.position === null;
  const asked = request.position ? positionName({ affiliation: request.affiliation, position: request.position, role: request.role, college: request.college }) : "Not said";
  const name = `${request.lastName}, ${request.firstName} ${request.middleName || `${request.middleInitial}.`}`;

  function approve() {
    const data = new FormData();
    data.set("affiliation", affiliation);
    data.set("position", position);
    data.set("role", role);
    startTransition(async () => {
      try { await approveAccessRequest(request.id, data); } catch (error) { unstable_rethrow(error); toast("Couldn’t approve the request. Try again.", "error"); }
    });
  }

  return (
    <tr {...rowProps}>
      <td>
        <button type="button" className="portal-row-title portal-row-open" aria-haspopup="dialog" onClick={open}>{name}</button>
      </td>
      <td>{request.studentNumber}</td>
      <td><span title={request.affiliation === "local" ? request.college : affiliations[request.affiliation]}>{request.affiliation === "local" ? shortUnit(request.college) : "CENTRAL"}</span></td>
      <td>
        <div className="portal-account-standing">
          <AccountKindLabel kind="personal" />
          <small className="portal-muted">{ownWords ? `“${request.role}”` : asked}</small>
        </div>
      </td>
      <td><RequestStatus edit={editOpen} status={request.status} /></td>
      <td className="portal-row-actions">
        <button type="button" className="portal-list-review" aria-haspopup="dialog" aria-label={`Review request from ${request.name}`} onClick={open}><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button>
        <dialog ref={dialog} className="portal-registrant-dialog" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget && !pending) close(); }} onCancel={(event) => { if (pending) event.preventDefault(); }}>
          <CloseButton label="Close request details" disabled={pending} onClick={close} />
          <article className="portal-registrant-receipt">
            <ReviewModalHeader titleId={titleId} name={request.name} date={`Sent ${formatDate(request.submittedAt)}`} reference={request.referenceCode} status={<RequestStatus edit={editOpen} status={request.status} />} />
            <ReviewModalToolbar label="Access request view" active={view} onChange={next => { setView(next); if (body.current) body.current.scrollTop = 0; }} items={[
              { key: "profile", label: "Profile & Affiliation" },
              { key: "declarations", label: "E-Declarations" },
              { key: "approval", label: "Approve as" },
              { key: "logs", label: "Logs" },
            ]} />
            <div ref={body} className="portal-registrant-receipt-body">
              <div className="portal-registrant-groups">
                {view === "profile" && <>
                  <ReviewModalDetailsGroup title="Profile" number="01">
                    <CopyableReviewFact label="Last name">{request.lastName}</CopyableReviewFact>
                    <CopyableReviewFact label="First name">{request.firstName}</CopyableReviewFact>
                    <CopyableReviewFact label="Middle name">{request.middleName || `${request.middleInitial}.`}</CopyableReviewFact>
                    <CopyableReviewFact label="Email" copyValue={request.email}><span>{request.email}</span><span className="portal-verified" title="Verified through UST Google"><ShieldCheck size={12} aria-hidden="true" />Verified</span></CopyableReviewFact>
                    <CopyableReviewFact label="Student number">{request.studentNumber}</CopyableReviewFact>
                    <CopyableReviewFact label="Mobile number">{request.contactNumber || "Not given"}</CopyableReviewFact>
                    {request.facebookUrl && <CopyableReviewFact label="Facebook">{request.facebookUrl}</CopyableReviewFact>}
                  </ReviewModalDetailsGroup>
                  <ReviewModalDetailsGroup title="Affiliation" number="02">
                    <CopyableReviewFact label="Serves in">{affiliations[request.affiliation]}</CopyableReviewFact>
                    <CopyableReviewFact label="College">{request.college}</CopyableReviewFact>
                    <CopyableReviewFact label="Program">{request.program}</CopyableReviewFact>
                    <CopyableReviewFact label="Year level">{request.yearLevel}</CopyableReviewFact>
                  </ReviewModalDetailsGroup>
                  <ReviewModalDetailsGroup title="Position" number="03">
                    <CopyableReviewFact label="Asked for">{ownWords ? `They wrote: “${request.role}”` : asked}</CopyableReviewFact>
                    {!ownWords && <CopyableReviewFact label="Role">{request.role}</CopyableReviewFact>}
                  </ReviewModalDetailsGroup>
                </>}
                {view === "declarations" && (request.declarations.length > 0 ? <ReviewModalDetailsGroup title="E-declarations" number="01">
                  {request.declarations.map(declaration => <CopyableReviewFact key={declaration.key} label={declaration.title}>Accepted {formatDate(declaration.acceptedAt)}</CopyableReviewFact>)}
                </ReviewModalDetailsGroup> : <p className="portal-muted">No e-declarations were recorded with this request.</p>)}
                {view === "approval" && <section className="portal-registrant-group">
                  <h3>Approve as</h3>
                  {canDecide ? <div className="portal-request-picks">
                    {localManager ? <span>{affiliations[start]}</span> : <Dropdown label={`Affiliation for ${request.name}`} value={affiliation} onChange={(next) => setAffiliation(next as Affiliation)} options={optionsOf(affiliations)} disabled={!hydrated || pending} />}
                    <Dropdown label={`Position for ${request.name}`} value={choice} onChange={setChoice} options={choices(positions)} placeholder="Select position" disabled={!hydrated || pending} />
                    <RoleSelect position={position} role={role} options={options} onChange={setRole} label={`Role for ${request.name}`} disabled={!hydrated || pending} />
                  </div> : <p className="portal-muted">{request.status === "pending" ? "Only an account manager can approve or decline this request." : `This access request was ${request.status}${request.decidedBy ? ` by ${request.decidedBy}` : ""}${request.decidedAt ? ` on ${formatDate(request.decidedAt)}` : ""}.`}</p>}
                </section>}
                {view === "logs" && <RequestLogs request={request} edits={history} error={historyError} />}
              </div>
            </div>
            {canDecide && <ReviewModalFooter leading={<DeleteButton action={declineAccessRequest.bind(null, request.id)} label="Decline" dialogTitle="Decline this request?" prompt={`${request.name} is emailed that their request was declined, and sees it when they track it. They can send a new request.`} confirmLabel="Decline request" pendingLabel="Declining" animatedIcon={false} />}>
              <button type="button" className="portal-button is-ok" disabled={!hydrated || pending || (view === "approval" && (!position || !role))} onClick={view === "approval" ? approve : () => { setView("approval"); if (body.current) body.current.scrollTop = 0; }}>{pending ? <Busy>Approving</Busy> : view === "approval" ? "Approve request" : "Review approval"}</button>
            </ReviewModalFooter>}
          </article>
        </dialog>
      </td>
    </tr>
  );
}
