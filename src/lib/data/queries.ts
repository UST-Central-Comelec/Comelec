import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { isCentralRepresentative, isLocalChairperson, listName, roleRank, toSummary } from "./accounts";
import { store } from "./store";
import { accountPositions, isNewsCategory, isNewsroomCategory, type AccountSummary, type DirectoryEntry, type DirectoryGroup, type DocumentKind, type NewsCategory, type NewsPost, type OfficialDocument } from "./types";

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

// The public site's copy of the posts and documents. Its pages read them on every visit (News and
// Archive filter by the address), so they're kept for up to a minute. The portal always reads them
// fresh, and saving one there clears these straight away (refreshSiteContent).
const contentTag = (collection: "news" | "documents") => `site-content:${collection}`;
const newsForSite = unstable_cache(() => store.list("news"), [contentTag("news")], { tags: [contentTag("news")], revalidate: 60 });
const documentsForSite = unstable_cache(() => store.list("documents"), [contentTag("documents")], { tags: [contentTag("documents")], revalidate: 60 });

/** After a portal save to posts or documents: the site's next visit reads them fresh. */
export function refreshSiteContent(collection: "news" | "documents") {
  revalidateTag(contentTag(collection), { expire: 0 });
}

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

/** Every post as the site shows them, newest first. */
const getPostsForSite = async () => (await newsForSite()).map(withCategory).sort(byDateDesc);

/** The News page's posts: press releases, announcements and publications. */
export async function getNews() {
  return (await getPostsForSite()).filter((post) => isNewsroomCategory(post.category));
}

/** The Election Explainer's guides. */
export async function getExplainers() {
  return (await getPostsForSite()).filter((post) => post.category === "explainer");
}

/** One post, whichever page it's on. */
export async function getNewsPost(id: string) {
  const post = await store.get("news", id);
  return post ? withCategory(post) : null;
}

// Rows saved before migration 0003 have no body/signatories yet.
const withDocumentDefaults = (doc: OfficialDocument): OfficialDocument => ({ ...doc, body: doc.body ?? "", signatories: Array.isArray(doc.signatories) ? doc.signatories : [] });

type DocumentFilter = { kinds?: readonly DocumentKind[]; year?: string };

const filterDocuments = (documents: OfficialDocument[], filter: DocumentFilter) =>
  documents
    .map(withDocumentDefaults)
    .filter((doc) => (!filter.kinds || filter.kinds.includes(doc.kind)) && (!filter.year || doc.date.startsWith(filter.year)))
    .sort(byDateDesc);

/** For the portal: always fresh. */
export async function getDocuments(filter: DocumentFilter = {}) {
  return filterDocuments(await store.list("documents"), filter);
}

/** For the public site: the copy kept for up to a minute. */
export async function getDocumentsForSite(filter: DocumentFilter = {}) {
  return filterDocuments(await documentsForSite(), filter);
}

export async function getDocumentYears(kinds?: readonly DocumentKind[]) {
  const years = new Set((await documentsForSite()).filter((doc) => !kinds || kinds.includes(doc.kind)).map((doc) => doc.date.slice(0, 4)));
  return [...years].sort().reverse();
}

export async function getDocument(id: string) {
  const doc = await store.get("documents", id);
  return doc ? withDocumentDefaults(doc) : null;
}

const byName = (a: AccountSummary, b: AccountSummary) => listName(a).localeCompare(listName(b));
const byRank = (a: AccountSummary, b: AccountSummary) => roleRank(a) - roleRank(b) || byName(a, b);
const byCollege = (a: AccountSummary, b: AccountSummary) => (a.college ?? "").localeCompare(b.college ?? "") || byName(a, b);
const chamberRank = (account: AccountSummary) => (account.chamberRole === "primus" ? 0 : account.chamberRole === "vicar" ? 1 : 2);

function toEntry({ id, name, role, position, affiliation, college, program, email, facebookUrl, photoUrl, chamberRole }: AccountSummary): DirectoryEntry {
  // An adviser has no role of their own; the Directory lists them as what they are.
  return { id, name, role: position === "adviser" ? accountPositions.adviser : role, position, affiliation: affiliation === "local" ? "local" : "central", college, program, email, facebookUrl, photoUrl, chamberRole };
}

/**
 * Everyone the Directory lists: commissioners with an active account whose role has been picked
 * (one without a role yet isn't shown until it has one), and advisers, after their unit's
 * commissioners. Admins and the units' official accounts aren't listed.
 */
export const isListed = (account: AccountSummary) => account.active && account.kind === "personal" && account.affiliation !== "osa" && (account.position === "adviser" || Boolean(account.role));

/**
 * Every group of the Directory, built from Accounts. Nobody is entered by hand: to add someone, or
 * change how they're listed, add or edit their account.
 *   Central Comelec: every Central account — the Executive Board by rank, then their offices, then deputies.
 *   Local Comelec: the same for every college (the About page and the portal group them by college).
 *   En Banc: the Central Executive Board, then each college's Central Representative.
 *   Chamber of Chairpersons: the Local Chairpersons — Primus, then Vicar, then the rest by college.
 */
export async function getDirectory(): Promise<Record<DirectoryGroup, DirectoryEntry[]>> {
  const listed = (await store.list("accounts")).map(toSummary).filter(isListed);
  const central = listed.filter((account) => account.affiliation === "central").sort(byRank);
  const local = listed.filter((account) => account.affiliation === "local").sort((a, b) => (a.college ?? "").localeCompare(b.college ?? "") || byRank(a, b));
  const board = central.filter((account) => account.position === "executive-board");
  const representatives = local.filter(isCentralRepresentative).sort(byCollege);
  const chairpersons = local.filter(isLocalChairperson).sort((a, b) => chamberRank(a) - chamberRank(b) || byCollege(a, b));
  return { central: central.map(toEntry), local: local.map(toEntry), "en-banc": [...board, ...representatives].map(toEntry), chamber: chairpersons.map(toEntry) };
}

/** How many people the Directory lists. */
export async function countDirectory() {
  return (await store.list("accounts")).map(toSummary).filter(isListed).length;
}

/**
 * Portal accounts, active first, then by name. `builtInEmail` marks the built-in executive's own
 * row, if it has one. Callers must already have checked that the Accounts tab is open to the reader.
 */
export async function getAccounts(builtInEmail?: string | null): Promise<AccountSummary[]> {
  return (await store.list("accounts"))
    .map((account) => ({ ...toSummary(account), builtIn: account.email === builtInEmail }))
    .sort((a, b) => Number(b.active) - Number(a.active) || byName(a, b));
}

export async function getAccount(id: string) {
  const account = await store.get("accounts", id);
  return account ? toSummary(account) : null;
}
