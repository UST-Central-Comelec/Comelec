"use client";

import { DeleteIcon as ActionDeleteIcon, SaveIcon as ActionSaveIcon } from "@/components/action-icons";
import { LogisticalRequests } from "./logistical-requests";
import { RsvpResponseReview, type RsvpReviewActions } from "./rsvp-response-review";
import { UserPlusIcon } from "@/components/lucide-animated/user-plus";
import { UserRoundCogIcon } from "@/components/lucide-animated/user-round-cog";
import type { EventEditRequest } from "@/lib/events/edit-requests";
import { SlidingFilterButtons } from "./sliding-filters";
import { Dropdown } from "./dropdown";
import { RegistrantsExport } from "./registrants-export";
import { ArrowUpDown } from "@/components/animate-ui/icons/arrow-up-down";
import { RotateCCWIcon } from "@/components/lucide-animated/rotate-ccw";
import { scrollToElement } from "@/lib/scroll";
import { isLegacyRsvp, rsvpResponseFacts, type RsvpResponse } from "@/lib/events/rsvp";
import { CopyableReviewFact, ReviewModalDetailsGroup, ReviewModalFooter, ReviewModalHeader, ReviewModalToolbar } from "./review-modal-ui";
import { toast } from "./toast";
import { ReviewActionIcon } from "./review-action-icon";
import { EvaluationResponseDetails } from "@/components/portal/event-evaluation-editor";
import type { EvaluationQuestion, EvaluationResponse } from "@/lib/events/evaluation";
import { useId, useRef, useState, useTransition } from "react";
import { ChevronRight, ShieldCheck, Clock } from "lucide-react";
import { SearchIcon as Search, CloseIcon as X } from "@/components/action-icons";
import { unstable_rethrow } from "next/navigation";
import { requestDecisionStatus, type DecisionsResult, type RegistrationKind, type RequestKind, type RequestStatus } from "@/lib/events/options";

/** One person's sign-up, with their answers already in words. */
export type EventResponseRow = {
  id: string;
  referenceCode: string;
  registered?: boolean;
  rsvp?: RsvpResponse | null;
  editRequests?: EventEditRequest[];
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
  submittedAt?: string;
};

const PAGE_SIZE = 25;
const nameOrder = new Intl.Collator("en-PH", { sensitivity: "base" });
const submittedTime = (row: EventResponseRow, rsvp: boolean) => {
  const value = rsvp ? row.rsvp?.created_at : row.submittedAt;
  return value ? Date.parse(value) || 0 : 0;
};

type ResponseFilter = "registrants" | "rsvp";
type DisplayColumns = { reference: boolean; submission: boolean; degree: boolean };

