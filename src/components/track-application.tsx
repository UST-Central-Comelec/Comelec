"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { trackApplication, type ApplicationStatus, type TrackedApplication } from "@/lib/applications/actions";

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

const formatSubmitted = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Submitted → Pending review → Result, with the application's place on it. */
function StatusTimeline({ status }: { status: ApplicationStatus }) {
  const decided = status === "accepted" || status === "declined";
  const reached = decided ? 2 : 1;
  const stages = ["Submitted", "Pending review", decided ? statusLabels[status] : "Result"];
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
      <StatusTimeline status={application.status} />
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

export function TrackApplication({ initialReference }: { initialReference: string }) {
  const [state, formAction, pending] = useActionState(trackApplication, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <div className="apply-body track-body">
      <div className="apply-body-head">
        <h2>Track your application</h2>
        <p>Enter the reference code you got after submitting, and the surname you applied with.</p>
      </div>

      <form className="track-form" action={formAction} noValidate>
        <label className={`apply-field${errors.reference ? " has-error" : ""}`}>
          <span className="apply-field-label">Reference code</span>
          <input name="reference" defaultValue={initialReference} placeholder="CC-7K3M-9QXA" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} />
          {errors.reference && <span className="apply-field-error">{errors.reference}</span>}
        </label>
        <label className={`apply-field${errors.surname ? " has-error" : ""}`}>
          <span className="apply-field-label">Surname</span>
          <input name="surname" placeholder="DELA CRUZ" autoComplete="family-name" autoCapitalize="characters" maxLength={80} />
          {errors.surname && <span className="apply-field-error">{errors.surname}</span>}
        </label>
        <button className="button-primary" type="submit" disabled={pending}>{pending ? "Looking up…" : <>Track <ArrowRight size={15} /></>}</button>
      </form>

      {state?.error && !state.application && <p className="apply-form-error" role="alert">{state.error}</p>}
      {state?.application && <TrackedResult application={state.application} />}

      <p className="track-help">Lost your code? Email <Link href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</Link> from your UST email. Haven’t applied yet? <Link href="/apply">Apply now</Link>.</p>
    </div>
  );
}
