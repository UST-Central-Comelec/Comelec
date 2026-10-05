// The Constitution and the Elections Code as the portal keeps them (Publications → Constitution,
// Publications → Elections Code): who may write a revision, who signs it, and what a revision is.
//
// Neither text is edited in place. A change is written as a revision by the commission's legal
// officers, sent for approval, and signed by the Chairperson, the Vice Chairperson and the Secretary
// to the Executive. Only when all three have signed does the website show it (./store.ts).
//
// Free of server-only imports: the editor and the pages read the same rules the server enforces.

import { officeOf } from "@/lib/data/accounts";
import { CHAIRPERSON, type AccountAffiliation, type AccountKind, type AccountPosition, type centralRoles } from "@/lib/data/types";
import type { CodeArticle } from "@/lib/elections-code/usec-2011";
import type { TabKey } from "@/lib/portal/access";
import type { ChangeStats } from "./diff";

type CentralRole = (typeof centralRoles)[number];

/**
 * The two texts. `title` is the tab's name, `the` how a sentence refers to it, `name` what its page
 * on the website calls it when searching ("Search the Code"), and `path` that page.
 */
export const codes = {
  constitution: { tab: "codes/constitution", title: "Constitution", the: "the Constitution", name: "Constitution", path: "/constitution" },
  "elections-code": { tab: "codes/elections-code", title: "Elections Code", the: "the Elections Code", name: "Code", path: "/elections-code" },
} as const satisfies Record<string, { tab: TabKey; title: string; the: string; name: string; path: string }>;

export type CodeKey = keyof typeof codes;

export const codeKeys = Object.keys(codes) as CodeKey[];

export const isCodeKey = (value: unknown): value is CodeKey => typeof value === "string" && Object.hasOwn(codes, value);

/** The Central Comelec's officers who write the texts. Their offices' Executive Associates write with them. */
export const editorRoles = ["Legal Head", "Secretary to the Adjudicatory"] as const satisfies readonly CentralRole[];

/** The Central Comelec's officers who sign a revision, in the order they're listed. All three must. */
export const approverRoles = [CHAIRPERSON, "Vice Chairperson", "Secretary to the Executive"] as const satisfies readonly CentralRole[];

export type ApproverRole = (typeof approverRoles)[number];

export const isApproverRole = (value: unknown): value is ApproverRole => (approverRoles as readonly unknown[]).includes(value);

/** The account details used to check editing and signing permissions. */
type Standing = { kind: AccountKind; affiliation: AccountAffiliation; position: AccountPosition; role: string };

/** A person's own account in the Central Comelec. A unit's official account holds no office, so it neither writes nor signs. */
const isCentralOfficer = (account: Standing) => account.kind === "personal" && account.affiliation === "central";

/**
 * Whether `account` may write a revision: the Central Comelec's Legal Head and Secretary to the
 * Adjudicatory, and the Executive Associates of their two offices. Nobody else, whatever tabs are
 * open to them.
 */
export function canEditCodes(account: Standing) {
  if (!isCentralOfficer(account)) return false;
  const roles: readonly string[] = account.position === "executive-board" ? editorRoles : account.position === "executive-associate" ? editorRoles.map(officeOf) : [];
  return roles.includes(account.role);
}

/** The signature `account` holds, if it's one of the three: the Central Comelec's Chairperson, Vice Chairperson or Secretary to the Executive. */
export function approverRoleOf(account: Standing): ApproverRole | null {
  return isCentralOfficer(account) && account.position === "executive-board" && isApproverRole(account.role) ? account.role : null;
}

/**
 * Where a revision stands:
 *   draft: being written. Its editors can change it, and nobody is asked to sign;
 *   pending: sent for approval. The text is locked until it's signed by all three, sent back, or withdrawn;
 *   approved: signed by all three, and published: the website shows this text;
 *   discarded: given up by its editors before it was approved.
 */
export type RevisionStatus = "draft" | "pending" | "approved" | "discarded";

/** Who signed, and when. */
export type Signature = { name: string; email: string; at: string };

/** Who did something to a revision, as its history keeps it. */
export type RevisionPerson = { name: string; email: string; role: string };

export type RevisionEventKind = "submitted" | "approved" | "returned" | "withdrawn" | "published" | "discarded";

/** One step of a revision's history. `note` is the reason it was sent back. */
export type RevisionEvent = { at: string; action: RevisionEventKind; name: string; role: string; note?: string };

/** Why a revision came back to its editors, until it's sent for approval again. */
export type Returned = { note: string; name: string; role: string; at: string };

/** A revision without its two texts: what the lists need. */
export type RevisionSummary = {
  id: string;
  code: CodeKey;
  status: RevisionStatus;
  /** What changed and why, in its editors' words, for those who sign. */
  summary: string;
  /** How much it changes, counted when it was last saved. */
  stats: ChangeStats;
  /** Who started it. */
  author: RevisionPerson;
  /** Who sent it for approval last, and when. Null until it's sent. */
  submitted: (RevisionPerson & { at: string }) | null;
  approvals: Partial<Record<ApproverRole, Signature>>;
  returned: Returned | null;
  events: RevisionEvent[];
  /** The published version it was written against, and the one it became once approved. */
  baseVersion: number;
  version: number | null;
  /** How many times it has been saved. A save names the count it read, and is refused if another got in first. */
  edits: number;
  createdAt: string;
  updatedAt: string;
  /** The email of whoever saved it last. */
  updatedBy: string;
  /** When it was published or discarded. */
  decidedAt: string | null;
};

/** A revision: the text as proposed (`articles`), and the published text it was started from (`baseArticles`), which its changes are measured against. */
export type CodeRevision = RevisionSummary & { articles: CodeArticle[]; baseArticles: CodeArticle[] };

/** The text the website shows. Version 0 is the text as it was signed, before any revision in the portal. */
export type PublishedCode = { code: CodeKey; articles: CodeArticle[]; version: number; publishedAt: string | null; revisionId: string | null };

export const signedCount = (revision: Pick<RevisionSummary, "approvals">) => approverRoles.filter((role) => revision.approvals[role]).length;

/** The signatures still missing. */
export const awaitedRoles = (revision: Pick<RevisionSummary, "approvals">) => approverRoles.filter((role) => !revision.approvals[role]);

/** A revision's status as a tag: its words, and the tag's colour class. */
export function describeRevision(revision: Pick<RevisionSummary, "status" | "returned" | "approvals" | "version">): { label: string; tone: string } {
  if (revision.status === "approved") return { label: revision.version ? `Published · version ${revision.version}` : "Published", tone: "is-ok" };
  if (revision.status === "pending") return { label: `Awaiting approval · ${signedCount(revision)} of ${approverRoles.length}`, tone: "is-gold" };
  if (revision.status === "discarded") return { label: "Discarded", tone: "" };
  return revision.returned ? { label: "Returned for changes", tone: "is-warn" } : { label: "Draft", tone: "" };
}

/** "Version 3", or what stands before any revision. */
export const versionName = (version: number) => (version > 0 ? `Version ${version}` : "As signed");
