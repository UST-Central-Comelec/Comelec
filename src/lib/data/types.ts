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

/** Every group in the Directory and on the About page, in display order. All four are built from Accounts (getDirectory). */
export const directoryGroups = {
  central: "Central Comelec",
  "en-banc": "En Banc",
  chamber: "Chamber of Chairpersons",
  local: "Local Comelec",
} as const;

export const CHAIRPERSON = "Chairperson";
export const CENTRAL_REPRESENTATIVE = "Central Representative";
export const DEPUTY = "Deputy";

/** The Central Comelec's Executive Board, in order of rank. All of them sit in En Banc. */
export const centralRoles = [
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
 * A Local Comelec's Executive Board: the same, plus the college's Central Representative (one per
 * college, shown under En Banc). Local Chairpersons make up the Chamber of Chairpersons.
 */
export const localRoles = [...centralRoles, CENTRAL_REPRESENTATIVE] as const;

/** A Local Chairperson's role in the Chamber of Chairpersons, besides being a member. */
export const chamberRoles = {
  primus: "Primus",
  vicar: "Vicar",
} as const;

/**
 * Someone's standing in their unit. With the affiliation it decides what the portal opens to them
 * (src/lib/portal/access.ts), and which roles they can hold (rolesFor in ./accounts.ts).
 * Commissioners are students: Executive Board, Executive Associate or Deputy. Advisers and Admins
 * aren't: they have no role, program or student ID, and they read the portal without changing it.
 */
export const accountPositions = {
  "executive-board": "Executive Board",
  "executive-associate": "Executive Associate",
  deputy: "Deputy",
  adviser: "Adviser",
  admin: "Admin",
} as const;

/** The positions commissioners hold, which Request access offers. */
export const commissionerPositions = ["executive-board", "executive-associate", "deputy"] as const satisfies readonly (keyof typeof accountPositions)[];

/** The two halves of the commission. A Local account sees and manages only its own college. */
export const affiliations = {
  central: "Central Comelec",
  local: "Local Comelec",
} as const;

/** Where an account belongs: the commission, or the Office for Student Affairs, whose people are Admins. */
export const accountAffiliations = {
  ...affiliations,
  osa: "Office for Student Affairs",
} as const;

/**
 * What an account is. A personal account is a person's own: a commissioner, an adviser or an admin.
 * An official account is a unit's shared mailbox (comelec.sci@ust.edu.ph), with none of a person's
 * details; it acts as its unit's Executive Board.
 */
export const accountKinds = {
  personal: "Commissioner account",
  official: "Official account",
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
export type DirectoryGroup = keyof typeof directoryGroups;
export type ChamberRole = keyof typeof chamberRoles;
export type AccountPosition = keyof typeof accountPositions;
export type CommissionerPosition = (typeof commissionerPositions)[number];
export type Affiliation = keyof typeof affiliations;
export type AccountAffiliation = keyof typeof accountAffiliations;
export type AccountKind = keyof typeof accountKinds;

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

/**
 * Who may sign in to the portal, and who they are in the commission. People sign in with their
 * @ust.edu.ph Google account, and only emails listed here (and active) get in. The Directory and
 * the About page's "Meet the commission" are built from these too.
 *
 * Everything from `lastName` down was added by supabase/migrations/0021 and is missing on rows read
 * before it's run; read accounts through toSummary (./accounts.ts), which fills the gaps.
 */
export type PortalAccount = Record & {
  /** "Juan P. Dela Cruz": the name parts put together, for everywhere a name is shown. */
  name: string;
  /** Stored lower-case. */
  email: string;
  /**
   * What they are in their unit: "Chairperson", "Office of the Chairperson", "Deputy". Empty until
   * it's picked. Before 0021 this column held "commissioner" or "executive".
   */
  role: string;
  active: boolean;
  /** Missing before supabase/migrations/0022; treated as personal. */
  kind?: AccountKind;
  /** Missing before supabase/migrations/0017; treated as Central. */
  affiliation?: AccountAffiliation;
  /** College or faculty. Required for Local; null for accounts added before 0017. */
  college?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleInitial?: string | null;
  middleName?: string | null;
  yearLevel?: string | null;
  studentNumber?: string | null;
  program?: string | null;
  facebookUrl?: string | null;
  position?: AccountPosition | null;
  /** When the email was proved with Google: on approval of an access request, or at the first sign-in. Null until then. */
  emailVerifiedAt?: string | null;
  /** Shown in the Directory and on the About page. */
  photoUrl?: string | null;
  /** Local Chairpersons only: Primus or Vicar of the Chamber of Chairpersons. */
  chamberRole?: ChamberRole | null;
};

/** An account with every gap filled in, as pages and forms read it. */
export type AccountSummary = Record & {
  name: string;
  email: string;
  role: string;
  active: boolean;
  kind: AccountKind;
  affiliation: AccountAffiliation;
  college: string | null;
  /** Empty for an official account, and for one added before accounts had name parts; `name` holds the whole name. */
  lastName: string;
  firstName: string;
  middleInitial: string;
  middleName: string;
  yearLevel: string | null;
  studentNumber: string | null;
  program: string | null;
  facebookUrl: string | null;
  position: AccountPosition;
  emailVerifiedAt: string | null;
  photoUrl: string | null;
  chamberRole: ChamberRole | null;
  /** The executive set on the server as PORTAL_EXECUTIVE_EMAIL. */
  builtIn: boolean;
};

/** One person in the Directory: an active commissioner's account with a role. `email` and the rest are for the portal's view only. */
export type DirectoryEntry = Pick<AccountSummary, "id" | "name" | "role" | "position" | "college" | "program" | "email" | "facebookUrl" | "photoUrl" | "chamberRole"> & { affiliation: Affiliation };

export type ContentDb = {
  news: NewsPost[];
  documents: OfficialDocument[];
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

export function isAccountPosition(value: unknown): value is AccountPosition {
  return typeof value === "string" && value in accountPositions;
}

export function isAffiliation(value: unknown): value is Affiliation {
  return typeof value === "string" && value in affiliations;
}

export function isAccountAffiliation(value: unknown): value is AccountAffiliation {
  return typeof value === "string" && value in accountAffiliations;
}

export const isCommissionerPosition = (value: unknown): value is CommissionerPosition => (commissionerPositions as readonly unknown[]).includes(value);

/** Advisers and Admins read the portal; they don't change it. */
export const isViewerPosition = (position: AccountPosition) => position === "adviser" || position === "admin";

/** "Central Comelec", "Local Comelec · College of Science" or "Office for Student Affairs". */
export function describeAffiliation(affiliation: AccountAffiliation, college: string | null | undefined) {
  return affiliation === "local" && college ? `${affiliations.local} · ${college}` : accountAffiliations[affiliation];
}

export function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
}
