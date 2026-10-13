"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { requestResponseEdit } from "@/lib/events/edit-request-actions";
import { ArrowRight, Check, SquareCheck } from "lucide-react";
import { trackApplication, type ApplicationStatus, type TrackedAccessRequest, type TrackedApplication, type TrackedRegistration, type TrackedRsvp } from "@/lib/applications/actions";

const statusLabels: Record<ApplicationStatus, string> = {
  pending: "Pending review",
  reviewing: "Pending review",
  accepted: "Accepted",
  declined: "Not selected",
};

const statusNotes: Record<ApplicationStatus, string> = {
  pending: "We have your application and the commission is reviewing it. The result will show here, and we’ll reach out through your UST email.",
  reviewing: "We have your application and the commission is reviewing it. The result will show here, and we’ll reach out through your UST email.",
  accepted: "Congratulations! The commission will contact you through your UST email with your next steps.",
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

function TrackedResult({ application, identity }: { application: TrackedApplication; identity: string }) {
  return (
    <section className="track-result" aria-live="polite" aria-label="Your application">
      <header>
        <div>
          <span>Reference code</span>
          <strong>{application.referenceCode}</strong>
        </div>
        <span className={`track-status is-${application.status}`}>{statusLabels[application.status]}</span>
      </header>
      <StatusTimeline result={application.status === "accepted" || application.status === "declined" ? statusLabels[application.status] : null} />
      <p className="track-note">{statusNotes[application.status]} For your privacy, your application is deleted 60 days after you submit it.</p>
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

export function TrackApplication({ initialReference }: { initialReference: string }) {
  const [state, formAction, pending] = useActionState(trackApplication, undefined);
  const errors = state?.fieldErrors ?? {};

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

      <form className="track-form" action={formAction} noValidate>
        <label className={`apply-field${errors.reference ? " has-error" : ""}`}>
          <span className="apply-field-label">Reference code</span>
          <input name="reference" required key={`reference-${state?.entered?.reference}`} defaultValue={(state?.entered?.reference ?? initialReference).toUpperCase()} onChange={(event) => { event.target.value = event.target.value.toUpperCase(); }} placeholder="7K3MX or CC-7K3M-9QXA" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} />
          {errors.reference && <span className="apply-field-error">{errors.reference}</span>}
        </label>
        <label className={`apply-field${errors.identity ? " has-error" : ""}`}>
          <span className="apply-field-label">Student number or last name</span>
          <input name="identity" required key={`identity-${state?.entered?.identity}`} defaultValue={state?.entered?.identity} onChange={(event) => { event.target.value = event.target.value.toUpperCase(); }} placeholder="2023123456 or DELA CRUZ" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={80} />
          {errors.identity && <span className="apply-field-error">{errors.identity}</span>}
        </label>
        <button className="button-primary" type="submit" disabled={pending}>{pending ? "Looking up…" : <>Track <ArrowRight size={15} /></>}</button>
      </form>

      {state?.error && !state.application && !state.accessRequest && !state.registration && !state.rsvp && <p className="apply-form-error" role="alert">{state.error}</p>}
      {state?.rsvp && <TrackedCollaborator key={`${state.rsvp.referenceCode}:${state.lookupStamp ?? ""}`} rsvp={state.rsvp} identity={state.entered?.identity ?? ""} />}
      {state?.registration && <TrackedEvent key={`${state.registration.referenceCode}:${state.lookupStamp ?? ""}`} registration={state.registration} identity={state.entered?.identity ?? ""} />}
      {state?.application && <TrackedResult key={`${state.application.referenceCode}:${state.lookupStamp ?? ""}`} application={state.application} identity={state.entered?.identity ?? ""} />}
      {state?.accessRequest && <TrackedAccess key={`${state.accessRequest.referenceCode}:${state.lookupStamp ?? ""}`} request={state.accessRequest} identity={state.entered?.identity ?? ""} />}

      <p className="track-help">Lost your code? Email <Link href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</Link> from your UST email.</p>
    </div>
  );
}
