// Shared content shapes for the public site and the portal. Kept free of server-only
// imports so client forms can use the option lists below.

import type { CommissionEvent } from "@/lib/events/options";
import type { StatisticTable } from "@/lib/statistics/table";

/**
 * What a post is filed under. Press releases, announcements and publications make up the News page
 * (newsroomCategories); explainers are written the same way in the portal but have their own page,
 * the Election Explainer (/explainer).
 */
export const newsCategories = {
  "press-release": "Press Release",
  announcement: "Announcement",
  publication: "Publication",
  explainer: "Explainer",
} as const;

export const documentKinds = {
  "executive-order": "Executive Order",
  memorandum: "Memorandum",
  resolution: "Resolution",
  constitution: "Constitution",
  "elections-code": "Elections Code",
  proclamation: "Proclamation",
} as const;

/** Groups a member is entered into. En Banc and the Chamber of Chairpersons are built from these (directoryGroups). */
export const memberBodies = {
  central: "Central Comelec",
  local: "Local Comelec",
} as const;

/** Every group in the Directory and on the About page, in display order. */
export const directoryGroups = {
  central: "Central Comelec",
  "en-banc": "En Banc",
  chamber: "Chamber of Chairpersons",
  local: "Local Comelec",
} as const;

export const CHAIRPERSON = "Chairperson";
export const CENTRAL_REPRESENTATIVE = "Central Representative";

/** Central Comelec positions. The whole Central Comelec is its Executive Board, so all of them sit in En Banc. */
export const centralPositions = [
  CHAIRPERSON,
  "Vice Chairperson",
  "Secretary to the Executive",
  "Legal Head",
  "Secretary to the Adjudicatory",
  "Finance Officer",
  "Logistics Officer",
  "Operations Officer",
  "Public Information Officer",
  "Deputy Head",
] as const;

/**
 * Local Comelec positions: the same, plus each college's Central Representative (one per college,
 * shown under En Banc). Local Chairpersons make up the Chamber of Chairpersons.
 */
export const localPositions = [...centralPositions, CENTRAL_REPRESENTATIVE] as const;

export const positionsFor = (body: MemberBody): readonly string[] => (body === "central" ? centralPositions : localPositions);

/** A Local Chairperson's role in the Chamber of Chairpersons, besides being a member. */
export const chamberRoles = {
  primus: "Primus",
  vicar: "Vicar",
} as const;

export const accountRoles = {
  commissioner: "Commissioner",
  executive: "Executive",
} as const;

/**
 * Where a portal account serves. Central sees everything; Local sees the Directory, Recruitment
 * applications, PolPaR and Filing of Candidacy, and only its own college's people there.
 */
export const affiliations = {
  central: "Central Comelec",
  local: "Local Comelec",
} as const;

export type NewsCategory = keyof typeof newsCategories;

/** The categories listed on the News page, in the order of its tabs. */
export const newsroomCategories = ["press-release", "announcement", "publication"] as const satisfies readonly NewsCategory[];
export type NewsroomCategory = (typeof newsroomCategories)[number];

/** The News page's tabs: its categories, in the plural. */
export const newsroomLabels: { [Category in NewsroomCategory]: string } = {
  "press-release": "Press releases",
  announcement: "Announcements",
  publication: "Publications",
};
export type DocumentKind = keyof typeof documentKinds;

/** Kinds listed in the public Archive. The others (Constitution, Elections Code, Proclamation) are reached from Voter Info, each on its own. */
export const archiveKinds: readonly DocumentKind[] = ["executive-order", "memorandum", "resolution"];
export type MemberBody = keyof typeof memberBodies;
export type DirectoryGroup = keyof typeof directoryGroups;
export type ChamberRole = keyof typeof chamberRoles;
export type AccountRole = keyof typeof accountRoles;
export type Affiliation = keyof typeof affiliations;

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
  /** College or faculty: required for Local Comelec, optional for Central Comelec. */
  unit: string;
  photoUrl: string | null;
  /** Position within its body, set by dragging in the Directory. Lower comes first. */
  order: number;
  /** Local Chairpersons only: Primus or Vicar of the Chamber of Chairpersons. Missing before 0012. */
  chamberRole?: ChamberRole | null;
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
  /** Missing before supabase/migrations/0017; treated as Central. */
  affiliation?: Affiliation;
  /** College or faculty. Required for Local; null for accounts added before 0017. */
  college?: string | null;
};

export type AccountSummary = Omit<PortalAccount, "affiliation" | "college"> & { affiliation: Affiliation; college: string | null; builtIn: boolean };

export type ContentDb = {
  news: NewsPost[];
  documents: OfficialDocument[];
  members: Member[];
  accounts: PortalAccount[];
  /** Events and activities. Their shape and options live in src/lib/events/options.ts. */
  events: CommissionEvent[];
  /** The Statistics page's tables of figures. Their shape lives in src/lib/statistics/table.ts. */
  statistics: StatisticTable[];
};

export function isNewsCategory(value: string): value is NewsCategory {
  return Object.hasOwn(newsCategories, value);
}

export function isNewsroomCategory(value: string): value is NewsroomCategory {
  return (newsroomCategories as readonly string[]).includes(value);
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

export function isAffiliation(value: unknown): value is Affiliation {
  return typeof value === "string" && value in affiliations;
}

/** "Central Comelec", or "Local Comelec · College of Science". */
export function describeAffiliation(affiliation: Affiliation, college: string | null | undefined) {
  return affiliation === "local" && college ? `${affiliations.local} · ${college}` : affiliations[affiliation];
}

export function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
}
