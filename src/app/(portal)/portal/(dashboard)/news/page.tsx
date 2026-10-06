import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { getPosts } from "@/lib/data/queries";
import { formatDate, newsCategories } from "@/lib/data/types";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "News" };

export default async function PortalNewsPage({ searchParams }: PageProps<"/portal/news">) {
  const [{ readOnly }, [news, { notice }]] = await withPortalUser(Promise.all([getPosts(), searchParams]), allowed("news"));

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info="Press releases, announcements and publications shown on the website’s News page, and the guides on its Election Explainer page. A post’s category decides which page it’s on.">News</TitleWithInfo>
        </div>
        {readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/news/new"><Plus size={16} /> New post</Link>}
      </header>
      <Notice notice={notice} />

      <section className="portal-card is-flush">
        {news.length === 0 ? (
          <p className="portal-empty">No news posts yet.{!readOnly && <> <Link href="/portal/news/new">Write the first one.</Link></>}</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Title</th><th>Category</th><th>Shown on</th><th>Date</th><th /></tr></thead>
              <tbody>
                {news.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link className="portal-row-title" href={`/portal/news/${post.id}`}>{post.title}</Link>
                      {post.featured && <span className="portal-featured-star" role="img" aria-label="Featured" title="Featured"><Star size={16} fill="currentColor" aria-hidden="true" /></span>}
                    </td>
                    <td><span className="portal-tag">{newsCategories[post.category]}</span></td>
                    <td className="portal-muted">{post.category === "explainer" ? "Election Explainer" : "News"}</td>
                    <td className="portal-muted">{formatDate(post.date)}</td>
                    <td className="portal-row-actions"><Link href={`/portal/news/${post.id}`}>{readOnly ? "View" : "Edit"}</Link></td>
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
