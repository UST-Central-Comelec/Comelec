import "server-only";

import { store } from "./store";
import { CENTRAL_REPRESENTATIVE, CHAIRPERSON, isNewsCategory, isNewsroomCategory, type AccountSummary, type DirectoryGroup, type DocumentKind, type Member, type MemberBody, type NewsCategory, type NewsPost, type OfficialDocument, type PortalAccount } from "./types";

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

// The two categories retired by supabase/migrations/0020, and where their posts went. Rows still
// filed under them (before 0020 is run) are read as their new category.
const retiredCategories: Record<string, NewsCategory> = { event: "announcement", "election-watch": "explainer" };

function withCategory(post: NewsPost): NewsPost {
  const category: string = post.category;
  return isNewsCategory(category) ? post : { ...post, category: retiredCategories[category] ?? "announcement" };
}

/** Every post, newest first: the News page's and the Election Explainer's together, as the portal lists them. */
export async function getPosts() {
  return (await store.list("news")).map(withCategory).sort(byDateDesc);
}

/** The News page's posts: press releases, announcements and publications. */
export async function getNews() {
  return (await getPosts()).filter((post) => isNewsroomCategory(post.category));
}

/** The Election Explainer's guides. */
export async function getExplainers() {
  return (await getPosts()).filter((post) => post.category === "explainer");
}

/** One post, whichever page it's on. */
export async function getNewsPost(id: string) {
  const post = await store.get("news", id);
  return post ? withCategory(post) : null;
}

// Rows saved before migration 0003 have no body/signatories yet.
const withDocumentDefaults = (doc: OfficialDocument): OfficialDocument => ({ ...doc, body: doc.body ?? "", signatories: Array.isArray(doc.signatories) ? doc.signatories : [] });

export async function getDocuments(filter: { kinds?: readonly DocumentKind[]; year?: string } = {}) {
  return (await store.list("documents"))
    .map(withDocumentDefaults)
    .filter((doc) => (!filter.kinds || filter.kinds.includes(doc.kind)) && (!filter.year || doc.date.startsWith(filter.year)))
    .sort(byDateDesc);
}

export async function getDocumentYears(kinds?: readonly DocumentKind[]) {
  const years = new Set((await store.list("documents")).filter((doc) => !kinds || kinds.includes(doc.kind)).map((doc) => doc.date.slice(0, 4)));
  return [...years].sort().reverse();
}

export async function getDocument(id: string) {
  const doc = await store.get("documents", id);
  return doc ? withDocumentDefaults(doc) : null;
}

export async function getMembers(body?: MemberBody) {
  const members = (await store.list("members")).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return body ? members.filter((member) => member.body === body) : members;
}

const byCollege = (a: Member, b: Member) => a.unit.localeCompare(b.unit) || a.name.localeCompare(b.name);
const chamberRank = (member: Member) => (member.chamberRole === "primus" ? 0 : member.chamberRole === "vicar" ? 1 : 2);

/**
 * Every group of the Directory. Central and Local Comelec are entered by hand, in their
 * dragged order; the other two are built from them:
 *   En Banc: the Central Comelec (its Executive Board), then each college's Central Representative.
 *   Chamber of Chairpersons: the Local Chairpersons — Primus, then Vicar, then the rest by college.
 */
export async function getDirectory(): Promise<Record<DirectoryGroup, Member[]>> {
  const members = await getMembers();
  const central = members.filter((member) => member.body === "central");
  const local = members.filter((member) => member.body === "local");
  // Rows still marked "en-banc" (before supabase/migrations/0012 is run) are representatives too.
  const legacy = members.filter((member) => (member.body as string) === "en-banc");
  const representatives = [...local.filter((member) => member.position === CENTRAL_REPRESENTATIVE), ...legacy].sort(byCollege);
  const chairpersons = local.filter((member) => member.position === CHAIRPERSON).sort((a, b) => chamberRank(a) - chamberRank(b) || byCollege(a, b));
  return { central, local, "en-banc": [...central, ...representatives], chamber: chairpersons };
}

/** Colleges that already have a Central Representative, mapped to that person's name (leaving out `exceptId`). */
export function takenColleges(members: Member[], exceptId?: string) {
  return Object.fromEntries(
    members.filter((member) => member.body === "local" && member.position === CENTRAL_REPRESENTATIVE && member.unit && member.id !== exceptId).map((member) => [member.unit, member.name]),
  );
}

export function getMember(id: string) {
  return store.get("members", id);
}

function toSummary(account: PortalAccount): AccountSummary {
  const { id, name, email, role, active, createdAt, updatedAt, updatedBy } = account;
  return { id, name, email, role, active, affiliation: account.affiliation ?? "central", college: account.college ?? null, createdAt, updatedAt, updatedBy, builtIn: false };
}

/** Portal accounts without password hashes. Callers must already have checked for an executive. */
export async function getAccounts(builtIn: AccountSummary | null) {
  const accounts = (await store.list("accounts")).map(toSummary).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return builtIn ? [builtIn, ...accounts] : accounts;
}

export async function getAccount(id: string) {
  const account = await store.get("accounts", id);
  return account ? toSummary(account) : null;
}
