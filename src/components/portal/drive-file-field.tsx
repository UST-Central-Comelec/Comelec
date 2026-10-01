"use client";

import { useState, type ChangeEvent } from "react";
import { finishDocumentUpload, startDocumentUpload } from "@/lib/portal/document-upload-actions";
import { Field } from "./portal-form";

// Same limit as MAX_DOCUMENT_BYTES in src/lib/data/drive-upload.ts, which is server-only.
const MAX_BYTES = 25 * 1024 * 1024;

type Status = { kind: "idle" } | { kind: "working"; percent: number } | { kind: "done"; message: string } | { kind: "error"; message: string };

/** Sends the file straight to the Drive upload session, reporting progress. Resolves with the new file's id. */
function send(session: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", session);
    request.setRequestHeader("Content-Type", "application/pdf");
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    request.onerror = reject;
    request.onload = () => {
      try {
        const id = (JSON.parse(request.responseText) as { id?: string }).id;
        if (request.status < 300 && id) return resolve(id);
      } catch {}
      reject(new Error(`Upload failed (${request.status})`));
    };
    request.send(file);
  });
}

/**
 * The document's file: upload a PDF, which lands in the commission's Google Drive and fills in the
 * link, or paste a link to a file that's already there. Only the link is saved with the document.
 */
export function DriveFileField({ initialLink, error, canUpload }: { initialLink: string | null; error?: string; canUpload: boolean }) {
  const [link, setLink] = useState(initialLink ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reject = (message: string) => {
      event.target.value = "";
      setStatus({ kind: "error", message });
    };
    // The reported type comes from the file extension, so also check the file starts like a PDF.
    const isPdf = file.type === "application/pdf" && (await file.slice(0, 5).text()) === "%PDF-";
    if (!isPdf || file.size > MAX_BYTES) return reject(`Choose a PDF up to ${MAX_BYTES / 1024 / 1024} MB.`);

    setStatus({ kind: "working", percent: 0 });
    try {
      const started = await startDocumentUpload(file.name, file.size);
      if ("error" in started) return reject(started.error);
      const id = await send(started.session, file, (percent) => setStatus({ kind: "working", percent }));
      const finished = await finishDocumentUpload(id);
      if ("error" in finished) return reject(finished.error);
      setLink(finished.link);
      setStatus({ kind: "done", message: `Uploaded ${file.name}. Save the document to keep it.` });
    } catch {
      reject("The upload didn’t finish. Check your connection and try again.");
    }
  };

  return (
    <>
      {canUpload && (
        <Field label="Upload PDF" hint="Up to 25 MB. The file is stored in the commission’s Google Drive and shared as view-only." wide>
          <input type="file" accept="application/pdf" onChange={onChange} disabled={status.kind === "working"} />
          {status.kind === "working" && <span className="portal-field-hint" aria-live="polite">Uploading… {status.percent}%</span>}
          {status.kind === "done" && <span className="portal-file-status" aria-live="polite">{status.message}</span>}
          {status.kind === "error" && <span className="portal-field-error" aria-live="polite">{status.message}</span>}
        </Field>
      )}
      <Field
        label="Google Drive link"
        hint={canUpload ? "Filled in when you upload. Or paste a link: in Drive, Share → General access → “Anyone with the link” (Viewer), then Copy link." : "In Drive: Share → General access → “Anyone with the link” (Viewer), then Copy link."}
        error={error}
        wide
      >
        <input name="driveLink" type="url" inputMode="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://drive.google.com/file/d/…/view" />
        {link && URL.canParse(link) && (
          <a className="portal-current-file" href={link} target="_blank" rel="noreferrer">Open {link === initialLink ? "current" : "this"} link ↗</a>
        )}
      </Field>
    </>
  );
}
