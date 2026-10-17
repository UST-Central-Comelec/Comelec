"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { requestResponseEdit } from "@/lib/events/edit-request-actions";
import { ArrowRight, Check, SquareCheck } from "lucide-react";
import { declineAcceptance, trackApplication, type ApplicationStatus, type TrackedAccessRequest, type TrackedApplication, type TrackedRegistration, type TrackedRsvp } from "@/lib/applications/actions";
import { OFFER_DAYS, REAPPLY_DAYS, formatOfferDate, reapplyFrom } from "@/lib/applications/offer";

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

function TrackedResult({ application: tracked, identity, askDecline, onAsked }: { application: TrackedApplication; identity: string; askDecline: boolean; onAsked: () => void }) {
  const [declined, declineAction, declining] = useActionState(declineAcceptance, undefined);
  const application = declined?.application ?? tracked;
  const shown = applicationStatus(application);
  const decided = application.status === "accepted" || application.status === "declined";
  return (
    <section className="track-result" aria-live="polite" aria-label="Your application">
      <header>
        <div>
          <span>Reference code</span>
          <strong>{application.referenceCode}</strong>
        </div>
        <span className={`track-status is-${shown.tone}`}>{shown.label}</span>
      </header>
      <StatusTimeline result={decided ? shown.label : null} />
      <p className="track-note">{shown.note} For your privacy, your application is deleted 60 days after you submit it.</p>
      {application.offer.state === "open" && <OfferChoice application={application} identity={identity} askDecline={askDecline} onAsked={onAsked} action={declineAction} pending={declining} error={declined?.error} />}
      {application.offer.state !== "open" && declined?.error && <p className="apply-form-error" role="alert">{declined.error}</p>}
      {application.offer.state === "joined" && <p className="track-help"><Link href="/portal/login">Sign in to the portal</Link></p>}
      <dl className="apply-result-details">
        <div><dt>Name</dt><dd>{application.name}</dd></div>
        <div><dt>Submitted</dt><dd>{formatSubmitted(application.submittedAt)}</dd></div>
        <div><dt>Serve in</dt><dd>{application.preferredBody}</dd></div>
        {application.division && <div><dt>Division</dt><dd>{application.division}</dd></div>}
        <div><dt>Position</dt><dd>{application.position}</dd></div>
        <div><dt>College or faculty</dt><dd>{application.college}</dd></div>
        <div><dt>Program</dt><dd>{application.program}</dd></div>
        <div><dt>Year level</dt><dd>{application.yearLevel}</dd></div>
        {application.interview && <div className="is-wide"><dt>Interview</dt><dd>{application.interview}</dd></div>}
      </dl>
      <ResponseEditRequest reference={application.referenceCode} identity={identity} existing={application.editRequest} />
    </section>
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
          <button type="submit" className="track-decline-confirm" disabled={pending}>{pending ? "Declining…" : "Decline offer"}</button>
        </form>
      </dialog>
    </section>
  );
}

function TrackedAccess({ request, identity }: { request: TrackedAccessRequest; identity: string }) {
  return (
    <section className="track-result" aria-live="polite" aria-label="Your portal access request">
      <header>
        <div>
          <span>Reference code</span>
          <strong>{request.referenceCode}</strong>
        </div>
        <span className={`track-status is-${request.status === "approved" ? "accepted" : request.status}`}>{accessLabels[request.status]}</span>
      </header>
      <StatusTimeline result={request.status === "pending" ? null : accessLabels[request.status]} />
      <p className="track-note">{accessNotes[request.status]} For your privacy, your request is deleted 60 days after you send it.</p>
      <dl className="apply-result-details">
        <div><dt>Name</dt><dd>{request.name}</dd></div>
        <div><dt>Submitted</dt><dd>{formatSubmitted(request.submittedAt)}</dd></div>
        <div><dt>Request</dt><dd>Commission Portal access</dd></div>
        <div><dt>Role</dt><dd>{request.role}</dd></div>
        <div className="is-wide"><dt>UST email</dt><dd>{request.email}</dd></div>
        <div><dt>College or faculty</dt><dd>{request.college}</dd></div>
        <div><dt>Program</dt><dd>{request.program}</dd></div>
        <div><dt>Year level</dt><dd>{request.yearLevel}</dd></div>
      </dl>
      <ResponseEditRequest reference={request.referenceCode} identity={identity} existing={request.editRequest} />
      {request.status === "approved" && <p className="track-help"><Link href="/portal/login">Sign in to the portal</Link></p>}
    </section>
  );
}

