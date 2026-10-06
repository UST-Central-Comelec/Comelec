"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { archiveKinds, documentKinds, type OfficialDocument } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { DatePicker } from "./date-picker";
import { Dropdown } from "./dropdown";
import { Field, FormFooter, usePortalForm } from "./portal-form";
import { DocumentBodyField, DocumentBodyPreview } from "./document-body-field";
import { InfoTip } from "./info-tip";
import { DriveFileField } from "./drive-file-field";
import { SignatoriesField } from "./signatories-field";

type Values = Pick<OfficialDocument, "kind" | "title" | "reference" | "date" | "summary" | "body" | "signatories" | "fileUrl" | "fileName">;

export function DocumentForm({ action, initial, submitLabel, danger, canUpload, readOnly = false }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: Values; submitLabel: string; danger?: ReactNode; canUpload: boolean; readOnly?: boolean }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(false);
  const bodyErrorId = useId();

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Document type" error={errors.kind}>
          <Dropdown name="kind" defaultValue={initial.kind} options={archiveKinds.map(value => ({ value, label: documentKinds[value] }))} />
        </Field>
        <Field label="Date issued" error={errors.date}>
          <DatePicker name="date" defaultValue={initial.date} invalid={Boolean(errors.date)} required />
        </Field>
        <Field label="Title" error={errors.title} wide>
          <input name="title" defaultValue={initial.title} maxLength={200} required />
        </Field>
        <Field label="Reference number (optional)" hint="For example, Memorandum No. 2026-004." error={errors.reference} wide>
          <input name="reference" defaultValue={initial.reference} maxLength={80} />
        </Field>
        <Field label="Summary (optional)" hint="One line shown in the Archive list." error={errors.summary} wide>
          <textarea name="summary" rows={2} defaultValue={initial.summary} maxLength={600} />
        </Field>
        <div className={`portal-field is-wide${errors.body ? " has-error" : ""}`}>
          <span className="portal-field-label">Main text<InfoTip>Use the toolbar for font size, text formatting, lists, hyperlinks, alignment, indentation, font colors and tables. Click a table for its actions. Drag across cells to select them, then merge or format their contents together. Tab inserts an indent; Shift+Tab removes it. Inside a table, Tab moves between cells. Paste tables from Google Docs, Word or Sheets. Window opens a larger editor.</InfoTip></span>
          <DocumentBodyField value={body} onChange={setBody} readOnly={readOnly} invalid={Boolean(errors.body)} />
          {errors.body && <span id={bodyErrorId} className="portal-field-error">{errors.body}</span>}
        </div>
        <SignatoriesField initial={initial.signatories} error={errors.signatories} />
        <DriveFileField initialLink={initial.fileUrl} error={errors.driveLink} canUpload={canUpload} />
      </div>
      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref="/portal/documents" danger={danger} beforeActions={<button type="button" className="portal-button is-ghost" onClick={() => setPreview(true)} aria-haspopup="dialog"><Eye size={16} aria-hidden="true" /> Preview</button>} />
      {preview && <DocumentBodyPreview value={body} onClose={() => setPreview(false)} />}
    </form>
  );
}
