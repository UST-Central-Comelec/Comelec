"use client";

import { ReviewModalDetailsGroup, ReviewModalHeader, ReviewModalToolbar } from "./review-modal-ui";
import { EvaluationResponseDetails } from "@/components/portal/event-evaluation-editor";
import type { EvaluationQuestion, EvaluationResponse } from "@/lib/events/evaluation";
import { useId, useRef, useState, useTransition } from "react";
import { Check, ChevronRight, Clock, Mail, Search, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { registrationKinds, requestKinds, requestDecisionStatus, type DecisionsResult, type RegistrationKind, type RequestKind, type RequestStatus } from "@/lib/events/options";

/** One person's sign-up, with their answers already in words. */
export type RegistrantRow = {
  id: string;
  referenceCode: string;
  attendanceConfirmedAt: string | null;
  evaluation: EvaluationResponse | null;
  name: string;
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  /** Registered with a UST account verified through Google. */
  verified: boolean;
  sex: string;
  age: number | null;
  studentNumber: string | null;
  /** "UST student", "Another institution". */
  affiliation: string;
  /** What the list row shows: a student's college or faculty, or the affiliation itself. */
  affiliationSummary: string;
  /** Their college and program, office, or institution, as label and value. */
  affiliationFacts: Array<[string, string]>;
  /** "Official organization representative" with their organization, position and committee, or "Independent participant". */
  attending: { label: string; facts: Array<[string, string]> };
  /** What they asked for under Logistics, each with what they wrote for it (a car's plate, their allergens) as label and value. */
  requests: Array<{ kind: RequestKind; label: string; facts: Array<[string, string]>; status: RequestStatus }>;
  status: RegistrationKind;
  /** "Oct 1, 2026, 9:41 AM", formatted on the server so the browser draws the same text. */
  signedUp: string;
};

const PAGE_SIZE = 25;

type Filter = RegistrationKind | "all";
type Resend = (registrationId: string) => Promise<{ sent: boolean; message: string }>;
/** Saves the picks made for one registrant (approved or not) and emails them the ones that changed. */
type Save = (registrationId: string, decisions: Partial<Record<RequestKind, boolean>>) => Promise<DecisionsResult>;

/** Everything about a registrant that the search box looks through. */
const searchable = (row: RegistrantRow) => [row.referenceCode, row.studentNumber, row.name, row.email, row.affiliation, row.affiliationSummary, ...row.affiliationFacts.map(([, value]) => value), row.attending.label, ...row.attending.facts.map(([, value]) => value), ...row.requests.flatMap((request) => [request.label, ...request.facts.map(([, value]) => value)])].join(" ").toLowerCase();

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
function Need({ request, pick, onPick, disabled }: { request: RegistrantRow["requests"][number]; pick?: boolean; onPick?: (approved: boolean) => void; disabled?: boolean }) {
  const shown: RequestStatus = pick === undefined ? request.status : requestDecisionStatus(request.status, pick);
  const changed = shown !== request.status;
  const answer = answers[shown];
  const AnswerIcon = answer.icon;
  return (
    <li className={`portal-need is-${shown}${changed ? " is-changed" : ""}`}>
      <div className="portal-need-main">
        <strong>{request.label}{changed && <em>Not saved</em>}</strong>
        {request.facts.length > 0 && (
          <dl className="portal-need-facts">
            {request.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
      </div>
      {onPick ? (
        <div className="portal-need-decide" role="group" aria-label={`Answer: ${request.label}`}>
          <button type="button" className="is-approve" aria-pressed={shown === "approved"} disabled={disabled} onClick={() => onPick(true)}>
            <Check size={14} strokeWidth={2.4} aria-hidden="true" />{shown === "approved" ? "Approved" : "Approve"}
          </button>
          <button type="button" className="is-decline" aria-pressed={shown === "unavailable" || shown === "revoked"} disabled={disabled} onClick={() => onPick(false)}>
            <X size={14} strokeWidth={2.4} aria-hidden="true" />{request.status === "approved" || request.status === "revoked" ? "Revoked" : shown === "unavailable" ? "Declined" : "Decline"}
          </button>
        </div>
      ) : (
        <span className="portal-need-answer"><AnswerIcon size={13} strokeWidth={2.4} aria-hidden="true" />{answer.label}</span>
      )}
    </li>
  );
}

/** What came of a save, in a line. */
function savedMessage(result: DecisionsResult) {
  if (result.error) return result.error;
  if (!result.saved) return "Nothing changed, so nothing was sent.";
  if (result.email === "sent") return "";
  if (result.email === "off") return "Saved. No email was sent: the Logistics email is switched off under Email Sender → Automatic.";
  return `Saved, but the email to ${result.to} couldn’t be sent. Let them know another way.`;
}

/** All logistics choices, with decisions staged until the footer's Update is confirmed. */
function Needs({ row, picks, onPick, pending }: { row: RegistrantRow; picks: Partial<Record<RequestKind, boolean>>; onPick?: (kind: RequestKind, approved: boolean) => void; pending: boolean }) {
  return (
    <section className="portal-needs">
      <h3 className="portal-needs-head">Logistical Requests</h3>
      <ul>{(Object.keys(requestKinds) as RequestKind[]).map((kind) => {
        const request = row.requests.find((entry) => entry.kind === kind);
        return request
          ? <Need key={kind} request={request} pick={picks[kind]} onPick={onPick ? (approved) => onPick(kind, approved) : undefined} disabled={pending} />
          : <li key={kind} className="portal-need is-not-requested"><div className="portal-need-main"><strong>{requestKinds[kind].short}</strong></div><span className="portal-need-answer">Not requested</span></li>;
      })}</ul>
    </section>
  );
}

/** A heading over label-and-value lines, in the open registrant. */
function Facts({ title, number, facts }: { title: string; number: string; facts: Array<[string, React.ReactNode]> }) {
  return (
    <ReviewModalDetailsGroup title={title} number={number}>
      {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </ReviewModalDetailsGroup>
  );
}

/** A compact list row opens a native modal with the registration details. */
function Registrant({ row, evaluationQuestions, remove, save, resend }: { row: RegistrantRow; evaluationQuestions?: EvaluationQuestion[]; remove?: (registrationId: string) => Promise<void>; save?: Save; resend?: Resend }) {
  const [view, setView] = useState<"registration" | "logistics" | "evaluation">("registration");
  const panelId = useId();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [visited, setVisited] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const confirmationTitleId = useId();
  const [confirmation, setConfirmation] = useState<"update" | "remove" | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [picks, setPicks] = useState<Partial<Record<RequestKind, boolean>>>({});
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const working = useRef(false);
  const changes = row.requests.filter((request) => picks[request.kind] !== undefined && requestDecisionStatus(request.status, picks[request.kind]!) !== request.status);

  function reviewRegistration() {
    setView("registration");
    setCopyMessage("");
    setVisited(true);
    dialog.current?.showModal();
  }

  function openConfirmation(action: "update" | "remove") {
    setConfirmation(action);
    setConfirmationError("");
    confirmationDialog.current?.showModal();
  }

  function confirm() {
    if (working.current || !confirmation) return;
    working.current = true;
    setConfirmationError("");
    startTransition(async () => {
      try {
        if (confirmation === "remove" && remove) {
          await remove(row.id);
          confirmationDialog.current?.close();
          dialog.current?.close();
        } else if (confirmation === "update" && save && changes.length) {
          const result = await save(row.id, Object.fromEntries(changes.map((request) => [request.kind, picks[request.kind]!])));
          if (result.error) {
            setConfirmationError(result.error);
            return;
          }
          setPicks({});
          const message = savedMessage(result);
          setFeedback(message ? { message, error: result.email === "failed" || result.email === "off" } : null);
          confirmationDialog.current?.close();
        }
      } catch (error) {
        unstable_rethrow(error);
        setConfirmationError(confirmation === "remove" ? "Couldn’t remove the registration. Please try again." : "Couldn’t update the registration. Please try again.");
      } finally {
        working.current = false;
      }
    });
  }

  function resendEmail() {
    if (!resend || working.current) return;
    working.current = true;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await resend(row.id);
        setFeedback({ message: result.message, error: !result.sent });
      } catch (error) {
        unstable_rethrow(error);
        setFeedback({ message: "Couldn’t resend the acknowledgement. Please try again.", error: true });
      } finally {
        working.current = false;
      }
    });
  }

  async function copyEmail() {
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(row.email);
      setCopyMessage("Email copied.");
    } catch {
      setCopyMessage("Couldn’t copy. Select the email and copy it manually.");
    }
  }

  return (
    <li className="portal-registrant">
      <div className="portal-registrant-toggle portal-event-registrant-row">
        <span className="portal-registrant-progress" aria-label={`${row.attendanceConfirmedAt ? "Attendance confirmed" : "Attendance not confirmed"}; ${row.evaluation ? "Evaluation answered" : "Evaluation not answered"}`}>
          {row.attendanceConfirmedAt && <i className="is-attended" title="Attendance confirmed" />}
          {row.evaluation && <i className="is-evaluated" title="Evaluation answered" />}
        </span>
        <span className="portal-registrant-name">{row.name}</span>
        <span className="portal-registrant-email">{row.email}</span>
        <span className="portal-registrant-affiliation">{row.affiliationSummary}</span>
        <button type="button" className="portal-list-review" aria-haspopup="dialog" aria-controls={panelId} aria-label={`Review registration for ${row.name}`} onClick={reviewRegistration}><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      </div>
      <dialog ref={dialog} className="portal-registrant-dialog" id={panelId} aria-labelledby={titleId} onClick={(event) => {
        if (event.target === event.currentTarget && !pending) dialog.current?.close();
      }} onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <button type="button" className="portal-icon-button is-light portal-registrant-close" aria-label="Close registration" autoFocus disabled={pending} onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
        <article className="portal-registrant-receipt">
          <ReviewModalHeader titleId={titleId} name={row.name} date={row.signedUp} reference={row.referenceCode} />
          <ReviewModalToolbar label="Registrant details view" active={view} onChange={setView} items={[
            { key: "registration", label: "Registration Details" },
            { key: "logistics", label: <>Logistical Requests{changes.length > 0 && <span className="portal-logistics-unsaved">{changes.length} unsaved</span>}</> },
            { key: "evaluation", label: "Evaluation Response" },
          ]} actions={visited ? <>
            {view === "registration" && <>
              {resend && <button type="button" className="portal-registrant-action-button" disabled={pending} onClick={resendEmail}><Mail size={14} aria-hidden="true" />{pending && !confirmation ? "Sending…" : "Resend Acknowledgement"}</button>}
              {remove && <button type="button" className="portal-registrant-action-button" disabled={pending} onClick={() => openConfirmation("remove")}>Remove Registration</button>}
            </>}
            {view === "logistics" && save && <button type="button" className="portal-registrant-action-button" disabled={pending || changes.length === 0} onClick={() => openConfirmation("update")}>Update</button>}
          </> : undefined} />
          <div className="portal-registrant-receipt-body">
            {feedback && <p role="status" className={`portal-registrant-feedback${feedback.error ? " is-error" : ""}`}>{feedback.message}</p>}
            {view === "evaluation" ? <EvaluationResponseDetails response={row.evaluation} questions={evaluationQuestions} /> : view === "logistics" ? <div className="portal-registrant-logistics">
              {visited && <Needs row={row} picks={picks} pending={pending} onPick={save ? (kind, approved) => { setPicks((current) => ({ ...current, [kind]: approved })); setFeedback(null); } : undefined} />}
            </div> : (
              <div className="portal-registrant-groups">
                <Facts title="Profile" number="01" facts={[
                  ["Last name", row.lastName],
                  ["First name", row.firstName],
                  ["Middle name", row.middleName || "Not given"],
                  ["Email", <><button type="button" className="portal-registrant-copy-email" title="Copy email to clipboard" aria-label={`Copy ${row.email} to clipboard`} onClick={copyEmail}>{row.email}</button>{row.verified && <span className="portal-verified" title="Verified through UST Google"><ShieldCheck size={12} aria-hidden="true" />Verified</span>}<span className="portal-registrant-copy-status" role="status">{copyMessage}</span></>],
                  ["Sex", row.sex],
                  ["Age", row.age === null ? "Not given" : String(row.age)],
                  ["Student number", row.studentNumber || "Not given"],
                ]} />
                <Facts title="Affiliation" number="02" facts={[["Affiliation", row.affiliation], ...row.affiliationFacts]} />
                <Facts title="Participation" number="03" facts={[["Attending as", row.attending.label], ...row.attending.facts, ["Attendance", row.attendanceConfirmedAt ? `Confirmed ${new Date(row.attendanceConfirmedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : "Not confirmed"]]} />
              </div>
            )}
          </div>

        </article>
      </dialog>
      <dialog ref={confirmationDialog} className="portal-registrant-confirmation" aria-labelledby={confirmationTitleId} onClose={() => setConfirmation(null)} onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <h2 id={confirmationTitleId}>{confirmation === "remove" ? "Remove registration?" : "Update registration?"}</h2>
        <p>{confirmation === "remove"
          ? <>This will permanently remove <strong>{row.name}</strong>’s registration and logistics requests.</>
          : <>Save the updated logistics decisions for <strong>{row.name}</strong>? An email with these changes will be sent to <strong>{row.email}</strong>.</>}</p>
        {confirmationError && <p className="portal-form-error" role="alert">{confirmationError}</p>}
        <div className="portal-registrant-confirmation-actions">
          <button type="button" className="portal-registrant-action-button" disabled={pending} autoFocus onClick={() => confirmationDialog.current?.close()}>Cancel</button>
          <button type="button" className="portal-registrant-action-button" disabled={pending} onClick={confirm}>{pending ? confirmation === "remove" ? "Removing…" : "Updating…" : confirmation === "remove" ? "Remove Registration" : "Update & Send Email"}</button>
        </div>
      </dialog>
    </li>
  );
}

/**
 * Everyone who signed up for an event, with details in individual receipt modals: searchable, filtered by whether they registered or are on the waitlist, a page at a time.
 * With `remove` and `save` (the unit that manages the event), a registration can be removed and what
 * it asked for under Logistics answered.
 */
export function RegistrantsTable({ rows, evaluationQuestions, remove, save, resend }: { rows: RegistrantRow[]; evaluationQuestions?: EvaluationQuestion[]; remove?: (registrationId: string) => Promise<void>; save?: Save; resend?: Resend }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const counts = { all: rows.length, registered: rows.filter((row) => row.status === "registered").length, waitlisted: rows.filter((row) => row.status === "waitlisted").length };
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = rows.filter((row) => (filter === "all" || row.status === filter) && (terms.length === 0 || terms.every((term) => searchable(row).includes(term))));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  // Removing the last row of the last page, or narrowing the search, can leave the page number past the end.
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const show = (next: Filter) => {
    setFilter(next);
    setPage(0);
  };

  return (
    <>
      <div className="portal-table-tools portal-registrants-toolbar">
        <div className="portal-registrants-tools">
          <div className="portal-progress-legend" aria-label="Registrant status legends">
            <span><i className="is-attended" aria-hidden="true" />Attendance confirmed</span>
            <span><i className="is-evaluated" aria-hidden="true" />Evaluation answered</span>
          </div>
          {/* Only worth showing when there's a waitlist to tell apart. */}
          {counts.waitlisted > 0 && (
            <div className="portal-filters" role="group" aria-label="Filter by status">
              {(["all", "registered", "waitlisted"] as const).map((value) => (
                <button key={value} type="button" className={filter === value ? "is-active" : undefined} aria-pressed={filter === value} onClick={() => show(value)}>
                  {value === "all" ? "Everyone" : registrationKinds[value]}<small>{counts[value]}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="portal-search">
          <span className="portal-visually-hidden">Search registrants</span>
          <Search size={15} aria-hidden="true" />
          <input className="portal-input" type="search" value={query} placeholder="Search by name, email, college, institution or organization" autoComplete="off" spellCheck={false} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="portal-empty" role="status">{rows.length === 0 ? "Nobody has signed up yet. Registrations appear here as they come in." : "No registrants match that search."}</p>
      ) : (
        <div className="portal-registrants">
          <div className="portal-registrants-head" aria-hidden="true"><span>Status</span><span>Name</span><span>Email</span><span>Affiliation</span></div>
          <ul className="portal-registrants-list">
            {shown.map((row) => <Registrant key={row.id} row={row} evaluationQuestions={evaluationQuestions} remove={remove} save={save} resend={resend} />)}
          </ul>
        </div>
      )}

      {matching.length > 0 && (
        <div className="portal-table-foot">
          <p role="status">Showing {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {matching.length}{matching.length !== rows.length ? ` (${rows.length} in all)` : ""}</p>
          {pages > 1 && (
            <div className="portal-pager">
              <button type="button" className="portal-button is-small is-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
              <button type="button" className="portal-button is-small is-ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
