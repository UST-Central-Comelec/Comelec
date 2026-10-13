"use client";
import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyIcon, SaveIcon, ViewIcon } from "@/components/action-icons";
import { defaultSurveyDefinition, surveyNumber, type Survey, type SurveyResponse, type SurveyValues } from "@/lib/surveys/types";
import { saveSurvey, type SurveyResult } from "@/lib/surveys/actions";
import { Field } from "./portal-form";
import { Dropdown } from "./dropdown";
import { TitleWithInfo } from "./info-tip";
import { ViewOnly, ViewOnlyTag } from "./view-only";
import { EventFormEditor } from "./event-form-editor";
import { SlidingFilterButtons } from "./sliding-filters";
import { SurveyAnswer } from "./survey-answer";
import { toast } from "./toast";
import { EditConflict, EditPresence } from "./edit-guard";
import type { EditGuardInfo } from "@/lib/portal/edit-conflict";
import "./surveys.css";

export function SurveyWorkspace({ initial, readOnly, responses = [], guard }: { initial: Survey | null; readOnly: boolean; responses?: SurveyResponse[]; guard?: EditGuardInfo }) {
  const id = useId();
  const router = useRouter();
  const [saved, setSaved] = useState<SurveyValues>(initial ?? { title: "", description: "", status: "draft", definition: defaultSurveyDefinition });
  const [draft, setDraft] = useState(saved);
  const [expected, setExpected] = useState(initial?.updatedAt ?? null);
  const [feedback, setFeedback] = useState<SurveyResult>();
  const [tab, setTab] = useState("form");
  const [pending, startTransition] = useTransition();
  const dirty = !initial || JSON.stringify(draft) !== JSON.stringify(saved);
  return <main className="portal-page is-wide">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Secretariat{initial ? ` · ${surveyNumber(initial)}` : ""}</p><TitleWithInfo info="Save a draft while building the questions, then choose Open to collect responses from portal members. Each member answers once. Questions are locked after the first response so all answers remain comparable.">{initial ? initial.title : "Add survey"}</TitleWithInfo></div><div className="portal-form-actions">{readOnly && <ViewOnlyTag />}{initial?.status === "open" && <><button type="button" className="portal-button is-ghost" onClick={async () => {
      try { await navigator.clipboard.writeText(`${window.location.origin}/portal/secretariat/surveys/${initial.id}/answer`); toast("Survey link copied."); }
      catch { toast("Couldn’t copy the link. Try again.", "error"); }
    }}><CopyIcon size={15} aria-hidden="true" />Copy survey link</button><Link className="portal-button is-ghost" href={`/portal/secretariat/surveys/${initial.id}/answer`}><ViewIcon size={15} aria-hidden="true" />Answer survey</Link></>}</div></header>
    <SlidingFilterButtons active={tab} label="Survey view" onChange={setTab} items={[{ key: "form", label: "Survey form" }, ...(initial ? [{ key: "responses", label: `Responses (${responses.length})` }] : [])]} />
    {tab === "responses" ? <section className="portal-card portal-survey-responses">{!responses.length ? <p className="portal-empty">No responses yet.</p> : responses.map(response => <details key={response.id}><summary>{response.respondentEmail} · {new Date(response.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</summary><dl>{response.definition.steps.flatMap(step => step.fields).filter(field => !["content", "image"].includes(field.kind) && response.answers[field.id] !== undefined).map(field => <div key={field.id}><dt>{field.label}</dt><dd>{field.kind === "confirm" ? response.answers[field.id] === "yes" ? "Confirmed" : "Not confirmed" : Array.isArray(response.answers[field.id]) ? (response.answers[field.id] as string[]).join(", ") : response.answers[field.id]}</dd></div>)}</dl></details>)}</section> : <div className="portal-survey-details">
      <section className="portal-card"><ViewOnly when={readOnly}><form id={id} onSubmit={event => {
        event.preventDefault();
        if (readOnly || pending || !dirty) return;
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveSurvey(initial?.id ?? null, draft, expected, formData);
          setFeedback(result);
          if (result.error) { toast(result.error, "error"); return; }
          setSaved(draft);
          toast(result.merged ? "Survey saved with the other person’s changes." : "Survey saved.");
          if (!initial) router.replace(`/portal/secretariat/surveys/${result.id}`);
          else {
            // Refresh the loaded stamp before another save; the editor remounts on the new version.
            setExpected(null);
            router.refresh();
          }
        });
      }}><EditPresence guard={guard} /><fieldset className="portal-survey-fields" disabled={readOnly || pending}>
        <Field label="Survey title"><input name="title" value={draft.title} required maxLength={300} onChange={event => setDraft({ ...draft, title: event.target.value })} /></Field>
        <Field label="Description"><textarea name="description" value={draft.description} maxLength={2000} rows={3} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
        <Field label="Status"><Dropdown name="status" value={draft.status} required options={[{ value: "draft", label: "Draft" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }]} onChange={status => setDraft({ ...draft, status: status as SurveyValues["status"] })} /></Field>
      </fieldset><EditConflict guard={guard} state={feedback} /></form></ViewOnly></section>
      <section className="portal-card"><EventFormEditor acknowledgementDelivery="page" title="Survey questions" value={draft.definition} defaultValue={initial?.responseCount ? undefined : defaultSurveyDefinition} disabled={readOnly || pending || Boolean(initial?.responseCount)} onChange={definition => setDraft({ ...draft, definition })} renderPreview={definition => <SurveyAnswer key={JSON.stringify(definition)} preview id="preview" title={draft.title || "Survey"} updatedAt="" definition={definition} />} /></section>
      {!readOnly && <footer className="portal-settings-foot"><span className="portal-settings-dirty">{dirty ? "Unsaved changes" : ""}</span><div className="portal-form-actions">{dirty && <button className="portal-button is-ghost" type="button" disabled={pending} onClick={() => setDraft(saved)}>Discard</button>}<button className="portal-button" type="submit" form={id} disabled={pending || !dirty || (Boolean(initial) && !expected)}><SaveIcon size={15} aria-hidden="true" />{pending ? "Saving…" : dirty ? "Save survey" : "Saved"}</button></div></footer>}
    </div>}
  </main>;
}
