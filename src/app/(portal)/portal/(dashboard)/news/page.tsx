import { EditIcon as ActionEditIcon, ViewIcon as ActionViewIcon } from "@/components/action-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { AddIcon as Plus } from "@/components/action-icons";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { getPosts } from "@/lib/data/queries";
import { formatDate, newsCategories } from "@/lib/data/types";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { PortalTableRow } from "@/components/portal/portal-table-row";

export const metadata: Metadata = { title: "Publications" };

export default async function PortalNewsPage({ searchParams }: PageProps<"/portal/news">) {
  const [{ readOnly }, [news, { notice }]] = await withPortalUser(Promise.all([getPosts(), searchParams]), allowed("news"));

  return (
    <main className="portal-page portal-publications">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Secretariat</p>
          <TitleWithInfo info="Press releases, announcements and publications shown on the website’s News page, and the guides on its Election Explainer page. A post’s category decides which page it’s on.">Publications</TitleWithInfo>
        </div>
        {readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/news/new"><Plus size={16} /> New post</Link>}
      </header>
      <Notice notice={notice} />

      <section className="portal-card is-flush">
        {news.length === 0 ? (
          <p className="portal-empty">No publications yet.{!readOnly && <> <Link href="/portal/news/new">Write the first one.</Link></>}</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Title</th><th>Category</th><th>Shown on</th><th>Date Published</th><th /></tr></thead>
              <tbody>
                {news.map((post) => (
                  <PortalTableRow key={post.id} href={`/portal/news/${post.id}`}>
                    <td>
                      <Link className="portal-row-title" href={`/portal/news/${post.id}`}>{post.title}</Link>
                      {post.featured && <span className="portal-featured-star" role="img" aria-label="Featured" title="Featured"><Star size={16} fill="currentColor" aria-hidden="true" /></span>}
                    </td>
                    <td><span className="portal-tag">{newsCategories[post.category]}</span></td>
                    <td className="portal-muted">{post.category === "explainer" ? "Election Explainer" : "News"}</td>
                    <td className="portal-muted">{formatDate(post.date)}</td>
                    <td className="portal-row-actions"><Link className="portal-button is-small is-ghost" href={`/portal/news/${post.id}`} aria-label={`${readOnly ? "View" : "Edit"} ${post.title}`}>{readOnly ? <ActionViewIcon size={15} aria-hidden="true" /> : <ActionEditIcon size={15} aria-hidden="true" />}<span>{readOnly ? "View" : "Edit"}</span></Link></td>
                  </PortalTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
