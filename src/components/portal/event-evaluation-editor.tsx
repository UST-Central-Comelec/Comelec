"use client";
import type { ReactNode } from "react";
import { FileText, LockKeyhole } from "lucide-react";
import { defaultEvaluation, evaluationDefinition, evaluationFromDefinition, evaluationSections, ratingLabels, type EvaluationQuestion, type EvaluationResponse, type EvaluationSettings } from "@/lib/events/evaluation";
import { EventFormEditor } from "./event-form-editor";
import "./event-workflows.css";
const when = (date: string) => new Date(date).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function EvaluationResponseDetails({ response, questions = [] }: { response: EvaluationResponse | null; questions?: EvaluationQuestion[] }) {
  const shownQuestions = response?.questions ?? questions;
  return (
    <div className="portal-evaluation-response">
      <div className="event-response-meta"><span><FileText size={14} aria-hidden="true" />{response ? when(response.created_at) : "Evaluation form · Not yet responded"}</span>{response?.anonymous && <span className="portal-tag"><LockKeyhole size={12} aria-hidden="true" />Anonymous</span>}</div>
      {[...new Set(shownQuestions.map(question => question.section))].sort((a, b) => a - b).map(section => (
        <section key={section}>
          <h3><span>{String(section + 1).padStart(2, "0")}</span>{response?.steps?.[section]?.title ?? evaluationSections[section] ?? `Section ${section + 1}`}</h3>
          <dl className="event-response-answers">
            {shownQuestions.filter(q => q.section === section && q.kind !== "content" && q.kind !== "image").map(q => {
              const answer = response?.answers[q.id];
              return <div key={q.id}><dt>{q.prompt}</dt><dd>{!response ? <em>(not yet responded)</em> : q.kind === "confirm" ? (answer === "yes" ? "Confirmed" : <em>Not confirmed</em>) : typeof answer === "number" ? <span className="event-response-rating"><span aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= answer ? "is-filled" : undefined} />)}</span><strong>{answer}/5</strong><span>{ratingLabels[answer - 1]}</span></span> : (Array.isArray(answer) ? answer.join(", ") : answer) || <em>Not answered</em>}</dd></div>;
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function EventEvaluationEditor({ initial, editable, onChange, actions, headerActions, resetDisabled }: { initial: EvaluationSettings; editable: boolean; responses?: EvaluationResponse[]; embedded?: boolean; onChange?: (settings: EvaluationSettings) => void; actions?: ReactNode; headerActions?: ReactNode; resetDisabled?: boolean }) {
  return <EventFormEditor
    actions={actions}
    headerActions={headerActions}
    resetDisabled={resetDisabled}
    title="Evaluation Form"
    value={evaluationDefinition(initial)}
    defaultValue={evaluationDefinition(defaultEvaluation)}
    disabled={!editable || !onChange}
    onChange={definition => onChange?.(evaluationFromDefinition(definition, initial))}
  />;
}