function TrackedEvent({ registration, identity }: { registration: TrackedRegistration; identity: string }) {
  return (
    <section className="track-result" aria-live="polite" aria-label="Your event registration">
      <header>
        <div><span>Registration reference</span><strong>{registration.referenceCode}</strong></div>
        <span className={`track-status is-${registration.status === "registered" ? "accepted" : "pending"}`}>{registration.status === "registered" ? "Registered" : "Waitlisted"}</span>
      </header>
      <dl className="apply-result-details">
        <div><dt>Participant</dt><dd>{registration.name}</dd></div>
        <div><dt>Submitted</dt><dd>{formatSubmitted(registration.submittedAt)}</dd></div>
        <div><dt>Event</dt><dd><Link href={`/events/${registration.eventId}`}>{registration.eventName}</Link></dd></div>
        <div><dt>Date</dt><dd>{registration.eventDate}</dd></div>
      </dl>
      <ResponseEditRequest reference={registration.referenceCode} identity={identity} existing={registration.editRequest} />
      <h3>Logistics requests</h3>
      <dl className="apply-result-details">
        {registration.requests.map((request) => <div key={request.label}><dt>{request.label}</dt><dd>{request.status}</dd></div>)}
      </dl>
    </section>
  );
}

function TrackedCollaborator({ rsvp, identity }: { rsvp: TrackedRsvp; identity: string }) {
  return <section className="track-result" aria-live="polite" aria-label="Your collaborator RSVP">
    <header><div><span>RSVP reference</span><strong>{rsvp.referenceCode}</strong></div><span className="track-status is-accepted">Recorded</span></header>
    <p className="track-note">Your collaborator RSVP has been recorded. To ask for a change to your response, choose Request edit. Logistical requests are subject to availability.</p>
    <dl className="apply-result-details">
      <div><dt>Name</dt><dd>{rsvp.name}</dd></div>
      <div><dt>Submitted</dt><dd>{formatSubmitted(rsvp.submittedAt)}</dd></div>
      <div><dt>Event</dt><dd><Link href={`/events/${rsvp.eventId}`}>{rsvp.eventName}</Link></dd></div>
      <div><dt>Date</dt><dd>{rsvp.eventDate}</dd></div>
    </dl>
    <ResponseEditRequest reference={rsvp.referenceCode} identity={identity} existing={rsvp.editRequest} />
    <h3>Logistical requests</h3>
    {rsvp.requests.length ? <ul>{rsvp.requests.map(request => <li key={request}>{request}</li>)}</ul> : <p>No logistical requests.</p>}
  </section>;
}

function ResponseEditRequest({ reference, identity, existing }: { reference: string; identity: string; existing?: { requested_changes: string } | null }) {
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState("");
  const [state, action, pending] = useActionState(requestResponseEdit, {});
  const id = useId();
  const request = state.request ?? existing;
  if (request) return <section className="track-edit-request" aria-label="Your edit request" role="status">
    <h3>Edit requested</h3>
    <p className="track-note">Your edit request has been sent. The team handling your submission will review the changes below.</p>
    <p className="track-edit-changes">{request.requested_changes}</p>
  </section>;
  return <section className="track-edit-request" aria-label="Request changes to your response">
    {!open ? <button type="button" className="button-primary" onClick={() => setOpen(true)}>Request edit</button> : <form action={action}>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="identity" value={identity} />
      <label className="apply-field" htmlFor={id}><span className="apply-field-label">What would you like to change?</span>
        <textarea id={id} name="changes" value={changes} onChange={event => setChanges(event.target.value)} rows={4} required maxLength={4000} disabled={pending} aria-invalid={!!state.fieldErrors?.changes} aria-describedby={state.fieldErrors?.changes ? `${id}-error` : undefined} placeholder="Describe the answer to change and the correct information." />
        {state.fieldErrors?.changes && <span className="apply-field-error" id={`${id}-error`}>{state.fieldErrors.changes}</span>}
      </label>
      {state.error && <p className="apply-form-error" role="alert">{state.error}</p>}
      <div className="track-edit-actions"><button type="button" className="track-edit-cancel" disabled={pending} onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="button-primary" disabled={pending}>{pending ? "Sending…" : "Send edit request"}</button></div>
    </form>}
  </section>;
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
        <button className="button-primary" type="submit" disabled={pending}>{pending ? "Looking up…" : <>Track <ArrowRight size={15} /></>}</button>
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
