"use client";

import { useState } from "react";
import { TEXT_LIMITS, type OnboardingDocument, type OnboardingText } from "@/lib/onboarding/documents";
import { updateOnboardingDocument } from "@/lib/portal/onboarding-actions";
import { editableOnboardingBody } from "@/lib/onboarding/body";
import { DocumentBodyField } from "./document-body-field";
import { InfoTip } from "./info-tip";
import { LegalText } from "./legal-text";
import { Field, useHydrated, usePortalForm } from "./portal-form";
import { SlidingFilterButtons } from "./sliding-filters";
import { ViewOnly } from "./view-only";
import "./onboarding.css";

const tabs = [{ key: "edit", label: "Edit" }, { key: "preview", label: "Preview" }] as const;

const formatHelp = "Use the toolbar for bold, italic, lists, hyperlinks, text and highlight colors, font size, and horizontal lines. Window opens a larger editor.";

/** Edits one onboarding document; Preview shows it as Request access does. */
export function OnboardingDocumentEditor({ document, readOnly }: { document: OnboardingDocument; readOnly: boolean }) {
  const saved: OnboardingText = { title: document.title, statement: document.statement, body: document.body };
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("edit");
  const [draft, setDraft] = useState(saved);
  const [editorVersion, setEditorVersion] = useState(0);
  const { pending, onSubmit, errors } = usePortalForm(updateOnboardingDocument.bind(null, document.key));
  const hydrated = useHydrated();
  const dirty = draft.title !== saved.title || draft.statement !== saved.statement || draft.body !== saved.body;
  const change = (field: keyof OnboardingText) => (event: { target: { value: string } }) => setDraft((current) => ({ ...current, [field]: event.target.value }));

  return (
    <>
      <SlidingFilterButtons items={[...tabs]} active={tab} label="Document views" onChange={setTab} />
      <form className={`portal-card is-flush${dirty ? " is-dirty" : ""}`} onSubmit={onSubmit} noValidate>
        <ViewOnly when={readOnly}>
          <fieldset className="onboarding-editor" hidden={tab !== "edit"} disabled={pending}>
            <Field label="Title" error={errors.title}>
              <input name="title" maxLength={TEXT_LIMITS.title} value={draft.title} onChange={change("title")} />
            </Field>
            <Field label="Agreement statement" hint="The words beside the tick box the requester ticks to agree." error={errors.statement}>
              <input name="statement" maxLength={TEXT_LIMITS.statement} value={draft.statement} onChange={change("statement")} />
            </Field>
            <div className={`portal-field${errors.body ? " has-error" : ""}`}>
              <span className="portal-field-label">Text<InfoTip>{formatHelp}</InfoTip></span>
              <DocumentBodyField key={editorVersion} value={editableOnboardingBody(draft.body)} onChange={body => setDraft(current => ({ ...current, body }))} readOnly={readOnly || pending} invalid={Boolean(errors.body)} label="Onboarding document editor" windowTitle="Edit onboarding document" />
              {errors.body && <span className="portal-field-error">{errors.body}</span>}
            </div>
          </fieldset>
        </ViewOnly>
        <div className="onboarding-preview" hidden={tab !== "preview"}>
          <h2>{draft.title || "Untitled"}</h2>
          <div className="onboarding-reader is-preview"><LegalText body={draft.body} /></div>
          <label className="onboarding-agree"><input type="checkbox" disabled /> <span>{draft.statement}</span></label>
        </div>
        {!readOnly && (
          <footer className="portal-settings-foot">
            <span className="portal-settings-dirty" aria-live="polite">{dirty ? "Unsaved changes" : `Version ${document.version}`}</span>
            <div className="portal-form-actions">
              <button type="button" className="portal-button is-ghost" disabled={pending || !dirty} onClick={() => { setDraft(saved); setEditorVersion(current => current + 1); }}>Discard</button>
              <button type="submit" className="portal-button" disabled={pending || !dirty || !hydrated}>{pending ? "Saving…" : dirty ? "Save as new version" : "Saved"}</button>
            </div>
          </footer>
        )}
      </form>
    </>
  );
}
