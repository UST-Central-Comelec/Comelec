"use client";

import { ACCESS_REQUEST_RETENTION_NOTICE } from "@/lib/access-requests/retention";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { requestResponseEdit } from "@/lib/events/edit-request-actions";
import { ArrowRight, Check, Info, SquareCheck } from "lucide-react";
import { CopyIcon, EditIcon } from "@/components/action-icons";
import { declineAcceptance, trackApplication, type ApplicationStatus, type TrackedAccessRequest, type TrackedApplication, type TrackedRegistration, type TrackedRsvp } from "@/lib/applications/actions";
import { OFFER_DAYS, REAPPLY_DAYS, formatOfferDate, reapplyFrom } from "@/lib/applications/offer";
import { Busy } from "@/components/busy";

const statusLabels: Record<ApplicationStatus, string> = {
  pending: "Pending review",
  reviewing: "Pending review",
  accepted: "Accepted",
  declined: "Not selected",
};

const statusNotes: Record<ApplicationStatus, string> = {
  pending: "We have your application and the commission is reviewing it. The result will show here, and we’ll reach out through your UST email.",
  reviewing: "We have your application and the commission is reviewing it. The result will show here, and we’ll reach out through your UST email.",
  accepted: "Congratulations! You’ve been accepted.",
  declined: "Thank you for applying. You weren’t selected this time, but we hope you’ll apply again in a future cycle.",
};

const accessLabels: Record<TrackedAccessRequest["status"], string> = {
  pending: "Pending review",
  approved: "Approved",
  declined: "Not approved",
};

const accessNotes: Record<TrackedAccessRequest["status"], string> = {
  pending: "We have your request and the Executive Board is reviewing it. The decision will show here, and we’ll email your UST account.",
  approved: "You can now sign in to the Commission Portal with Google, using the UST account below.",
  declined: "Your request wasn’t approved. If you think this is a mistake, contact your Executive Board.",
};

const formatSubmitted = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Submitted → Pending review → Result, with the application's or request's place on it. `result` is set once it's decided. */
function StatusTimeline({ result }: { result: string | null }) {
  const reached = result ? 2 : 1;
  const stages = ["Submitted", "Pending review", result ?? "Result"];
  return (
    <ol className="track-timeline">
      {stages.map((stage, index) => (
        <li key={stage} className={index < reached ? "is-done" : index === reached ? "is-current" : undefined} aria-current={index === reached ? "step" : undefined}>
          <span className="track-timeline-marker" aria-hidden="true">{index < reached || (index === reached && index === 2) ? <Check size={12} strokeWidth={3} /> : null}</span>
          {stage}
        </li>
      ))}
    </ol>
  );
}

/** The status an applicant sees, with how they answered an acceptance. */
function applicationStatus(application: TrackedApplication): { label: string; tone: ApplicationStatus; note: string } {
  const { offer } = application;
  const answered = offer.respondedAt ? formatOfferDate(offer.respondedAt) : null;
  const again = `You can apply to the ${application.preferredBody} again from ${formatOfferDate(reapplyFrom(offer.respondedAt ?? Date.now()))}, or contact the commission to be considered sooner.`;
  if (offer.state === "joined") return { label: "Joined", tone: "accepted", note: "You’ve joined the Commission. Sign in to the Commission Portal with your UST account." };
  if (offer.state === "declined") return { label: "Offer declined", tone: "declined", note: `You declined this offer${answered ? ` on ${answered}` : ""}, and your slot went back to the unit. ${again}` };
  if (offer.state === "lapsed") return { label: "Offer lapsed", tone: "declined", note: `This offer lapsed${answered ? ` on ${answered}` : ""}: it wasn’t answered within ${OFFER_DAYS} days, so it counts as declined. ${again}` };
  const note = statusNotes[application.status];
  return { label: statusLabels[application.status], tone: application.status, note: offer.state === "open" && offer.expiresAt ? `${note} Your offer is valid until ${formatOfferDate(offer.expiresAt)}.` : note };
}

