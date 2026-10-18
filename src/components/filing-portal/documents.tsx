"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import { FileText, MessageSquareText, Send, Upload } from "lucide-react";
import { DownloadIcon } from "@/components/lucide-animated/download";
import { DeleteButton } from "@/components/portal/delete-button";
import { toast } from "@/components/portal/toast";
import { removeFilingFile, sendFilingDocument, sendReadyFilingDocuments, takeBackFilingDocument, type ActionResult } from "@/lib/filing-portal/document-actions";
import { documentStatusLabel, documentStatusTone, isEditable, MAX_FILES_PER_REQUIREMENT, type FilingArea, type FilingDocument } from "@/lib/filing-portal/types";
import "./documents.css";

// An application's documents, requirement by requirement: a party's (any member) or a candidacy's
// (the candidate). Each has its template if there is one, its files, where its review stands and
// what the unit wrote. Files go up to /filing/upload, the rest through Server Actions.

/** `number`: its place in the whole checklist, when only some of the requirements are shown. */
export type Requirement = { id: string; label: string; hint: string; templateHref: string | null; optional?: boolean; number?: number };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso)) : "");
const report = (result: ActionResult) => { if (result.error) toast(result.error, "error"); else if (result.ok) toast(result.ok); };

export function FilingDocuments({ area, requirements, documents, open, unit }: {
  area: FilingArea;
  requirements: Requirement[];
  documents: FilingDocument[];
  /** The application can still change: waiting for its decision (and, for a candidacy, past its party's endorsement). */
  open: boolean;
  unit: string;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const byRequirement = new Map(documents.map((item) => [item.requirement, item]));

  const upload = async (requirement: string, list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length || uploading) return;
    const packet = new FormData();
    packet.set("area", area);
    packet.set("requirement", requirement);
    for (const file of files) packet.append("files", file);
    setUploading(requirement);
    try {
      const response = await fetch("/filing/upload", { method: "POST", body: packet });
      const result = (await response.json().catch(() => ({ error: "The files couldn’t be uploaded. Try again." }))) as ActionResult;
      report(result);
      if (response.ok) router.refresh();
    } catch {
      toast("The files couldn’t be uploaded. Check your connection and try again.", "error");
    } finally {
      setUploading(null);
    }
  };

  const act = (task: () => Promise<ActionResult>) => startTransition(async () => report(await task()));

  const dropOn = (id: string, editable: boolean) => editable ? {
    onDragOver: (event: DragEvent) => { if (!event.dataTransfer.types.includes("Files")) return; event.preventDefault(); setDragging(id); },
    onDragLeave: (event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(null); },
    onDrop: (event: DragEvent) => { event.preventDefault(); setDragging(null); void upload(id, event.dataTransfer.files); },
  } : {};

  return (
    <ol className="pp-requirements">
      {requirements.map((requirement, index) => {
        const document = byRequirement.get(requirement.id);
        const status = document?.status ?? "draft";
        const files = document?.files ?? [];
        const editable = open && isEditable(status);
        const busy = uploading === requirement.id;
        return (
          <li key={requirement.id} id={`requirement-${requirement.id}`} className={`portal-card pp-requirement${dragging === requirement.id ? " is-dragging" : ""}`} {...dropOn(requirement.id, editable)}>
            <div className="pp-requirement-head">
              <span className="pp-requirement-index" aria-hidden="true">{String(requirement.number ?? index + 1).padStart(2, "0")}</span>
              <div className="pp-requirement-title">
                <h2>{requirement.label}{requirement.optional && <small> Optional</small>}</h2>
                <p>{requirement.hint}</p>
              </div>
              <span className={`portal-tag ${documentStatusTone[status]}`}>{files.length || status !== "draft" ? documentStatusLabel[status] : "Nothing uploaded"}</span>
            </div>

            {document?.feedback && (
              <div className={`pp-feedback${status === "changes" ? " is-changes" : ""}`}>
                <MessageSquareText size={16} aria-hidden="true" />
                <div>
                  <strong>{status === "changes" ? `${unit} asked for changes` : `${unit} wrote`}</strong>
                  <p>{document.feedback}</p>
                  {document.reviewedAt && <small>{when(document.reviewedAt)}</small>}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <ul className="pp-files" aria-label={`Files for ${requirement.label}`}>
                {files.map((file, fileIndex) => (
                  <li key={file.path}>
                    <FileText size={15} aria-hidden="true" />
                    <span className="pp-file-name"><a href={`/filing/files/${area}/${document!.id}/${fileIndex}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)} · {file.uploadedBy}, {when(file.uploadedAt)}</small></span>
                    {editable && <DeleteButton label="Remove" prompt="Remove this file?" confirmLabel="Yes, remove" pendingLabel="Removing…" action={async () => report(await removeFilingFile(area, requirement.id, file.path))} />}
                  </li>
                ))}
              </ul>
            )}

            <div className="pp-requirement-actions">
              {requirement.templateHref && <a className="portal-button is-ghost is-small" href={requirement.templateHref} download><DownloadIcon size={14} aria-hidden="true" />Download template</a>}
              {editable && files.length < MAX_FILES_PER_REQUIREMENT && (
                <label className={`portal-button is-ghost is-small pp-upload${busy ? " is-busy" : ""}`} aria-disabled={busy || undefined}>
                  <input className="portal-visually-hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={Boolean(uploading)} aria-label={`Upload files for ${requirement.label}`} onChange={(event) => { const chosen = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(requirement.id, chosen); }} />
                  <Upload size={14} aria-hidden="true" />{busy ? "Uploading…" : files.length ? "Add files" : "Upload files"}
                </label>
              )}
              {editable && files.length > 0 && <button type="button" className="portal-button is-ghost is-small" disabled={pending} onClick={() => act(() => sendFilingDocument(area, requirement.id))}>Send for review</button>}
              {open && status === "submitted" && <button type="button" className="portal-button is-ghost is-small" disabled={pending} onClick={() => act(() => takeBackFilingDocument(area, requirement.id))}>Take back to change</button>}
              {status === "submitted" && document?.submittedAt && <small className="pp-requirement-when">Sent {when(document.submittedAt)}</small>}
              {editable && !files.length && <small className="pp-requirement-when">PDF, JPG or PNG, up to 10 MB each. You can also drop files here.</small>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A documents page's main action: sends every document that has files and isn't sent yet. */
export function SendReadyButton({ area, count }: { area: FilingArea; count: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="portal-button" disabled={pending || count === 0} title={count === 0 ? "Upload a document’s files first" : undefined} onClick={() => startTransition(async () => report(await sendReadyFilingDocuments(area)))}>
      <Send size={15} aria-hidden="true" />
      {pending ? "Sending…" : count ? `Send ${count} ready for review` : "Nothing ready to send"}
    </button>
  );
}
