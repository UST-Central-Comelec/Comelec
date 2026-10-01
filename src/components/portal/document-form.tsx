"use client";

import type { ReactNode } from "react";
import { documentKinds, type OfficialDocument } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { Field, FormFooter, usePortalForm } from "./portal-form";
import { DocumentBodyField } from "./document-body-field";
import { DriveFileField } from "./drive-file-field";
import { SignatoriesField } from "./signatories-field";

type Values = Pick<OfficialDocument, "kind" | "title" | "reference" | "date" | "summary" | "body" | "signatories" | "fileUrl" | "fileName">;

export function DocumentForm({ action, initial, submitLabel, danger, canUpload }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: Values; submitLabel: string; danger?: ReactNode; canUpload: boolean }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Document type" error={errors.kind}>
          <select name="kind" defaultValue={initial.kind}>
            {Object.entries(documentKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Date issued" error={errors.date}>
          <input name="date" type="date" defaultValue={initial.date} required />
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
        <Field label="Main text" hint="Separate paragraphs with a blank line. To add a table, copy it from Google Docs, Word or Sheets and paste it here — not from the PDF." error={errors.body} wide>
          <DocumentBodyField defaultValue={initial.body} />
        </Field>
        <SignatoriesField initial={initial.signatories} error={errors.signatories} />
        <DriveFileField initialLink={initial.fileUrl} error={errors.driveLink} canUpload={canUpload} />
      </div>
      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref="/portal/documents" danger={danger} />
    </form>
  );
}
