import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import { requirePortalUser } from "@/lib/auth/session";
import { getNews } from "@/lib/data/queries";
import { formatDate, newsCategories } from "@/lib/data/types";

export const metadata: Metadata = { title: "News" };

export default async function PortalNewsPage({ searchParams }: PageProps<"/portal/news">) {
  await requirePortalUser();
  const [news, { notice }] = await Promise.all([getNews(), searchParams]);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <h1>News</h1>
          <p className="portal-muted">Announcements, press releases, events and explainers shown on the News page.</p>
        </div>
        <Link className="portal-button" href="/portal/news/new"><Plus size={16} /> New post</Link>
      </header>
      <Notice notice={notice} />

      <section className="portal-card is-flush">
        {news.length === 0 ? (
          <p className="portal-empty">No news posts yet. <Link href="/portal/news/new">Write the first one.</Link></p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Title</th><th>Category</th><th>Date</th><th /></tr></thead>
              <tbody>
                {news.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link className="portal-row-title" href={`/portal/news/${post.id}`}>{post.title}</Link>
                      {post.featured && <span className="portal-tag is-gold"><Star size={11} /> Featured</span>}
                    </td>
                    <td><span className="portal-tag">{newsCategories[post.category]}</span></td>
                    <td className="portal-muted">{formatDate(post.date)}</td>
                    <td className="portal-row-actions"><Link href={`/portal/news/${post.id}`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
