"use client";

import type { ReactNode } from "react";
import { EditIcon } from "@/components/action-icons";

// The pieces the Apply family's step-by-step forms share: Become a Commissioner (application-form.tsx)
// and Political Party Registration (polpar/registration-form.tsx). Styles: globals.css, "Commissioner
// application form", and application-form-ui.css.

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** Red dot after a label: the answer is required. */
export function Required() {
  return <span className="apply-required" aria-hidden="true" />;
}

export type FieldSpan = 2 | 3 | 4 | 5 | 6 | 8 | 12;

/**
 * A labelled field on the form's 12-column grid, with its error (or hint) underneath. A picker that
 * isn't a plain input (Combobox, DatePicker) passes `labelId`: the field is then a div, and the picker
 * names itself from the label with that id.
 */
export function Field({ label, hint, error, children, span = 4, optional, labelId }: { label: string; hint?: string; error?: string; children: ReactNode; span?: FieldSpan; optional?: boolean; labelId?: string }) {
  const Wrapper = labelId ? "div" : "label";
  return (
    <Wrapper className={`apply-field span-${span}${error ? " has-error" : ""}`}>
      <span className="apply-field-label" id={labelId}>{label}{optional ? <em> Optional</em> : <Required />}</span>
      {children}
      {error ? <span className="apply-field-error">{error}</span> : hint ? <span className="apply-field-hint">{hint}</span> : null}
    </Wrapper>
  );
}

/** One block of the Review step: its answers, with a link back to the step that holds them. */
export function ReviewSection({ title, onEdit, rows }: { title: string; onEdit?: () => void; rows: Array<[string, string]> }) {
  return (
    <section className="apply-review-section">
      <header><h3>{title}</h3>{onEdit && <button type="button" onClick={onEdit}><EditIcon size={15} aria-hidden="true" />Edit</button>}</header>
      <dl>
        {rows.map(([label, value], index) => <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value || <span className="is-empty">Not provided</span>}</dd></div>)}
      </dl>
    </section>
  );
}

/**
 * The progress tracker across the top of the form: a rail per step, the last being the receipt.
 * A step counts as done once it's been passed with every answer on it valid (`complete`); steps
 * already reached can be opened again, until the form is sent.
 */
export function ApplyTracker({ titles, current, step, reached, submitted, complete, busy, onGo, label = "Application progress" }: {
  /** Every step's name, the receipt last. */
  titles: string[];
  /** The step on screen: the receipt once sent. */
  current: number;
  step: number;
  reached: number;
  submitted: boolean;
  complete: boolean[];
  /** Sending, or moving between steps: no step can be opened. */
  busy: boolean;
  onGo: (index: number) => void;
  label?: string;
}) {
  const receiptStep = titles.length - 1;
  const progress = Math.round(((current + 1) / titles.length) * 100);
  return (
    <div className="apply-tracker">
      <div className="apply-tracker-inner">
        <nav aria-label={label}>
          <ol className="apply-steps">
            {titles.map((title, index) => {
              const status = index === current ? "is-current" : submitted || ((index < reached || index < step) && complete[index]) ? "is-done" : "is-upcoming";
              // Once submitted there's nothing to go back to; the receipt is never a link.
              const reachable = !submitted && index < receiptStep && index <= reached && index !== step && !busy;
              return (
                <li key={title} className={status}>
                  <button type="button" disabled={!reachable} onClick={() => onGo(index)} aria-current={index === current ? "step" : undefined}>
                    <span className="apply-step-rail" aria-hidden="true" />
                    <span className="apply-step-label">
                      <span className="apply-step-index"><span className="visually-hidden">Step </span>{twoDigits(index + 1)}</span>
                      <span className="apply-step-text">{title}{status === "is-done" && <span className="visually-hidden"> (done)</span>}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        {/* Phones and tablets hide the step names, so the current one is spelled out here. */}
        <div className="apply-tracker-readout" aria-hidden="true">
          <span><strong>{twoDigits(current + 1)}</strong> / {twoDigits(titles.length)}</span>
          <span className="apply-tracker-readout-title" key={current}>{titles[current]}</span>
          <span className="apply-tracker-readout-percent">{progress}%</span>
        </div>
      </div>
      <div className="apply-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Progress">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/** Solid green shield with a white check. */
function ShieldMark() {
  return (
    <svg className="verified-shield" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Marks something verified with the applicant's UST Google account. With `tooltip`, hovering or
 * focusing it explains what it means.
 */
export function VerifiedBadge({ tooltip }: { tooltip?: string }) {
  if (!tooltip) return <span className="verified-badge"><ShieldMark /></span>;
  return (
    <span className="verified-badge has-tooltip" tabIndex={0} role="img" aria-label={tooltip}>
      <ShieldMark />
      <span className="verified-tooltip" role="tooltip">{tooltip}</span>
    </span>
  );
}

