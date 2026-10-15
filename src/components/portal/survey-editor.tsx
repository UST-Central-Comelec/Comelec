"use client";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddIcon, SaveIcon } from "@/components/action-icons";
import { defaultSurveyDefinition, type Survey, type SurveyValues } from "@/lib/surveys/types";
import { saveSurvey, type SurveyResult } from "@/lib/surveys/actions";
import { Field } from "./portal-form";
import { Dropdown } from "./dropdown";
import { ViewOnly } from "./view-only";
import { EventFormEditor, FormEditorViewToggle, useFormEditorMode } from "./event-form-editor";
import { SlidingFilterButtons } from "./sliding-filters";
import { scrollToElement } from "@/lib/scroll";
import { SurveyAnswer } from "./survey-answer";
import { toast } from "./toast";
import { EditConflict, EditPresence } from "./edit-guard";
import type { EditGuardInfo } from "@/lib/portal/edit-conflict";
import "./surveys.css";

/**
 * Edits one part of a survey: its details, its questions, or both while it's being added. Each
 * part saves the whole survey, so the edit guard merges a change made on the other tab meanwhile.
 */
export function SurveyEditor({ initial, section, readOnly = false, guard }: { initial: Survey | null; section: "details" | "form" | "new"; readOnly?: boolean; guard?: EditGuardInfo }) {
  const id = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<"details" | "form">(section === "form" ? "form" : "details");
  const { mode, pickMode } = useFormEditorMode();
  const [saved, setSaved] = useState<SurveyValues>(initial ? { title: initial.title, description: initial.description, status: initial.status, definition: initial.definition } : { title: "", description: "", status: "draft", definition: defaultSurveyDefinition });
  const [draft, setDraft] = useState(saved);
  const [expected, setExpected] = useState(initial?.updatedAt ?? null);
  const [feedback, setFeedback] = useState<SurveyResult>();
  const [pending, startTransition] = useTransition();
  const dirty = !initial || JSON.stringify(draft) !== JSON.stringify(saved);
  const locked = Boolean(initial?.responseCount);
  const details = section !== "form";
  const questions = section !== "details";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || pending || !dirty) return;
    if (!draft.title.trim() && section === "new" && tab === "form") {
      setTab("details");
      requestAnimationFrame(() => formRef.current?.requestSubmit());
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveSurvey(initial?.id ?? null, draft, expected, formData);
      setFeedback(result);
      if (result.error) { toast(result.error, "error"); return; }
      setSaved(draft);
      toast(!initial ? "Survey added. Open it in Details when you’re ready to collect responses." : result.merged ? "Survey saved with the other person’s changes." : "Survey saved.");
      if (!initial) router.replace(`/portal/secretariat/surveys/${result.id}`);
      else {
        // Refresh the loaded stamp before another save; the editor remounts on the new version.
        setExpected(null);
        router.refresh();
      }
    });
  };
  const actions = (small = false) => <div className="portal-form-actions">
    {!initial && <Link className={`portal-button is-ghost${small ? " is-small" : ""}`} href="/portal/secretariat/surveys">Cancel</Link>}
    {initial && dirty && <button className={`portal-button is-ghost${small ? " is-small" : ""}`} type="button" disabled={pending} onClick={() => setDraft(saved)}>Discard</button>}
    <button className={`portal-button${small ? " is-small" : ""}`} type="submit" form={id} disabled={pending || !dirty || (Boolean(initial) && !expected)}>{initial ? <SaveIcon size={15} aria-hidden="true" /> : <AddIcon size={15} aria-hidden="true" />}{pending ? "Saving…" : !initial ? "Add survey" : dirty ? "Save survey" : "Saved"}</button>
  </div>;
  // Keep the editor's save form separate from the respondent preview's form.
  return <section ref={editorRef} className="portal-card portal-survey-editor">
    {(section === "new" || questions) && <div className="portal-event-editor-bar">
      {section === "new" && <SlidingFilterButtons active={tab} label="Survey editor tabs" items={[{ key: "details", label: "Details" }, { key: "form", label: "Survey Form" }]} onChange={next => { setTab(next); requestAnimationFrame(() => { if (editorRef.current) scrollToElement(editorRef.current); }); }} />}
      {tab === "form" && <div className="portal-event-editor-view"><FormEditorViewToggle mode={mode} onChange={pickMode} /></div>}
    </div>}
    <EditPresence guard={guard} />
    <form ref={formRef} id={id} className="portal-form" onSubmit={submit} noValidate>
      {details && <div hidden={tab !== "details"}>
        <ViewOnly when={readOnly}><fieldset className="portal-form-section portal-survey-fields" disabled={readOnly || pending}>
          <legend>The survey</legend>
          <Field label="Survey title"><input name="title" value={draft.title} required maxLength={300} onChange={event => setDraft({ ...draft, title: event.target.value })} /></Field>
          <Field label="Description" hint="Shown to members above the questions."><textarea name="description" value={draft.description} maxLength={2000} rows={4} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
          <Field label="Status" hint="Draft keeps the survey from members. Open collects responses. Closed stops new responses and keeps the ones already in."><Dropdown name="status" value={draft.status} required options={[{ value: "draft", label: "Draft" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }]} onChange={status => setDraft({ ...draft, status: status as SurveyValues["status"] })} /></Field>
        </fieldset></ViewOnly>
      </div>}
      <EditConflict guard={guard} state={feedback} />
    </form>
    {questions && <div hidden={tab !== "form"}>
      {locked && <p className="portal-survey-locked" role="status">The questions are locked because this survey has responses. Add a new survey to ask different questions.</p>}
      <EventFormEditor acknowledgementDelivery="page" title="Survey questions" value={draft.definition} defaultValue={locked ? undefined : defaultSurveyDefinition} disabled={readOnly || pending || locked} onChange={definition => setDraft({ ...draft, definition })} viewMode={mode} actions={readOnly ? undefined : actions(true)} renderPreview={definition => <SurveyAnswer key={JSON.stringify(definition)} preview id="preview" title={draft.title || "Survey"} description={draft.description} updatedAt="" definition={definition} />} />
    </div>}
    {!readOnly && tab === "details" && <footer className="portal-settings-foot"><span className="portal-settings-dirty">{initial && dirty ? "Unsaved changes" : ""}</span>{actions()}</footer>}
  </section>;
}
