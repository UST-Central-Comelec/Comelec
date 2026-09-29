import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Newspaper, Plus, Users } from "lucide-react";
import { requirePortalUser } from "@/lib/auth/session";
import { getDocuments, getMembers, getNews } from "@/lib/data/queries";
import { documentKinds, memberBodies, newsCategories } from "@/lib/data/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function PortalDashboardPage() {
  const user = await requirePortalUser();
  const [news, documents, members] = await Promise.all([getNews(), getDocuments(), getMembers()]);

  const recent = [
    ...news.map((item) => ({ key: `news-${item.id}`, title: item.title, type: newsCategories[item.category], href: `/portal/news/${item.id}`, updatedAt: item.updatedAt })),
    ...documents.map((item) => ({ key: `doc-${item.id}`, title: item.title, type: documentKinds[item.kind], href: `/portal/documents/${item.id}`, updatedAt: item.updatedAt })),
    ...members.map((item) => ({ key: `member-${item.id}`, title: `${item.name} — ${item.position}`, type: memberBodies[item.body], href: `/portal/members/${item.id}`, updatedAt: item.updatedAt })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  const stats = [
    { label: "News posts", count: news.length, href: "/portal/news", newHref: "/portal/news/new", icon: Newspaper },
    { label: "Documents", count: documents.length, href: "/portal/documents", newHref: "/portal/documents/new", icon: FileText },
    { label: "Commission members", count: members.length, href: "/portal/members", newHref: "/portal/members/new", icon: Users },
  ];

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Dashboard</p>
          <h1>Welcome back, {user.name}.</h1>
          <p className="portal-muted">Everything you publish here appears on the website as soon as you save.</p>
        </div>
      </header>

      <section className="portal-stats">
        {stats.map(({ label, count, href, newHref, icon: Icon }) => (
          <div className="portal-card portal-stat" key={label}>
            <Icon size={20} strokeWidth={1.6} className="portal-stat-icon" aria-hidden="true" />
            <strong>{count}</strong>
            <Link href={href}>{label}</Link>
            <Link className="portal-button is-small is-ghost" href={newHref}><Plus size={14} /> Add</Link>
          </div>
        ))}
      </section>

      <section className="portal-card">
        <h2 className="portal-card-title">Recently updated</h2>
        {recent.length === 0 ? (
          <p className="portal-empty">Nothing here yet.</p>
        ) : (
          <ul className="portal-list">
            {recent.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>
                  <span className="portal-list-title">{item.title}</span>
                  <span className="portal-tag">{item.type}</span>
                  <time className="portal-muted">{new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