function ColumnSwitch({ label, next, selected, onClick }: { label: string; next: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className="portal-button is-ghost is-small portal-registrants-column-switch" aria-label={`${label}. Show ${next.toLowerCase()}`} aria-pressed={selected} title={`Show ${next.toLowerCase()}`} onClick={onClick}>
    <span className="portal-registrants-column-label">{label}</span>
  </button>;
}

/** University, degree or RSVP attendance answers, rather than a college or organization name. */
function affiliationCell(row: EventResponseRow, degree: boolean, rsvp: boolean) {
  const facts = rsvp && row.rsvp ? rsvpResponseFacts(row.rsvp.answers) : row.affiliationFacts;
  const answer = (labels: string[]) => facts.find(([label, value]) => labels.includes(label.toLowerCase()) && value.trim() && value !== "Not given")?.[1];
  if (degree && rsvp) {
    const value = row.rsvp && !isLegacyRsvp(row.rsvp.answers) ? row.rsvp.answers.values.rsvp_attendance : undefined;
    return typeof value === "string" && value.trim() ? value : answer(["attendance response", "attendance"]) || "—";
  }
  if (degree) return answer(["degree", "degree program", "degree / program", "program", "course"]) || "—";
  const university = answer(["university", "university / institution", "school / university", "school / institution", "institution"]);
  if (university) return university;
  const affiliation = rsvp ? answer(["affiliation"]) : row.affiliation;
  if (affiliation === "University of Santo Tomas" || affiliation === "UST student" || affiliation === "UST faculty or staff") return "University of Santo Tomas";
  return affiliation || "—";
}
type StatusFilter = "all" | "attended" | "evaluated" | "edit-request" | "waitlisted";
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "attended", label: "Attendance logged" },
  { value: "evaluated", label: "Evaluation answered" },
  { value: "edit-request", label: "Edit request" },
  { value: "waitlisted", label: "Waitlisted" },
];
const matchesStatusFilter = (row: EventResponseRow, filter: StatusFilter) => {
  switch (filter) {
    case "attended": return Boolean(row.attendanceConfirmedAt);
    case "evaluated": return Boolean(row.evaluation);
    case "edit-request": return (row.editRequests ?? []).some(request => request.status === "pending");
    case "waitlisted": return row.registered !== false && row.status === "waitlisted";
    default: return true;
  }
};
const responseFilters: { key: ResponseFilter; label: string; icon: typeof UserPlusIcon }[] = [{ key: "registrants", label: "Registrants", icon: UserPlusIcon }, { key: "rsvp", label: "RSVP Responses", icon: UserRoundCogIcon }];
export const matchesResponseFilter = (row: EventResponseRow, filter: ResponseFilter) => filter === "registrants" ? row.registered !== false : Boolean(row.rsvp);
type AddressEdit = (requestId: string, decision: "accepted" | "declined") => Promise<{ error?: string; saved?: boolean }>;
type Resend = (registrationId: string) => Promise<{ sent: boolean; message: string }>;
/** Saves the picks made for one registrant (approved or not) and emails them the ones that changed. */
type Save = (registrationId: string, decisions: Partial<Record<RequestKind, boolean>>) => Promise<DecisionsResult>;

/** Everything about a registrant that the search box looks through. */
const searchable = (row: EventResponseRow) => [row.referenceCode, row.rsvp?.reference_code, row.studentNumber, row.name, row.email, row.affiliation, row.affiliationSummary, ...row.affiliationFacts.map(([, value]) => value), row.attending.label, ...row.attending.facts.map(([, value]) => value), ...(row.rsvp ? rsvpResponseFacts(row.rsvp.answers).map(([, value]) => value) : []), ...row.requests.flatMap((request) => [request.label, ...request.facts.map(([, value]) => value)])].join(" ").toLowerCase();

/** What came of a save, in a line. */
function savedMessage(result: DecisionsResult) {
  if (result.error) return result.error;
  if (!result.saved) return "Nothing changed, so nothing was sent.";
  if (result.email === "sent") return "Logistical decisions saved, and an email sent.";
  if (result.email === "off") return "Saved. No email was sent: the Logistics email is switched off under Email → Automatic.";
  return `Saved, but the email to ${result.to} couldn’t be sent. Let them know another way.`;
}

/** A heading over label-and-value lines, in the open registrant. */
function Facts({ title, number, facts }: { title: string; number: string; facts: Array<[string, React.ReactNode, string?]> }) {
  return (
    <ReviewModalDetailsGroup title={title} number={number}>
      {facts.map(([label, value, copyValue]) => <CopyableReviewFact key={label} label={label} copyValue={copyValue}>{value}</CopyableReviewFact>)}
    </ReviewModalDetailsGroup>
  );
}

