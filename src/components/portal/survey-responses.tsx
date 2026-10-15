"use client";
import { useId, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { SearchIcon } from "@/components/action-icons";
import type { SurveyResponse } from "@/lib/surveys/types";
import { CopyableReviewFact, ReviewModalDetailsGroup } from "./review-modal-ui";
import "./portal-table-row.css";
import "./surveys.css";

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const answerText = (response: SurveyResponse, field: SurveyResponse["definition"]["steps"][number]["fields"][number]) => {
  const value = response.answers[field.id];
  if (field.kind === "confirm") return value === "yes" ? "Confirmed" : "Not confirmed";
  return Array.isArray(value) ? value.join(", ") : value ?? "";
};

/** Everyone who answered, newest first; a row opens their answers grouped by the survey's steps. */
export function SurveyResponses({ responses }: { responses: SurveyResponse[] }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<SurveyResponse | null>(null);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const shown = responses.filter(response => terms.every(term => response.respondentEmail.toLowerCase().includes(term)));
  const review = (response: SurveyResponse) => { setOpen(response); dialog.current?.showModal(); };
  const groups = open ? open.definition.steps.map(step => ({ step, fields: step.fields.filter(field => !["content", "image"].includes(field.kind) && open.answers[field.id] !== undefined) })).filter(group => group.fields.length) : [];
  return <section className="portal-card is-flush portal-survey-responses" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="portal-visually-hidden">Survey responses</h2>
    <div className="portal-table-tools">
      <label className="portal-search"><span className="portal-visually-hidden">Search responses</span><SearchIcon size={15} aria-hidden="true" /><input className="portal-input" type="search" value={query} placeholder="Search respondent email" onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>No.</th><th>Respondent</th><th>Submitted</th><th aria-label="Review response" /></tr></thead><tbody>
      {shown.map(response => <tr key={response.id} className="portal-clickable-row is-clickable" onClick={event => { if (!(event.target as Element).closest("button")) review(response); }}>
        <td className="portal-muted is-nowrap">{responses.length - responses.indexOf(response)}</td>
        <td>{response.respondentEmail}</td>
        <td className="portal-muted is-nowrap">{formatWhen(response.createdAt)}</td>
        <td className="portal-row-actions"><button type="button" className="portal-list-review" aria-haspopup="dialog" aria-controls={`${id}-dialog`} aria-label={`Review response from ${response.respondentEmail}`} onClick={() => review(response)}><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button></td>
      </tr>)}
      {!shown.length && <tr><td colSpan={4}><p className="portal-empty" role="status">{responses.length ? "No responses match this search." : "No responses yet. Members can answer once the survey is open."}</p></td></tr>}
    </tbody></table></div>
    <div className="portal-table-foot"><p role="status">{shown.length === responses.length ? `${responses.length} ${responses.length === 1 ? "response" : "responses"}` : `Showing ${shown.length} of ${responses.length}`}</p></div>
    <dialog ref={dialog} className="portal-registrant-dialog" id={`${id}-dialog`} aria-labelledby={`${id}-name`} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} onClose={() => setOpen(null)}>
      <button type="button" className="portal-icon-button is-light portal-registrant-close" aria-label="Close response" autoFocus onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
      {open && <article className="portal-registrant-receipt">
        <header className="portal-registrant-receipt-head"><div className="portal-registrant-heading"><h2 id={`${id}-name`}>{open.respondentEmail}</h2><div className="portal-registrant-meta"><span className="portal-registrant-date">Submitted {formatWhen(open.createdAt)}</span></div></div></header>
        <div className="portal-registrant-receipt-body"><div className="portal-registrant-groups">
          {groups.length ? groups.map(({ step, fields }, index) => <ReviewModalDetailsGroup key={step.id} title={step.title} number={String(index + 1).padStart(2, "0")}>
            {fields.map(field => <CopyableReviewFact key={field.id} label={field.label}>{answerText(open, field) || "Not answered"}</CopyableReviewFact>)}
          </ReviewModalDetailsGroup>) : <p className="portal-empty">This response has no answers to show.</p>}
        </div></div>
      </article>}
    </dialog>
  </section>;
}