type Tone = "ok" | "gold" | "danger" | "dim";
type EditProps = { existing?: { requested_changes: string } | null; editUrl?: string | null; what?: "registration" | "RSVP" };

const toneOf: Record<ApplicationStatus, Tone> = { pending: "gold", reviewing: "gold", accepted: "ok", declined: "danger" };

/** A logistics request's status as a dot tone: waiting is gold, granted green, refused red, not asked dim. */
const requestTone = (status: string): Tone => status === "Approved" ? "ok" : status === "Pending" ? "gold" : status === "Not requested" ? "dim" : "danger";

function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`track-status is-${tone}`}>{children}</span>;
}

/** The reference code, large, with a copy button beside it. */
function Reference({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <div className="track-ref">
      <strong>{code}</strong>
      <button type="button" className="track-copy" onClick={copy} aria-label={copied ? "Reference code copied" : "Copy reference code"} title={copied ? "Copied" : "Copy reference code"}>
        {copied ? <Check size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}

/**
 * The shared frame of every tracked submission, laid out like a deployment page: what it is and its
 * reference on the left with the one action on the right, then the facts at a glance, then sections.
 * Edit requests, their confirmation and their status stay in the header.
 */
function TrackCard({ kind, label, reference, identity, edit, facts, lead, children, foot, className = "" }: {
  kind: string;
  label: string;
  reference: string;
  identity: string;
  edit: EditProps;
  facts: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  foot?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState(requestResponseEdit, {});
  const request = state.request ?? edit.existing;
  const editLink = edit.editUrl && request ? edit.editUrl : null;
  return (
    <section className={`track-result${className ? ` ${className}` : ""}`} aria-live="polite" aria-label={label}>
      <header className="track-head">
        <div className="track-head-main">
          <span className="track-kind">{kind}</span>
          <Reference code={reference} />
        </div>
        <div className="track-head-actions">
          {request && <div className="track-edit-status" role="status" aria-label="Your edit request">
            <span className="track-kind">{editLink ? "Edit request accepted" : "Edit request sent"}</span>
            <Status tone={editLink ? "ok" : "gold"}>{editLink ? "Ready to edit" : "Waiting for review"}</Status>
          </div>}
          {editLink
            ? <a className="button-primary track-action" href={editLink}>Edit your {edit.what}<ArrowRight size={15} aria-hidden="true" /></a>
            : !request && <form action={action}>
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="identity" value={identity} />
              <button type="submit" className="track-button-ghost is-small" disabled={pending}><EditIcon size={14} aria-hidden="true" />{pending ? <Busy>Requesting</Busy> : "Request edit"}</button>
            </form>}
        </div>
      </header>
      {lead}
      <dl className="track-facts">{facts}</dl>
      {state.error && <p className="apply-form-error" role="alert">{state.error}</p>}
      {children}
      {foot && <p className="track-foot"><Info size={13} aria-hidden="true" />{foot}</p>}
    </section>
  );
}

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <div className={wide ? "is-wide" : undefined}><dt>{label}</dt><dd>{children}</dd></div>;
}

/** A titled list of rows, each a name with its status on the right. */
function TrackRows({ title, summary, rows, empty }: { title: string; summary?: string; rows: Array<{ label: string; status: string; tone: Tone }>; empty?: string }) {
  return (
    <section className="track-section" aria-label={title}>
      <div className="track-section-head">
        <h3>{title}</h3>
        {summary && <span className="track-count">{summary}</span>}
      </div>
      {rows.length ? (
        <ul className="track-rows">
          {rows.map((row) => <li key={row.label}><span>{row.label}</span><Status tone={row.tone}>{row.status}</Status></li>)}
        </ul>
      ) : <p className="track-empty">{empty}</p>}
    </section>
  );
}

function TrackedResult({ application: tracked, identity, askDecline, onAsked }: { application: TrackedApplication; identity: string; askDecline: boolean; onAsked: () => void }) {
  const [declined, declineAction, declining] = useActionState(declineAcceptance, undefined);
  const application = declined?.application ?? tracked;
  const shown = applicationStatus(application);
  const decided = application.status === "accepted" || application.status === "declined";
  return (
    <TrackCard
      kind="Commissioner application"
      label="Your application"
      reference={application.referenceCode}
      identity={identity}
      edit={{ existing: application.editRequest }}
      foot="For your privacy, your application is deleted 60 days after you submit it."
      lead={<>
        <StatusTimeline result={decided ? shown.label : null} />
        <p className="track-note">{shown.note}</p>
        {application.offer.state === "open" && <OfferChoice application={application} identity={identity} askDecline={askDecline} onAsked={onAsked} action={declineAction} pending={declining} error={declined?.error} />}
        {application.offer.state !== "open" && declined?.error && <p className="apply-form-error" role="alert">{declined.error}</p>}
        {application.offer.state === "joined" && <p className="track-help"><Link href="/portal/login">Sign in to the portal</Link></p>}
      </>}
      facts={<>
        <Fact label="Status"><Status tone={toneOf[shown.tone]}>{shown.label}</Status></Fact>
        <Fact label="Applicant">{application.name}</Fact>
        <Fact label="Submitted">{formatSubmitted(application.submittedAt)}</Fact>
        <Fact label="Serve in">{application.preferredBody}</Fact>
        {application.division && <Fact label="Division">{application.division}</Fact>}
        <Fact label="Position">{application.position}</Fact>
        <Fact label="College or faculty">{application.college}</Fact>
        <Fact label="Program">{application.program}</Fact>
        <Fact label="Year level">{application.yearLevel}</Fact>
        {application.interview && <Fact label="Interview" wide>{application.interview}</Fact>}
      </>}
    />
  );
}

/**
 * An open acceptance: join, or decline after confirming. Opened from the acceptance email's Decline
 * button (`askDecline`), the confirmation shows straight away.
 */
function OfferChoice({ application, identity, askDecline, onAsked, action, pending, error }: {
  application: TrackedApplication;
  identity: string;
  askDecline: boolean;
  onAsked: () => void;
  action: (formData: FormData) => void;
  pending: boolean;
  error?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { offer } = application;

  useEffect(() => {
    if (!askDecline) return;
    onAsked();
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [askDecline, onAsked]);

  const close = () => { if (!pending) dialog.current?.close(); };

  return (
    <section className="track-offer" aria-label="Your answer to the offer">
      <p className="track-offer-prompt">To formally signify your acceptance of membership in the Commission, please confirm your decision by selecting one of the options below:</p>
      <div className="track-offer-actions">
        {offer.joinUrl && <a className="button-primary" href={offer.joinUrl}>Join the Commission <ArrowRight size={15} aria-hidden="true" /></a>}
        <button type="button" className="track-button-ghost" onClick={() => dialog.current?.showModal()}>Decline</button>
      </div>
      <dialog
        ref={dialog}
        className="track-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => { if (pending) event.preventDefault(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <h2 id={titleId}>Decline the offer?</h2>
        <div id={descriptionId}>
          <p>Are you sure you want to decline the offer? If you’re still undecided, your acceptance stays valid {offer.expiresAt ? <>for {OFFER_DAYS} days from your acceptance email, until <strong>{formatOfferDate(offer.expiresAt)}</strong></> : "until you answer"}.{offer.expiresAt && " After that, it’s declined automatically."}</p>
          <p>Once you decline, your slot goes back to the unit, and you can apply to the {application.preferredBody} again after {REAPPLY_DAYS} days, from {formatOfferDate(reapplyFrom())}, or contact the commission.</p>
        </div>
        {error && <p className="apply-form-error" role="alert">{error}</p>}
        <form action={action} className="track-dialog-actions">
          <input type="hidden" name="reference" value={application.referenceCode} />
          <input type="hidden" name="identity" value={identity} />
          <button type="button" className="track-button-ghost" autoFocus disabled={pending} onClick={close}>Cancel</button>
          <button type="submit" className="track-decline-confirm" disabled={pending}>{pending ? <Busy>Declining</Busy> : "Decline offer"}</button>
        </form>
      </dialog>
    </section>
  );
}

function TrackedAccess({ request, identity }: { request: TrackedAccessRequest; identity: string }) {
  const tone: Tone = request.status === "approved" ? "ok" : request.status === "declined" ? "danger" : "gold";
  return (
    <TrackCard
      kind="Portal access request"
      className="is-access-request"
      label="Your portal access request"
      reference={request.referenceCode}
      identity={identity}
      edit={{ existing: request.editRequest }}
      foot={ACCESS_REQUEST_RETENTION_NOTICE}
      lead={<>
        <StatusTimeline result={request.status === "pending" ? null : accessLabels[request.status]} />
        <p className="track-note">{accessNotes[request.status]}</p>
        {request.status === "approved" && <p className="track-help"><Link href="/portal/login">Sign in to the portal</Link></p>}
      </>}
      facts={<>
        <Fact label="Status"><Status tone={tone}>{accessLabels[request.status]}</Status></Fact>
        <Fact label="Submitted">{formatSubmitted(request.submittedAt)}</Fact>
        <Fact label="Name">{request.name}</Fact>
        <Fact label="UST email">{request.email}</Fact>
        <Fact label="Role">{request.role}</Fact>
        <Fact label="Year level">{request.yearLevel}</Fact>
        <Fact label="College or faculty">{request.college}</Fact>
        <Fact label="Program">{request.program}</Fact>
      </>}
    />
  );
}

function TrackedEvent({ registration, identity }: { registration: TrackedRegistration; identity: string }) {
  const registered = registration.status === "registered";
  const asked = registration.requests.filter((request) => request.status !== "Not requested").length;
  return (
    <TrackCard
      kind="Event registration"
      label="Your event registration"
      reference={registration.referenceCode}
      identity={identity}
      edit={{ existing: registration.editRequest, editUrl: registration.editUrl, what: "registration" }}
      facts={<>
        <Fact label="Status"><Status tone={registered ? "ok" : "gold"}>{registered ? "Registered" : "Waitlisted"}</Status></Fact>
        <Fact label="Event"><Link href={`/events/${registration.eventId}`}>{registration.eventName}</Link></Fact>
        <Fact label="Date">{registration.eventDate}</Fact>
        <Fact label="Submitted">{formatSubmitted(registration.submittedAt)}</Fact>
        <Fact label="Participant" wide>{registration.name}</Fact>
      </>}
    >
      <TrackRows
        title="Logistics requests"
        summary={asked ? `${asked} of ${registration.requests.length} requested` : "None requested"}
        rows={registration.requests.map((request) => ({ label: request.label, status: request.status, tone: requestTone(request.status) }))}
      />
    </TrackCard>
  );
}

function TrackedCollaborator({ rsvp, identity }: { rsvp: TrackedRsvp; identity: string }) {
  return (
    <TrackCard
      kind="Collaborator RSVP"
      label="Your collaborator RSVP"
      reference={rsvp.referenceCode}
      identity={identity}
      edit={{ existing: rsvp.editRequest, editUrl: rsvp.editUrl, what: "RSVP" }}
      foot="Logistical requests are subject to availability."
      facts={<>
        <Fact label="Status"><Status tone="ok">Recorded</Status></Fact>
        <Fact label="Event"><Link href={`/events/${rsvp.eventId}`}>{rsvp.eventName}</Link></Fact>
        <Fact label="Date">{rsvp.eventDate}</Fact>
        <Fact label="Submitted">{formatSubmitted(rsvp.submittedAt)}</Fact>
        <Fact label="Name" wide>{rsvp.name}</Fact>
      </>}
    >
      <TrackRows
        title="Logistical requests"
        summary={rsvp.requests.length ? `${rsvp.requests.length} requested` : undefined}
        rows={rsvp.requests.map((request) => ({ label: request, status: "Requested", tone: "gold" as Tone }))}
        empty="No logistical requests."
      />
    </TrackCard>
  );
}

export function TrackApplication({ initialReference, initialIdentity = "", fromAcceptance = false }: { initialReference: string; initialIdentity?: string; fromAcceptance?: boolean }) {
  const [state, formAction, pending] = useActionState(trackApplication, undefined);
  const errors = state?.fieldErrors ?? {};
  const form = useRef<HTMLFormElement>(null);
  const looked = useRef(false);
  // From an acceptance email's Decline button: confirm declining once the application is found.
  const [askDecline, setAskDecline] = useState(fromAcceptance);
  const asked = useCallback(() => setAskDecline(false), []);

  // A link with both halves filled in looks itself up. The last name then leaves the address bar.
  useEffect(() => {
    if (looked.current || !initialReference || !initialIdentity) return;
    looked.current = true;
    form.current?.requestSubmit();
    window.history.replaceState(null, "", window.location.pathname);
  }, [initialReference, initialIdentity]);

  return (
    <div className="apply-body track-body">
      <div className="apply-body-head">
        <h2>Track your submission</h2>
        <ul className="track-types" aria-label="Supported submission types">
          {["Event registrations", "Collaborator RSVPs", "Commissioner applications", "Portal access requests"].map((type) => (
            <li key={type}><SquareCheck size={16} aria-hidden="true" />{type}</li>
          ))}
        </ul>
      </div>

      <hr className="track-divider" />

      <form ref={form} className="track-form" action={formAction} noValidate>
        <label className={`apply-field${errors.reference ? " has-error" : ""}`}>
          <span className="apply-field-label">Reference code</span>
          <input name="reference" required key={`reference-${state?.entered?.reference}`} defaultValue={(state?.entered?.reference ?? initialReference).toUpperCase()} onChange={(event) => { event.target.value = event.target.value.toUpperCase(); }} placeholder="7K3MX or CC-7K3M-9QXA" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} />
          {errors.reference && <span className="apply-field-error">{errors.reference}</span>}
        </label>
        <label className={`apply-field${errors.identity ? " has-error" : ""}`}>
          <span className="apply-field-label">Student number or last name</span>
          <input name="identity" required key={`identity-${state?.entered?.identity}`} defaultValue={state?.entered?.identity ?? initialIdentity.toUpperCase()} onChange={(event) => { event.target.value = event.target.value.toUpperCase(); }} placeholder="2023123456 or DELA CRUZ" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={80} />
          {errors.identity && <span className="apply-field-error">{errors.identity}</span>}
        </label>
        <button className="button-primary" type="submit" disabled={pending}>{pending ? <Busy>Looking up</Busy> : <>Track <ArrowRight size={15} /></>}</button>
      </form>

      {state?.error && !state.application && !state.accessRequest && !state.registration && !state.rsvp && <p className="apply-form-error" role="alert">{state.error}</p>}
      {state?.rsvp && <TrackedCollaborator key={`${state.rsvp.referenceCode}:${state.lookupStamp ?? ""}`} rsvp={state.rsvp} identity={state.entered?.identity ?? ""} />}
      {state?.registration && <TrackedEvent key={`${state.registration.referenceCode}:${state.lookupStamp ?? ""}`} registration={state.registration} identity={state.entered?.identity ?? ""} />}
      {state?.application && <TrackedResult key={`${state.application.referenceCode}:${state.lookupStamp ?? ""}`} application={state.application} identity={state.entered?.identity ?? ""} askDecline={askDecline} onAsked={asked} />}
      {state?.accessRequest && <TrackedAccess key={`${state.accessRequest.referenceCode}:${state.lookupStamp ?? ""}`} request={state.accessRequest} identity={state.entered?.identity ?? ""} />}

      <p className="track-help">Lost your code? Email <Link href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</Link> from your UST email.</p>
    </div>
  );
}
