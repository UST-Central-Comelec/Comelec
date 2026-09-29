// Shared content shapes for the public site and the portal. Kept free of server-only
// imports so client forms can use the option lists below.

export const newsCategories = {
  announcement: "Announcement",
  "press-release": "Press Release",
  event: "Event",
  explainer: "Explainer",
  "election-watch": "Election Watch",
} as const;

export const documentKinds = {
  "executive-order": "Executive Order",
  memorandum: "Memorandum",
  resolution: "Resolution",
  constitution: "Constitution",
  "elections-code": "Elections Code",
  proclamation: "Proclamation",
} as const;

export const memberBodies = {
  central: "Central Comelec",
  "en-banc": "En Banc",
  local: "Local Comelec",
} as const;

export const accountRoles = {
  commissioner: "Commissioner",
  executive: "Executive",
} as const;

export type NewsCategory = keyof typeof newsCategories;
export type DocumentKind = keyof typeof documentKinds;
export type MemberBody = keyof typeof memberBodies;
export type AccountRole = keyof typeof accountRoles;

type Record = {
  id: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type NewsPost = Record & {
  title: string;
  category: NewsCategory;
  /** ISO date (YYYY-MM-DD) shown as the publish date. */
  date: string;
  excerpt: string;
  body: string;
  featured: boolean;
};

export type OfficialDocument = Record & {
  kind: DocumentKind;
  title: string;
  /** Issuing number, e.g. "Memorandum No. 2026-004". Optional. */
  reference: string;
  date: string;
  summary: string;
  /** Main text shown on the document's own page. Paragraphs are separated by blank lines. */
  body: string;
  /** Shown as "SGD." lines — names and positions only, never signature images. */
  signatories: Signatory[];
  /** Google Drive link to the original PDF. */
  fileUrl: string | null;
  fileName: string | null;
};

export type Signatory = { name: string; position: string };

export type Member = Record & {
  name: string;
  position: string;
  body: MemberBody;
  /** College or faculty — used for Local Comelec members. */
  unit: string;
  photoUrl: string | null;
  /** Lower numbers are shown first within a body. */
  order: number;
};

/**
 * Who may sign in to the portal. People sign in with their @ust.edu.ph Google account, and only
 * emails listed here (and active) get in. Commissioners manage content; executives also manage accounts.
 */
export type PortalAccount = Record & {
  name: string;
  /** Stored lower-case. */
  email: string;
  role: AccountRole;
  active: boolean;
};

export type AccountSummary = PortalAccount & { builtIn: boolean };

export type ContentDb = {
  news: NewsPost[];
  documents: OfficialDocument[];
  members: Member[];
  accounts: PortalAccount[];
};

export function isNewsCategory(value: string): value is NewsCategory {
  return value in newsCategories;
}

export function isDocumentKind(value: string): value is DocumentKind {
  return value in documentKinds;
}

export function isMemberBody(value: string): value is MemberBody {
  return value in memberBodies;
}

export function isAccountRole(value: string): value is AccountRole {
  return value in accountRoles;
}

export function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
}
