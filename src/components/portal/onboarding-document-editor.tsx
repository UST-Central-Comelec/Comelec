"use client";

import { SaveIcon } from "@/components/action-icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { ViewIcon as Eye, EditIcon as Pencil, AddIcon as Plus, DeleteIcon as Trash2 } from "@/components/action-icons";
import { DeleteButton } from "./delete-button";
import { toast } from "./toast";
import { TEXT_LIMITS, type OnboardingDocument, type OnboardingText } from "@/lib/onboarding/documents";
import { changeOnboardingStep, createOnboardingDocument, updateOnboardingDocument } from "@/lib/portal/onboarding-actions";
import { editableOnboardingBody } from "@/lib/onboarding/body";
import { DocumentBodyField } from "./document-body-field";
import { InfoTip } from "./info-tip";
import { LegalText } from "./legal-text";
import { Field, useHydrated, usePortalForm } from "./portal-form";
import { SlidingFilterButtons } from "./sliding-filters";
import { ViewOnly } from "./view-only";
import "./onboarding.css";

const tabs = [{ key: "edit", label: <span className="onboarding-view-label"><Pencil size={14} aria-hidden="true" />Edit</span> }, { key: "preview", label: <span className="onboarding-view-label"><Eye size={14} aria-hidden="true" />Preview</span> }] as const;

const formatHelp = "Use the toolbar for bold, italic, lists, hyperlinks, text and highlight colors, font size, and horizontal lines. Window opens a larger editor.";

/** Edits one onboarding document; Preview shows it as Request access does. */
export function OnboardingDocumentEditor({ document, readOnly, isNew = false }: { document: OnboardingDocument; readOnly: boolean; isNew?: boolean }) {
  const router = useRouter();
  const saved: OnboardingText = { title: document.title, statement: document.statement, body: document.body };
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("edit");
  const [draft, setDraft] = useState(saved);
  const [editorVersion, setEditorVersion] = useState(0);
  const { pending, onSubmit, errors } = usePortalForm(isNew ? createOnboardingDocument : updateOnboardingDocument.bind(null, document.key));
  const hydrated = useHydrated();
  const dirty = isNew || draft.title !== saved.title || draft.statement !== saved.statement || draft.body !== saved.body;
  const change = (field: keyof OnboardingText) => (event: { target: { value: string } }) => setDraft((current) => ({ ...current, [field]: event.target.value }));

  return (
    <>
      <SlidingFilterButtons items={[...tabs]} active={tab} label="Document views" onChange={setTab} />
      <form className={`portal-card is-flush${dirty ? " is-dirty" : ""}`} onSubmit={onSubmit} noValidate>
        <ViewOnly when={readOnly}>
          <fieldset className="onboarding-editor" hidden={tab !== "edit"} disabled={pending}>
            <Field label="Title" error={errors.title}>
              <input required name="title" maxLength={TEXT_LIMITS.title} value={draft.title} onChange={change("title")} />
            </Field>
            <Field label="Agreement statement" hint="The words beside the tick box the requester ticks to agree." error={errors.statement}>
              <input required name="statement" maxLength={TEXT_LIMITS.statement} value={draft.statement} onChange={change("statement")} />
            </Field>
            <div className={`portal-field${errors.body ? " has-error" : ""}`}>
              <span className="portal-field-label">Text<InfoTip>{formatHelp}</InfoTip></span>
              <DocumentBodyField required key={editorVersion} value={editableOnboardingBody(draft.body)} onChange={body => setDraft(current => ({ ...current, body }))} readOnly={readOnly || pending} invalid={Boolean(errors.body)} label="Onboarding document editor" windowTitle="Edit onboarding document" />
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
            <div className="onboarding-editor-foot-start">
              {!isNew && (document.key === "privacy-notice" ? <span className="portal-muted onboarding-locked"><Lock size={14} aria-hidden="true" /> Step 0 is locked</span> : <DeleteButton icon={<Trash2 size={15} aria-hidden="true" />} label="Delete step" prompt="Delete this onboarding step?" action={async () => {
                try {
                  const result = await changeOnboardingStep({ operation: "delete", key: document.key });
                  if (result.error) return toast(result.error, "error");
                  router.push("/portal/legals/onboarding?notice=onboarding-step-deleted");
                } catch {
                  toast("Couldn’t delete the step. Try again.", "error");
                }
              }} />)}
              <span className="portal-settings-dirty" aria-live="polite">{dirty ? "Unsaved changes" : `Version ${document.version}`}</span>
            </div>
            <div className="portal-form-actions">
              <button type="button" className="portal-button is-ghost" disabled={pending || !dirty} onClick={() => { setDraft(saved); setEditorVersion(current => current + 1); }}>Discard</button>
              <button type="submit" className="portal-button" disabled={pending || !dirty || !hydrated}>{isNew ? <Plus size={15} aria-hidden="true" /> : <SaveIcon size={15} aria-hidden="true" />}{pending ? "Saving…" : dirty ? (isNew ? "Add step" : "Save as new version") : "Saved"}</button>
            </div>
          </footer>
        )}
      </form>
    </>
  );
}
