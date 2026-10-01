import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { NewsForm } from "@/components/portal/news-form";
import { requireCentral, withPortalUser } from "@/lib/auth/session";
import { postHref } from "@/components/news/story";
import { getNewsPost } from "@/lib/data/queries";
import { deleteNews, updateNews } from "@/lib/portal/news-actions";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditNewsPage({ params }: PageProps<"/portal/news/[id]">) {
  const [, post] = await withPortalUser(getNewsPost((await params).id), requireCentral);
  if (!post) notFound();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/news">← News</Link>
          <h1>Edit post</h1>
          <p className="portal-muted">Last updated {new Date(post.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by {post.updatedBy}. <a href={postHref(post)} target="_blank" rel="noreferrer">View on website ↗</a></p>
        </div>
      </header>
      <section className="portal-card">
        <NewsForm action={updateNews.bind(null, post.id)} submitLabel="Save changes" initial={post} danger={<DeleteButton action={deleteNews.bind(null, post.id)} label="Delete post" />} />
      </section>
    </main>
  );
}
