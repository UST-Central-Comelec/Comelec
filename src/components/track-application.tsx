"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { trackApplication, type ApplicationStatus, type TrackedAccessRequest, type TrackedApplication } from "@/lib/applications/actions";

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
  pending: "We have your request and a Central Comelec executive is reviewing it. The decision will show here, and we’ll email your UST account.",
  approved: "You can now sign in to the Commission Portal with Google, using the UST account below.",
  declined: "Your request wasn’t approved. If you think this is a mistake, contact a Central Comelec executive.",
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

function TrackedResult({ application }: { application: TrackedApplication }) {
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
        <div><dt>Division</dt><dd>{application.division}</dd></div>
        <div><dt>Position</dt><dd>{application.position}</dd></div>
        <div><dt>College or faculty</dt><dd>{application.college}</dd></div>
        <div><dt>Program</dt><dd>{application.program}</dd></div>
        <div><dt>Year level</dt><dd>{application.yearLevel}</dd></div>
        {application.interview && <div className="is-wide"><dt>Interview</dt><dd>{application.interview}</dd></div>}
      </dl>
    </section>
  );
}

function TrackedAccess({ request }: { request: TrackedAccessRequest }) {
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
        <div><dt>Position</dt><dd>{request.position}</dd></div>
        <div className="is-wide"><dt>UST email</dt><dd>{request.email}</dd></div>
        <div><dt>College or faculty</dt><dd>{request.college}</dd></div>
        <div><dt>Program</dt><dd>{request.program}</dd></div>
        <div><dt>Year level</dt><dd>{request.yearLevel}</dd></div>
      </dl>
      {request.status === "approved" && <p className="track-help"><Link href="/portal/login">Sign in to the portal</Link></p>}
    </section>
  );
}

export function TrackApplication({ initialReference }: { initialReference: string }) {
  const [state, formAction, pending] = useActionState(trackApplication, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <div className="apply-body track-body">
      <div className="apply-body-head">
        <h2>Track your application</h2>
        <p>Enter the reference code you got after submitting, and the student number you gave. This works for commissioner applications (CC-) and portal access requests (PA-).</p>
      </div>

      <form className="track-form" action={formAction} noValidate>
        <label className={`apply-field${errors.reference ? " has-error" : ""}`}>
          <span className="apply-field-label">Reference code</span>
          <input name="reference" key={`reference-${state?.entered?.reference}`} defaultValue={state?.entered?.reference ?? initialReference} placeholder="CC-7K3M-9QXA" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} />
          {errors.reference && <span className="apply-field-error">{errors.reference}</span>}
        </label>
        <label className={`apply-field${errors.studentNumber ? " has-error" : ""}`}>
          <span className="apply-field-label">Student number</span>
          <input name="studentNumber" key={`student-${state?.entered?.studentNumber}`} defaultValue={state?.entered?.studentNumber} inputMode="numeric" placeholder="2023123456" autoComplete="off" maxLength={12} />
          {errors.studentNumber && <span className="apply-field-error">{errors.studentNumber}</span>}
        </label>
        <button className="button-primary" type="submit" disabled={pending}>{pending ? "Looking up…" : <>Track <ArrowRight size={15} /></>}</button>
      </form>

      {state?.error && !state.application && !state.accessRequest && <p className="apply-form-error" role="alert">{state.error}</p>}
      {state?.application && <TrackedResult application={state.application} />}
      {state?.accessRequest && <TrackedAccess request={state.accessRequest} />}

      <p className="track-help">Lost your code? Email <Link href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</Link> from your UST email. Haven’t applied yet? <Link href="/apply">Become a Commissioner</Link>.</p>
    </div>
  );
}
