import "server-only";

import { store } from "./store";
import type { AccountSummary, DocumentKind, MemberBody, NewsCategory, OfficialDocument, PortalAccount } from "./types";

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

export async function getNews(category?: NewsCategory) {
  const news = (await store.list("news")).sort(byDateDesc);
  return category ? news.filter((post) => post.category === category) : news;
}

export function getNewsPost(id: string) {
  return store.get("news", id);
}

// Rows saved before migration 0003 have no body/signatories yet.
const withDocumentDefaults = (doc: OfficialDocument): OfficialDocument => ({ ...doc, body: doc.body ?? "", signatories: Array.isArray(doc.signatories) ? doc.signatories : [] });

export async function getDocuments(filter: { kind?: DocumentKind; year?: string } = {}) {
  return (await store.list("documents"))
    .map(withDocumentDefaults)
    .filter((doc) => (!filter.kind || doc.kind === filter.kind) && (!filter.year || doc.date.startsWith(filter.year)))
    .sort(byDateDesc);
}

export async function getDocumentYears() {
  const years = new Set((await store.list("documents")).map((doc) => doc.date.slice(0, 4)));
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

export function getMember(id: string) {
  return store.get("members", id);
}

function toSummary(account: PortalAccount): AccountSummary {
  const { id, name, email, role, active, createdAt, updatedAt, updatedBy } = account;
  return { id, name, email, role, active, createdAt, updatedAt, updatedBy, builtIn: false };
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