/** A compact list row opens a native modal with the registration details. */
function Registrant({ row, columns, evaluationQuestions, remove, save, resend, preferredView, addressEdit, rsvpActions }: { row: EventResponseRow; columns: DisplayColumns; rsvpActions?: RsvpReviewActions; addressEdit?: AddressEdit; preferredView?: "rsvp" | "evaluation"; evaluationQuestions?: EvaluationQuestion[]; remove?: (registrationId: string) => Promise<void>; save?: Save; resend?: Resend }) {
  const [view, setView] = useState<"registration" | "logistics" | "evaluation" | "rsvp">(preferredView ?? (row.registered === false ? row.rsvp ? "rsvp" : "evaluation" : "registration"));
  const panelId = useId();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [decisions, setDecisions] = useState<Partial<Record<string, "accepted" | "declined">>>({});
  const pendingEdits = (row.editRequests ?? []).filter(request => request.status === "pending" && !decisions[request.id]);
  const [reviewSession, setReviewSession] = useState(0);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [visited, setVisited] = useState(false);
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const confirmationTitleId = useId();
  const [confirmation, setConfirmation] = useState<"update" | "remove" | null>(null);
  const [picks, setPicks] = useState<Partial<Record<RequestKind, boolean>>>({});
  const [pending, startTransition] = useTransition();
  const working = useRef(false);
  const changes = row.requests.filter((request) => picks[request.kind] !== undefined && requestDecisionStatus(request.status, picks[request.kind]!) !== request.status);

  function reviewRegistration() {
    setReviewSession(value => value + 1);
    setView(preferredView ?? (row.registered === false ? row.rsvp ? "rsvp" : "evaluation" : "registration"));
    setVisited(true);
    dialog.current?.showModal();
  }

  function openConfirmation(action: "update" | "remove") {
    setConfirmation(action);
    confirmationDialog.current?.showModal();
  }

  function confirm() {
    if (working.current || !confirmation) return;
    working.current = true;
    startTransition(async () => {
      try {
        if (confirmation === "remove" && remove) {
          await remove(row.id);
          confirmationDialog.current?.close();
          dialog.current?.close();
          toast("Registration removed.");
        } else if (confirmation === "update" && save && changes.length) {
          const result = await save(row.id, Object.fromEntries(changes.map((request) => [request.kind, picks[request.kind]!])));
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          setPicks({});
          const message = savedMessage(result);
          if (message) toast(message, result.email === "failed" || result.email === "off" ? "warn" : "ok");
          confirmationDialog.current?.close();
        }
      } catch (error) {
        unstable_rethrow(error);
        toast(confirmation === "remove" ? "Couldn’t remove the registration. Please try again." : "Couldn’t update the registration. Please try again.", "error");
      } finally {
        working.current = false;
      }
    });
  }

  function resendEmail() {
    if (!resend || working.current) return;
    working.current = true;
    startTransition(async () => {
      try {
        const result = await resend(row.id);
        toast(result.message, result.sent ? "ok" : "warn");
      } catch (error) {
        unstable_rethrow(error);
        toast("Couldn’t resend the acknowledgement. Please try again.", "error");
      } finally {
        working.current = false;
      }
    });
  }

  function addressRequest(id: string, decision: "accepted" | "declined") {
    if (!addressEdit || working.current) return;
    working.current = true;
    startTransition(async () => {
      try {
        const result = await addressEdit(id, decision);
        if (result.error || !result.saved) { toast(result.error ?? "Couldn’t address the request. Try again.", "error"); return; }
        setDecisions(current => ({ ...current, [id]: decision }));
        toast(decision === "accepted" ? "Edit request accepted. Review and update the submission." : "Edit request declined.");
      } catch (error) {
        unstable_rethrow(error);
        toast("Couldn’t address the request. Try again.", "error");
      } finally { working.current = false; }
    });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied to clipboard.`);
    } catch {
      toast(`Couldn’t copy ${label.toLowerCase()}. Try selecting and copying the text.`, "error");
    }
  }

  const shownEditRequests = (row.editRequests ?? []).filter(request => view === "rsvp" ? request.rsvp_response_id === row.rsvp?.id : request.registration_id === row.id);
  const pendingEdit = shownEditRequests.find(request => request.status === "pending" && !decisions[request.id]);
  const editRequestActions = pendingEdit && addressEdit ? <div className="portal-modal-edit-request-actions">
    <span>Request to edit submission</span>
    <button type="button" className="portal-button is-small is-ok" disabled={pending || rsvpBusy} onClick={() => addressRequest(pendingEdit.id, "accepted")}>Accept</button>
    <button type="button" className="portal-button is-small is-danger-ghost" disabled={pending || rsvpBusy} onClick={() => addressRequest(pendingEdit.id, "declined")}>Decline</button>
  </div> : undefined;
  const editRequestPanels = shownEditRequests.map(request => {
    const status = decisions[request.id] ?? request.status;
    const label = status === "pending" ? "Edit requested" : status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Addressed";
    return <section className="portal-response-edit-request" key={request.id} aria-label="Response edit request">
      <header><h3>{request.rsvp_response_id ? "RSVP edit request" : "Registration edit request"}</h3><span className={`portal-tag ${status === "pending" ? "is-gold" : status === "declined" ? "is-warn" : "is-ok"}`}>{label}</span></header>
      <p>{request.requested_changes}</p>
      <span className="portal-muted">Requested {new Date(request.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</span>
    </section>;
  });

  const reference = preferredView === "rsvp" ? row.rsvp?.reference_code || "—" : row.referenceCode;
  const nameValue = columns.reference ? reference : row.name;
  const nameLabel = columns.reference ? "Reference code" : "Name";
  const submissionDate = preferredView === "rsvp" && row.rsvp
    ? new Date(row.rsvp.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })
    : row.signedUp;

  return (
    <li className="portal-registrant">
      <div className="portal-registrant-toggle portal-event-registrant-row" onClick={event => {
        if ((event.target as Element).closest("button, a")) return;
        reviewRegistration();
      }}>
        <span className="portal-registrant-progress" aria-label={`${row.attendanceConfirmedAt ? "Attendance logged" : "Attendance not logged"}; ${row.evaluation ? "Evaluation answered" : "Evaluation not answered"}; ${pendingEdits.length ? "Edit requested" : "No edit request"}${row.registered !== false && row.status === "waitlisted" ? "; Waitlisted" : ""}`}>
          {row.attendanceConfirmedAt && <i className="is-attended" title="Attendance logged" />}
          {row.evaluation && <i className="is-evaluated" title="Evaluation answered" />}
          {pendingEdits.length > 0 && <i className="is-edit-request" title="Edit requested" />}
          {row.registered !== false && row.status === "waitlisted" && <i className="is-waitlisted" title="Waitlisted" />}
        </span>
        <span className="portal-registrant-name"><button type="button" className="portal-registrant-copy" title={`Copy ${nameLabel.toLowerCase()}`} aria-label={`Copy ${nameLabel.toLowerCase()} ${nameValue}`} onClick={() => void copy(nameValue, nameLabel)}>{nameValue}</button></span>
        <span className={`portal-registrant-email${columns.submission ? " is-submission" : ""}`}>{columns.submission ? submissionDate : row.email && <button type="button" className="portal-registrant-copy" title="Copy email" aria-label={`Copy email ${row.email}`} onClick={() => void copy(row.email, "Email")}>{row.email}</button>}</span>
        <span className="portal-registrant-affiliation">{affiliationCell(row, columns.degree, preferredView === "rsvp")}</span>
        <button type="button" className="portal-list-review" aria-haspopup="dialog" aria-controls={panelId} aria-label={`Review responses for ${row.name}`} onClick={reviewRegistration}><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      </div>
      <dialog ref={dialog} className="portal-registrant-dialog" id={panelId} aria-labelledby={titleId} onClick={(event) => {
        if (event.target === event.currentTarget && !(pending || rsvpBusy)) dialog.current?.close();
      }} onCancel={(event) => { if (pending || rsvpBusy) event.preventDefault(); }}>
        <button type="button" className="portal-icon-button is-light portal-registrant-close" aria-label="Close participant details" autoFocus disabled={pending || rsvpBusy} onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
        <article className="portal-registrant-receipt">
          {view === "rsvp" && row.rsvp ? <RsvpResponseReview key={`${row.rsvp.id}:${reviewSession}`} response={row.rsvp} evaluation={row.evaluation} evaluationQuestions={evaluationQuestions} titleId={titleId} actions={rsvpActions} editRequestActions={editRequestActions} requestBusy={pending} onBusy={setRsvpBusy} onRemoved={() => dialog.current?.close()} back={preferredView !== "rsvp" && row.registered !== false ? () => setView("registration") : undefined}>{editRequestPanels}</RsvpResponseReview> : <>
          <ReviewModalHeader titleId={titleId} name={row.name} date={row.signedUp} reference={view === "rsvp" ? row.rsvp?.reference_code ?? row.referenceCode : row.referenceCode} />
          <ReviewModalToolbar label="Participant details view" active={view} onChange={setView} items={[
            ...(row.registered !== false ? [{ key: "registration" as const, label: "Registration Details" },
            { key: "logistics" as const, label: <>Logistical Requests{changes.length > 0 && <span className="portal-logistics-unsaved">{changes.length} unsaved</span>}</> },
             ] : []),
            ...(row.rsvp ? [{ key: "rsvp" as const, label: "RSVP Response" }] : []),
            { key: "evaluation", label: "Evaluation Response" },
          ]} />
          <div className="portal-registrant-receipt-body">
            {editRequestPanels}
            {view === "evaluation" ? <EvaluationResponseDetails response={row.evaluation} questions={evaluationQuestions} /> : view === "logistics" ? <div className="portal-registrant-logistics">
              {visited && <LogisticalRequests requests={row.requests} picks={picks} pending={pending} onPick={save ? (kind, approved) => { setPicks((current) => ({ ...current, [kind]: approved })); } : undefined} />}
            </div> : (
              <div className="portal-registrant-groups">
                <Facts title="Profile" number="01" facts={[
                  ["Last name", row.lastName],
                  ["First name", row.firstName],
                  ["Middle name", row.middleName || "Not given"],
                  ["Email", <><span>{row.email}</span>{row.verified && <span className="portal-verified" title="Verified through UST Google"><ShieldCheck size={12} aria-hidden="true" />Verified</span>}</>, row.email],
                  ["Sex", row.sex],
                  ["Age", row.age === null ? "Not given" : String(row.age)],
                  ["Student number", row.studentNumber || "Not given"],
                ]} />
                <Facts title="Affiliation" number="02" facts={[["Affiliation", row.affiliation], ...row.affiliationFacts]} />
                <Facts title="Participation" number="03" facts={[["Attending as", row.attending.label], ...row.attending.facts, ["Attendance", row.attendanceConfirmedAt ? `Confirmed ${new Date(row.attendanceConfirmedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : "Not confirmed"]]} />
              </div>
            )}
          </div>
          {visited && (view === "registration" || view === "logistics") && (resend || remove || save || editRequestActions) && <ReviewModalFooter leading={remove && <button type="button" className="portal-button is-danger-ghost portal-destructive-button" disabled={pending} onClick={() => openConfirmation("remove")}><ReviewActionIcon kind="remove" disabled={pending} />Remove</button>}>
            {editRequestActions ?? <>
              {resend && <button type="button" className="portal-button is-ghost" disabled={pending} onClick={resendEmail}><ReviewActionIcon kind="resend" disabled={pending} />{pending && !confirmation ? "Sending…" : "Resend"}</button>}
              {save && <button type="button" className="portal-button" disabled={pending || (view === "logistics" && changes.length === 0)} onClick={() => { if (changes.length) openConfirmation("update"); else setView("logistics"); }}><ReviewActionIcon kind="update" disabled={pending || (view === "logistics" && changes.length === 0)} />Update</button>}
            </>}
          </ReviewModalFooter>}

          </>}
        </article>
      </dialog>
      <dialog ref={confirmationDialog} className="portal-registrant-confirmation" aria-labelledby={confirmationTitleId} onClose={() => setConfirmation(null)} onCancel={(event) => { if (pending || rsvpBusy) event.preventDefault(); }}>
        <h2 id={confirmationTitleId}>{confirmation === "remove" ? "Remove registration?" : "Update registration?"}</h2>
        <p>{confirmation === "remove"
          ? <>This will permanently remove <strong>{row.name}</strong>’s registration and logistics requests.</>
          : <>Save the updated logistics decisions for <strong>{row.name}</strong>? An email with these changes will be sent to <strong>{row.email}</strong>.</>}</p>
        <div className="portal-registrant-confirmation-actions">
          <button type="button" className="portal-registrant-action-button" disabled={pending} autoFocus onClick={() => confirmationDialog.current?.close()}>Cancel</button>
          <button type="button" className={`portal-registrant-action-button${confirmation === "remove" ? " portal-destructive-button" : ""}`} disabled={pending} onClick={confirm}>{confirmation === "remove" ? <ActionDeleteIcon size={15} /> : <ActionSaveIcon size={15} />}{pending ? confirmation === "remove" ? "Removing…" : "Updating…" : confirmation === "remove" ? "Remove Registration" : "Update & Send Email"}</button>
        </div>
      </dialog>
    </li>
  );
}

