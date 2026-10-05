"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { pdfForms, validatePdf, type PdfInput, type PdfSelection } from "@/lib/polpar/pdf-data";

/** Works with the current form values, or a saved submission. PDF generation stays in the browser. */
export function PdfDownloads({ getData, onValidation, portal = false }: { getData: () => PdfInput; onValidation?: (errors: Record<string, string>) => void; portal?: boolean }) {
  const [selection, setSelection] = useState<PdfSelection>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function download() {
    const data = getData();
    const parsed = validatePdf(data, selection);
    setError(""); setDone(false);
    if (!parsed.success) {
      const errors = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]));
      setError(`Complete the selected form’s fields before downloading. ${parsed.error.issues[0].message}`);
      onValidation?.(errors);
      return;
    }
    onValidation?.({});
    setBusy(true);
    try {
      const { downloadPartyPdf } = await import("@/lib/polpar/pdf");
      await downloadPartyPdf(data, selection);
      setDone(true);
    } catch (error) { setError(error instanceof Error ? error.message : "The PDF could not be generated. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className={portal ? "portal-form" : "pp-pdf-downloads"}>
    <label className={portal ? "portal-field" : "pp-field"}><span>Forms to download</span><select value={selection} onChange={(event) => { setSelection(event.target.value as PdfSelection); setDone(false); }} disabled={busy}>
      <option value="all">All forms — one PDF packet</option>{pdfForms.map((form) => <option value={form.id} key={form.id}>{form.label}</option>)}
    </select></label>
    <button type="button" className={portal ? "portal-button" : "bp-button is-primary"} disabled={busy} onClick={download}><Download size={16} aria-hidden="true" />{busy ? "Preparing your PDF…" : "Download filled PDF"}</button>
    {error && <p className={portal ? "portal-form-error" : "pp-error"} role="alert">{error}</p>}
    {done && <p className={portal ? "portal-muted" : "pp-note"} role="status">PDF ready. Review the details and sign the blank signature lines before uploading your signed copies.</p>}
  </div>;
}

export function SavedPdfDownloads({ data }: { data: PdfInput }) {
  return <PdfDownloads getData={() => ({ ...data, conformes: data.conformes ?? [] })} portal />;
}
