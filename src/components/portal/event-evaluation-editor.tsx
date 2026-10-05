"use client";

import { useId, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, Eye, FileText, Info, LockKeyhole, MessageSquare, Plus, Save, Sparkles, Trash2, UserRound, Users } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { maxEvaluationQuestions, evaluationSections, ratingLabels, type EvaluationQuestion, type EvaluationResponse, type EvaluationSettings } from "@/lib/events/evaluation";
import { saveEvaluationForm } from "@/lib/events/evaluation-actions";
import { Field } from "./portal-form";
import "./event-workflows.css";

const sectionIcons = [UserRound, ClipboardList, MessageSquare, Sparkles];
const sectionNotes = [
  "",
  "Explore participants’ perspectives on the event.",
  "Give participants room to tell you what worked and what could be better.",
  "Capture what participants learned and what they would like to explore next.",
];
const when = (date: string) => new Date(date).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function EvaluationResponseDetails({ response, questions = [] }: { response: EvaluationResponse | null; questions?: EvaluationQuestion[] }) {
  const shownQuestions = response?.questions ?? questions;
  return (
    <div className="portal-evaluation-response">
      <div className="event-response-meta"><span><FileText size={14} aria-hidden="true" />{response ? when(response.created_at) : "Evaluation form · Not yet responded"}</span>{response?.anonymous && <span className="portal-tag"><LockKeyhole size={12} aria-hidden="true" />Anonymous</span>}</div>
      {[1, 2, 3].map(section => (
        <section key={section}>
          <h3><span>{String(section + 1).padStart(2, "0")}</span>{evaluationSections[section]}</h3>
          <dl className="event-response-answers">
            {shownQuestions.filter(q => q.section === section).map(q => {
              const answer = response?.answers[q.id];
              return <div key={q.id}><dt>{q.prompt}</dt><dd>{!response ? <em>(not yet responded)</em> : typeof answer === "number" ? <span className="event-response-rating"><span aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= answer ? "is-filled" : undefined} />)}</span><strong>{answer}/5</strong><span>{ratingLabels[answer - 1]}</span></span> : answer || <em>Not answered</em>}</dd></div>;
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function EventEvaluationEditor({ eventId, initial, editable, responses }: { eventId: string; initial: EvaluationSettings; editable: boolean; responses: EvaluationResponse[] }) {
  const [settings, setSettings] = useState(initial);
  const [view, setView] = useState<"view" | "responses">("view");
  const [section, setSection] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const contentId = useId();
  const panelId = useId();
  const SectionIcon = sectionIcons[section];
  const questions = settings.questions.filter(q => q.section === section);
  const anonymousCount = responses.filter(response => response.anonymous).length;
  const dirty = JSON.stringify(settings) !== JSON.stringify(initial);

  function updateQuestion(id: string, patch: Partial<EvaluationQuestion>) {
    setSettings(current => ({ ...current, questions: current.questions.map(q => q.id === id ? { ...q, ...patch } : q) }));
    setFeedback(null);
  }
  function addQuestion(kind: EvaluationQuestion["kind"]) {
    if (!editable || pending || section === 0 || settings.questions.length >= maxEvaluationQuestions) return;
    const question: EvaluationQuestion = { id: `q_${crypto.randomUUID()}`, section: section as 1 | 2 | 3, label: "New question", prompt: "", kind, required: section !== 2 };
    setSettings(current => ({ ...current, questions: [...current.questions, question] }));
    setFeedback(null);
  }
  function removeQuestion(id: string) {
    if (!editable || pending) return;
    setSettings(current => ({ ...current, questions: current.questions.filter(q => q.id !== id) }));
    setFeedback(null);
  }
  function save() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await saveEvaluationForm(eventId, settings);
        setFeedback({ text: result.error ?? "Evaluation form saved.", error: Boolean(result.error) });
      } catch (error) {
        unstable_rethrow(error);
        setFeedback({ text: "Couldn’t save the form. Please try again.", error: true });
      }
    });
  }

  return (
    <div className="event-evaluation-workspace">
      <div className="event-evaluation-layout">
        <div className="event-evaluation-content" id={contentId} role="region" aria-label={view === "view" ? "Evaluation form" : "Evaluation responses"}>
          {view === "view" ? (
            <section className="portal-card is-flush event-form-builder" aria-label="Evaluation form editor">
              <header className="event-builder-head"><div><h3>Evaluation Form</h3></div></header>
              <nav className="event-form-steps" aria-label="Edit evaluation steps">
                {evaluationSections.map((label, i) => {
                  const Icon = sectionIcons[i];
                  return <button type="button" key={label} aria-current={section === i ? "step" : undefined} aria-controls={panelId} onClick={() => setSection(i)}><span className="event-step-rail" /><span className="event-step-number">{String(i + 1).padStart(2, "0")}</span><span className="event-step-label"><Icon size={14} aria-hidden="true" />{label}</span></button>;
                })}
              </nav>
              <div className="event-builder-panel" id={panelId}>
                <header className="event-builder-section-head"><div><p className="portal-eyebrow">Step {section + 1} of 4</p><h3><SectionIcon size={20} aria-hidden="true" />{evaluationSections[section]}</h3>{sectionNotes[section] && <p>{sectionNotes[section]}</p>}</div>{section > 0 && <div className="event-question-tools"><span className="portal-index">{questions.length} questions</span>{editable && <button className="portal-button is-ghost" type="button" disabled={pending || settings.questions.length >= maxEvaluationQuestions} onClick={() => addQuestion(section === 1 ? "rating" : "text")}><Plus size={14} aria-hidden="true" />Add question</button>}</div>}</header>
                {section === 0 ? <div className="event-profile-preview"><div className="event-preview-label"><Eye size={14} aria-hidden="true" />Participant profile</div><div className="event-profile-fields">{["Last Name", "First Name", "Middle Name"].map(label => <div key={label}><span>{label}</span><div>{label === "Middle Name" ? "SANTOS" : label === "First Name" ? "JUAN" : "DELA CRUZ"}</div></div>)}</div></div> : <fieldset className="event-question-fields" disabled={!editable || pending}><legend className="portal-visually-hidden">Edit {evaluationSections[section]} questions</legend>{questions.map((q, i) => <article className="event-question-editor" key={q.id}><header><span className="event-question-index">{String(i + 1).padStart(2, "0")}</span><span className="event-question-kind">{q.kind === "rating" ? "Rating · 1–5" : "Written response"}</span><label className="portal-check event-question-required"><input type="checkbox" checked={q.required} disabled={q.section === 2 || (q.section === 3 && (q.id === "learning" || q.id === "future"))} onChange={e => updateQuestion(q.id, { required: e.target.checked })} /><span>Required</span></label>{editable && <button className="portal-icon-button event-question-remove" type="button" aria-label={`Remove question: ${q.label}`} title="Remove question" onClick={() => removeQuestion(q.id)}><Trash2 size={15} aria-hidden="true" /></button>}</header><div className="event-question-copy"><Field label="Label"><input value={q.label} maxLength={200} onChange={e => updateQuestion(q.id, { label: e.target.value })} /></Field><Field label="Question"><textarea placeholder="What would you like to ask participants?" value={q.prompt} maxLength={1000} rows={2} onChange={e => updateQuestion(q.id, { prompt: e.target.value })} /></Field></div>{q.kind === "rating" && <div className="event-rating-preview" aria-label="Five-point rating scale">{ratingLabels.map((label, index) => <span key={label}><b>{index + 1}</b><small>{label}</small></span>)}</div>}</article>)}{questions.length === 0 && <div className="event-question-empty"><ClipboardList size={24} aria-hidden="true" /><p>No questions in this step yet.</p><span>Add a rating or written question below.</span></div>}{editable && <div className="event-add-questions"><button className="portal-button is-ghost" type="button" disabled={settings.questions.length >= maxEvaluationQuestions} onClick={() => addQuestion("rating")}><Plus size={14} aria-hidden="true" />Add rating question</button><button className="portal-button is-ghost" type="button" disabled={settings.questions.length >= maxEvaluationQuestions} onClick={() => addQuestion("text")}><Plus size={14} aria-hidden="true" />Add written question</button><span>{settings.questions.length} / {maxEvaluationQuestions} questions</span></div>}</fieldset>}
              </div>
              <footer className="event-builder-footer"><span>{editable ? <><Info size={14} aria-hidden="true" />{dirty ? "You have unsaved changes" : "Questions are saved per event"}</> : "Read-only access"}</span><div>{section > 0 && <button className="portal-button is-ghost" type="button" onClick={() => setSection(s => s - 1)}><ArrowLeft size={14} aria-hidden="true" />Back</button>}{section < 3 && <button className="portal-button is-ghost" type="button" onClick={() => setSection(s => s + 1)}>Next step<ArrowRight size={14} aria-hidden="true" /></button>}</div></footer>
            </section>
          ) : (
            <section className="portal-card is-flush event-evaluation-inbox" aria-label="Evaluation responses"><header className="event-builder-head"><div><div><h3>Participant responses</h3><p>Feedback from this event’s evaluation form.</p></div></div><span className="portal-index">{responses.length} responses</span></header>{responses.length === 0 ? <div className="event-workflow-empty"><span><MessageSquare size={25} aria-hidden="true" /></span><h3>The conversation starts here.</h3><p>Open the form and share its link with participants.<br />Their feedback will appear here as it comes in.</p></div> : <div className="event-evaluation-submissions">{responses.map((response, i) => <details className="portal-evaluation-submission" key={response.id}><summary><span className="event-submission-icon">{response.anonymous ? <LockKeyhole size={17} aria-hidden="true" /> : <UserRound size={17} aria-hidden="true" />}</span><span><strong>{response.anonymous ? "Anonymous response" : "Registrant response"}</strong><small>{when(response.created_at)}</small></span><span className="event-submission-number">#{String(responses.length - i).padStart(2, "0")}</span><ChevronDown size={16} aria-hidden="true" /></summary><EvaluationResponseDetails response={response} /></details>)}</div>}</section>
          )}
        </div>
        <aside className="event-evaluation-sidebar" aria-label="Form settings">
          <section className="portal-card event-form-settings">
            <header className="portal-card-head"><h3 className="portal-card-title">Form settings</h3><span className={`portal-tag${initial.enabled ? " is-ok" : ""}`}>{initial.enabled ? "Open" : "Closed"}</span></header>
            <div className="event-evaluation-controls">
              <div className="portal-evaluation-toggle event-evaluation-view-toggle" role="group" aria-label="Evaluation form content">
                <button type="button" aria-pressed={view === "view"} aria-controls={contentId} onClick={() => setView("view")}>Edit Forms</button>
                <button type="button" aria-pressed={view === "responses"} aria-controls={contentId} onClick={() => setView("responses")}>Responses</button>
              </div>
              <a className="portal-button is-ghost" href={`/events/${eventId}/evaluate`} target="_blank" rel="noreferrer">View Public Form</a>
            </div>
            <fieldset disabled={!editable || pending}>
              <legend className="portal-visually-hidden">Response settings</legend>
              <label className="event-setting-switch"><span><strong>Accept responses</strong></span><input type="checkbox" role="switch" checked={settings.enabled} onChange={e => { setSettings(s => ({ ...s, enabled: e.target.checked })); setFeedback(null); }} /><i aria-hidden="true" /></label>
              <label className="event-setting-switch"><span><strong>Allow anonymous feedback</strong></span><input type="checkbox" role="switch" checked={settings.allowAnonymous} onChange={e => { setSettings(s => ({ ...s, allowAnonymous: e.target.checked })); setFeedback(null); }} /><i aria-hidden="true" /></label>
            </fieldset>
            {editable && <button className="portal-button event-save-form" type="button" disabled={pending} onClick={save}><Save size={15} aria-hidden="true" />{pending ? "Saving…" : "Save evaluation form"}</button>}
            {feedback && <p className={`event-workflow-feedback${feedback.error ? " is-error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.error ? <Info size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{feedback.text}</p>}
          </section>
          {view === "responses" && <section className="portal-card event-response-overview" aria-label="Response summary"><p className="portal-eyebrow">Responses collected</p><strong className="event-response-total">{responses.length.toLocaleString("en-PH")}</strong><dl><div><dt><Users size={13} aria-hidden="true" />Named</dt><dd>{responses.length - anonymousCount}</dd></div><div><dt><LockKeyhole size={13} aria-hidden="true" />Anonymous</dt><dd>{anonymousCount}</dd></div></dl></section>}
        </aside>
      </div>
    </div>
  );
}