/**
 * Public registrants and collaborator RSVPs, with searchable receipt modals and pending edit requests, a page at a time.
 * With `remove` and `save` (the unit that manages the event), a registration can be removed and what
 * it asked for under Logistics answered.
 */
export function EventResponsesTable({ rows, evaluationQuestions, remove, save, resend, addressEdit, rsvpActions, maximumRegistrants = null }: { rows: EventResponseRow[]; maximumRegistrants?: number | null; rsvpActions?: RsvpReviewActions; addressEdit?: AddressEdit; evaluationQuestions?: EvaluationQuestion[]; remove?: (registrationId: string) => Promise<void>; save?: Save; resend?: Resend }) {
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("registrants");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<"time" | "name">("time");
  const [columns, setColumns] = useState<DisplayColumns>({ reference: false, submission: false, degree: false });
  const columnsChanged = columns.reference || columns.submission || columns.degree;
  const affiliationAlternate = responseFilter === "rsvp" ? "Attendance response" : "Degree";
  const summary = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const totalRegistrants = rows.filter(row => row.registered !== false && row.status === "registered").length;
  const waitlisted = rows.filter(row => row.registered !== false && row.status === "waitlisted").length;
  const slotsFull = maximumRegistrants !== null && totalRegistrants >= maximumRegistrants;

  const filtered = rows.filter(row => matchesResponseFilter(row, responseFilter));
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = filtered.filter((row) => matchesStatusFilter(row, statusFilter) && (terms.length === 0 || terms.every((term) => searchable(row).includes(term))));
  const newestFirst = (a: EventResponseRow, b: EventResponseRow) => submittedTime(b, responseFilter === "rsvp") - submittedTime(a, responseFilter === "rsvp") || a.id.localeCompare(b.id);
  matching.sort(sort === "time" ? newestFirst : (a, b) => nameOrder.compare(a.lastName, b.lastName) || nameOrder.compare(a.firstName, b.firstName) || nameOrder.compare(a.middleName, b.middleName) || newestFirst(a, b));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  // Removing the last row of the last page, or narrowing the search, can leave the page number past the end.
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <>
      <div className="portal-table-tools portal-registrants-toolbar portal-participant-toolbar">
        <div className="portal-registrants-tools portal-participant-filters">
          <SlidingFilterButtons items={responseFilters.map(({ key, label, icon: Icon }) => ({ key, label: <span className="portal-participant-filter-label"><Icon size={16} aria-hidden="true" />{label}</span> }))} active={responseFilter} label="Participant response type" onChange={next => { setResponseFilter(next); setPage(0); }} />
        </div>
        <label className="portal-search">
          <span className="portal-visually-hidden">Search registrants</span>
          <Search size={15} aria-hidden="true" />
          <input className="portal-input" type="search" value={query} placeholder="Search by name, email, college, institution or organization" autoComplete="off" spellCheck={false} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        </label>
      </div>

      <div ref={summary} className="portal-table-tools portal-participant-summary">
        <div className="portal-progress-legend" aria-label="Registrant status legends">
          <span><i className="is-attended" aria-hidden="true" />Attendance logged</span>
          <span><i className="is-evaluated" aria-hidden="true" />Evaluation answered</span>
          <span><i className="is-edit-request" aria-hidden="true" />Edit request</span>
          <span><i className="is-waitlisted" aria-hidden="true" />Waitlisted</span>
        </div>
        <div className="portal-participant-summary-actions">
          <RegistrantsExport rows={matching} rsvp={responseFilter === "rsvp"} />
          <button type="button" className="portal-icon-button" aria-label={sort === "time" ? "Sorted newest first. Switch to surname A–Z" : "Sorted by surname A–Z. Switch to newest first"} aria-pressed={sort === "name"} title={sort === "time" ? "Newest first · Switch to surname A–Z" : "Surname A–Z · Switch to newest first"} onClick={() => {
            setSort(sort === "time" ? "name" : "time");
            setPage(0);
            if (summary.current) scrollToElement(summary.current);
          }}>{sort === "time" ? <Clock size={15} aria-hidden="true" /> : <span className="portal-applicant-sort-letter" aria-hidden="true">A</span>}</button>
          <Dropdown className="portal-participant-status-filter" size="pill" label="Filter registrants by status" value={statusFilter} options={statusFilters} onChange={value => {
            setStatusFilter(value as StatusFilter);
            setPage(0);
            if (summary.current) scrollToElement(summary.current);
          }} />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="portal-empty" role="status">{filtered.length === 0 ? responseFilter === "rsvp" ? "No RSVPs yet." : "No public registrations yet." : "No entries match your filters or search."}</p>
      ) : (
        <div className="portal-registrants portal-event-registrants">
          <div className="portal-registrants-head">
            <span className="portal-registrants-status-heading">Status</span>
            <ColumnSwitch label={columns.reference ? "Reference code" : "Name"} next={columns.reference ? "Name" : "Reference code"} selected={columns.reference} onClick={() => setColumns(current => ({ ...current, reference: !current.reference }))} />
            <ColumnSwitch label={columns.submission ? "Submission date" : "Email"} next={columns.submission ? "Email" : "Submission date"} selected={columns.submission} onClick={() => setColumns(current => ({ ...current, submission: !current.submission }))} />
            <ColumnSwitch label={columns.degree ? affiliationAlternate : "Affiliation"} next={columns.degree ? "Affiliation" : affiliationAlternate} selected={columns.degree} onClick={() => setColumns(current => ({ ...current, degree: !current.degree }))} />
            <button type="button" className="portal-list-review portal-registrants-switch-all" aria-label={columnsChanged ? "Restore default columns" : "Switch all displayed columns"} title={columnsChanged ? "Restore default columns" : "Switch all displayed columns"} onClick={() => setColumns({ reference: !columnsChanged, submission: !columnsChanged, degree: !columnsChanged })}>
              {columnsChanged ? <RotateCCWIcon size={16} aria-hidden="true" /> : <ArrowUpDown className="portal-registrants-switch-arrows" size={16} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </div>
          <ul className="portal-registrants-list">
            {shown.map((row) => <Registrant key={row.id} row={row} columns={columns} rsvpActions={rsvpActions} preferredView={responseFilter === "rsvp" ? "rsvp" : undefined} addressEdit={addressEdit} evaluationQuestions={evaluationQuestions} remove={row.registered !== false ? remove : undefined} save={row.registered !== false ? save : undefined} resend={row.registered !== false ? resend : undefined} />)}
          </ul>
        </div>
      )}

        <div className="portal-table-foot">
          <p role="status">Showing {matching.length ? `${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + shown.length}` : "0"} of {matching.length}{matching.length !== filtered.length ? ` (${filtered.length} in this view)` : ""}</p>
          {pages > 1 && (
            <div className="portal-pager">
              <button type="button" className="portal-button is-small is-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
              <button type="button" className="portal-button is-small is-ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          )}
          <p className="portal-participant-capacity">Registrants: {totalRegistrants.toLocaleString()} / {maximumRegistrants === null ? "Unlimited" : maximumRegistrants.toLocaleString()}{slotsFull && <> · Waitlisted: {waitlisted.toLocaleString()}</>}</p>
        </div>
    </>
  );
}
