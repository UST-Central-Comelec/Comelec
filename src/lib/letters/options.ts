import { z } from "zod";
import { normalizeDestinationOffice } from "./offices";
import { cleanText, numberMode, type SecretariatSettings, type TrackerKind } from "./settings";

export type WorkingDocumentKind = "docs" | "sheets" | "drive" | "pdf";

/** Recognize supported links by HTTPS host and path; never fetch the submitted URL. */
export function workingDocumentKind(value: string): WorkingDocumentKind | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname === "docs.google.com") {
      if (/^\/document\/(?:u\/\d+\/)?d\/[\w-]+(?:\/|$)/.test(url.pathname)) return "docs";
      if (/^\/spreadsheets\/(?:u\/\d+\/)?d\/[\w-]+(?:\/|$)/.test(url.pathname)) return "sheets";
      return null;
    }
    if (url.hostname === "drive.google.com") {
      if (/^\/file\/(?:u\/\d+\/)?d\/[\w-]+(?:\/|$)/.test(url.pathname)
        || /^\/drive\/(?:u\/\d+\/)?folders\/[\w-]+(?:\/|$)/.test(url.pathname)
        || (/^\/(?:open|uc|thumbnail)\/?$/.test(url.pathname) && /^[\w-]+$/.test(url.searchParams.get("id") ?? ""))) return "drive";
      return null;
    }
    return /\.pdf$/i.test(url.pathname) ? "pdf" : null;
  } catch { return null; }
}

export const isGoogleDocument = (value: string) => workingDocumentKind(value) === "docs";
export function isHttpsDocumentLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function isWorkingDocumentLink(document: { type: WorkingDocumentKind; url: string }): boolean {
  return isHttpsDocumentLink(document.url) && (document.type === "pdf" || workingDocumentKind(document.url) === document.type);
}

export const workingDocumentError = "Enter a valid HTTPS link.";
export const documentTypeLabels = { docs: "Google Docs", sheets: "Google Sheets", drive: "Google Drive", pdf: "Others" } as const;
export const workingDocumentSchema = z.object({
  type: z.enum(["docs", "sheets", "drive", "pdf"]),
  url: z.string().trim().min(1, "Enter a document link.").max(2000).refine(isHttpsDocumentLink, workingDocumentError),
}).superRefine((document, context) => {
  if (document.type === "pdf" || !isHttpsDocumentLink(document.url)) return;
  const detected = workingDocumentKind(document.url);
  if (detected !== document.type) context.addIssue({ code: "custom", path: [detected ? "type" : "url"], message: detected ? "Choose the document type that matches this link." : `Enter a ${documentTypeLabels[document.type]} link, or select Others for another HTTPS link.` });
});
export type WorkingDocument = z.infer<typeof workingDocumentSchema>;

/** Validates a record against the saved settings: only their types, statuses, labels and presets. */
export function recordSchema(settings: SecretariatSettings, kind: TrackerKind) {
  const tracker = settings[kind];
  const names = (items: Array<{ name: string }>) => items.map(item => item.name);
  return z.object({
    title: z.string().trim().min(1, "Enter a title.").max(300),
    label: z.string().nullable().default(null).refine(value => value === null || names(settings.labels).includes(value), "Choose a label from the list."),
    type: z.string().refine(value => names(tracker.types).includes(value), "Choose a type from the list."),
    status: z.string().refine(value => names(settings.statuses).includes(value), "Choose a status from the list."),
    controlNumber: z.string().default("").transform(cleanText).pipe(z.string().max(100, "Keep the control number within 100 characters.")),
    // Any office may be typed, not only the suggestions. Older names still map to their current ones.
    destinationOffice: z.string().transform(value => normalizeDestinationOffice(cleanText(value))).pipe(z.string().min(1, "Enter a destination office.").max(300, "Keep the destination office within 300 characters.")),
    workingDocuments: z.array(workingDocumentSchema).max(100, "Add up to 100 document links."),
    notifyStatusUpdates: z.boolean().default(false),
    remarkPresets: z.array(z.string()).max(30).default([]).transform(values => [...new Set(values)]).refine(values => values.every(value => names(settings.remarkPresets).includes(value)), "Choose remarks from the list."),
    remarks: z.string().trim().max(10000, "Keep remarks within 10,000 characters.").default(""),
  }).superRefine((record, context) => {
    const type = tracker.types.find(item => item.name === record.type);
    if (type && numberMode(tracker, type) === "manual" && !record.controlNumber) context.addIssue({ code: "custom", path: ["controlNumber"], message: "Enter a control number." });
  });
}

export type LetterValues = z.infer<ReturnType<typeof recordSchema>>;
export type EventPaperContext = { controlNumber?: string; id: string; name: string; organizer: "central" | "local"; college: string | null; editable?: boolean };
export type Letter = LetterValues & { event?: EventPaperContext; id: string; controlFormat: string | null; college: string | null; preparedBy: string; preparedByEmail: string; createdAt: string; updatedAt: string };
/** Someone else saved the record after this person opened it: theirs as it is now, and who saved it. */
export type LetterConflict = { letter: Letter; by: string };
export type LetterSaveResult = { letter: Letter; error?: never; fieldErrors?: never; conflict?: never } | { letter?: never; error: string; fieldErrors?: Record<string, string>; conflict?: LetterConflict };
