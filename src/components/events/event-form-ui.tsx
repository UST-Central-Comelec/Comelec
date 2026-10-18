import { FileLock2 } from "lucide-react";
import { PrivacyStatement, PRIVACY_UPDATED } from "@/components/privacy-statement";
import "../application-form-ui.css";
import "./event-form.css";

const twoDigits = (value: number) => String(value).padStart(2, "0");
const privacyUpdated = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "long" }).format(new Date(`${PRIVACY_UPDATED}T00:00:00+08:00`));

/** The commissioner application's tracker, shared by the editable event forms. */
export function EventFormTracker({ steps, current, acknowledgement, label, preview, busy, onStep, onAcknowledgement }: {
  steps: Array<{ id: string; title: string }>; current: number; acknowledgement: string; label: string;
  preview: boolean; busy: boolean; onStep: (index: number) => void; onAcknowledgement: () => void;
}) {
  const total = steps.length + 1;
  const progress = Math.round(((current + 1) / total) * 100);
  return <div className="apply-tracker"><div className="apply-tracker-inner">
    <ol className="apply-steps" aria-label={label}>
      {steps.map((step, index) => <li key={step.id} className={index === current ? "is-current" : index < current ? "is-done" : "is-upcoming"}>
        <button type="button" disabled={busy || (!preview && index > current)} onClick={() => onStep(index)} aria-current={index === current ? "step" : undefined}>
          <span className="apply-step-rail" aria-hidden="true" />
          <span className="apply-step-label"><span className="apply-step-index"><span className="ev-sr-only">Step </span>{twoDigits(index + 1)}</span><span className="apply-step-text">{step.title}{index < current && <span className="ev-sr-only"> (done)</span>}</span></span>
        </button>
      </li>)}
      <li className={current === steps.length ? "is-current" : "is-upcoming"}><button type="button" disabled={!preview || busy} onClick={onAcknowledgement} aria-current={current === steps.length ? "step" : undefined}>
        <span className="apply-step-rail" aria-hidden="true" />
        <span className="apply-step-label"><span className="apply-step-index"><span className="ev-sr-only">Step </span>{twoDigits(total)}</span><span className="apply-step-text">{acknowledgement}</span></span>
      </button></li>
    </ol>
    <div className="apply-tracker-readout" aria-hidden="true"><span><strong>{twoDigits(current + 1)}</strong> / {twoDigits(total)}</span><span className="apply-tracker-readout-title" key={steps[current]?.id ?? "acknowledgement"}>{steps[current]?.title ?? acknowledgement}</span><span className="apply-tracker-readout-percent">{progress}%</span></div>
  </div><div className="apply-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={label} /></div>;
}

export function EventConsentStatement({ id }: { id: string }) {
  return <section className="ev-consent-statement" aria-labelledby={`${id}-title`}>
    <header className="apply-privacy-head"><span className="apply-privacy-document" aria-hidden="true"><FileLock2 size={22} strokeWidth={1.75} /></span><div className="apply-privacy-heading">
      <h3 id={`${id}-title`}>Data Privacy Statement</h3>
      <div className="apply-privacy-meta">
        <span className="apply-privacy-law">Data Privacy Act of 2012 · Republic Act No. 10173</span>
        <span className="apply-privacy-updated">Updated <time dateTime={PRIVACY_UPDATED}>{privacyUpdated}</time></span>
      </div>
    </div></header>
    <div className="ev-consent-body">
      <PrivacyStatement eventForm idPrefix={id} />
    </div>
  </section>;
}
