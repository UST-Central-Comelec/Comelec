// The filing portal (/filing): one account per student, signed in with their UST Google account,
// holding their political party's registration and their own candidacy, each its own application.
// Free of server-only imports: client parts read these too.

export type PublicAccount = {
  id: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  studentNumber: string;
  mobileNumber: string;
  facebookUrl: string;
  college: string;
  program: string;
  yearLevel: string;
  noticesReadAt: string | null;
  /** Set by the commission: the account can't sign in until it's restored. */
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string;
  /** Sessions started before this have ended. */
  sessionsRevokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What the sign-up forms show of an account that already exists, in place of asking again. */
export type ProfileSummary = Pick<PublicAccount, "email" | "lastName" | "firstName" | "middleName" | "studentNumber" | "mobileNumber" | "facebookUrl" | "college" | "program" | "yearLevel">;

/** A document's review, for a party's requirement or a candidacy's: the same in both. */
export type DocumentStatus = "draft" | "submitted" | "approved" | "changes";
export type FilingFile = { name: string; path: string; size: number; type: string; uploadedBy: string; uploadedAt: string };
export type FilingDocument = {
  id: string;
  requirement: string;
  files: FilingFile[];
  status: DocumentStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  feedback: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

/** Which application a document belongs to. */
export type FilingArea = "party" | "candidacy";

export type Notice = { id: string; kind: string; title: string; body: string; href: string | null; actor: string; createdAt: string };

export const documentStatusLabel: Record<DocumentStatus, string> = { draft: "Not sent", submitted: "Waiting for review", approved: "Approved", changes: "Changes asked" };
export const documentStatusTone: Record<DocumentStatus, string> = { draft: "", submitted: "is-gold", approved: "is-ok", changes: "is-warn" };
/** A document's files can change while it's being put together, or after feedback asks for changes. */
export const isEditable = (status: DocumentStatus) => status === "draft" || status === "changes";

/** Where an application's documents stand, against its requirements (the optional ones don't hold up a decision). */
export type DocumentProgress = { total: number; required: number; approved: number; requiredApproved: number; waiting: number; changes: number; drafts: number; missing: string[] };

export function documentProgress(requirements: ReadonlyArray<{ id: string; label: string; optional?: boolean }>, documents: ReadonlyArray<{ requirement: string; status: DocumentStatus }>): DocumentProgress {
  const status = new Map(documents.map((item) => [item.requirement, item.status]));
  const count = (wanted: DocumentStatus) => requirements.filter((item) => status.get(item.id) === wanted).length;
  const required = requirements.filter((item) => !item.optional);
  return {
    total: requirements.length,
    required: required.length,
    approved: count("approved"),
    requiredApproved: required.filter((item) => status.get(item.id) === "approved").length,
    waiting: count("submitted"),
    changes: count("changes"),
    drafts: requirements.length - count("approved") - count("submitted") - count("changes"),
    missing: required.filter((item) => status.get(item.id) !== "approved").map((item) => item.label),
  };
}

/** What's still to approve, in a line: the documents by name when there are a few, otherwise how many. */
export const stillToApprove = (progress: DocumentProgress) =>
  progress.missing.length <= 3 ? `Still to approve: ${progress.missing.join("; ")}.`
    : progress.missing.length === progress.required ? `None of the ${progress.required} required documents is approved yet.`
      : `${progress.missing.length} of the ${progress.required} required documents are still to approve.`;

/** Every required document approved, and nothing left waiting for review: the application can be decided in its favour. */
export const isReadyToDecide = (progress: DocumentProgress) => progress.requiredApproved === progress.required && progress.waiting === 0;

/** "JUAN SANTOS DELA CRUZ": first, middle, last, as names are kept. */
export const fullName = (person: { firstName: string; middleName: string; lastName: string }) => [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");

/** Limits on files: each, per requirement, and in all for one application. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUIREMENT = 10;
export const MAX_APPLICATION_BYTES = 200 * 1024 * 1024;

/** Remembers whether the filing portal's sidebar is shrunk to icons. */
export const FILING_SIDEBAR_COOKIE = "filing_sidebar";
