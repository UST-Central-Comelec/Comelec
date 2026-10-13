import { ViewIcon as ActionViewIcon } from "@/components/action-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { NewsForm } from "@/components/portal/news-form";
import { ViewOnly } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { postHref } from "@/components/news/story";
import { stampFor } from "@/lib/data/edit-guard";
import { getNewsPost } from "@/lib/data/queries";
import { deleteNews, updateNews } from "@/lib/portal/news-actions";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditNewsPage({ params }: PageProps<"/portal/news/[id]">) {
  const [{ readOnly }, post] = await withPortalUser(getNewsPost((await params).id), allowed("news"));
  if (!post) notFound();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/news">← News</Link>
          <h1>{readOnly ? "Post" : "Edit post"}</h1>
          <p className="portal-muted">Last updated {formatClosing(post.updatedAt)} by {post.updatedBy}. <a href={postHref(post)} target="_blank" rel="noreferrer"><ActionViewIcon size={15} aria-hidden="true" />View on website ↗</a></p>
        </div>
      </header>
      <section className="portal-card">
        <ViewOnly when={readOnly}>
          <NewsForm action={updateNews.bind(null, post.id)} submitLabel="Save changes" initial={post} guard={readOnly ? undefined : { stamp: stampFor(post.updatedAt, post), record: `news/${post.id}` }} danger={<DeleteButton action={deleteNews.bind(null, post.id)} label="Delete" animatedIcon tone="black" />} />
        </ViewOnly>
      </section>
    </main>
  );
}
