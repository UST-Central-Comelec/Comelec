import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Article } from "@/components/news/article";
import { toStories } from "@/components/news/story";
import { getExplainers, getNewsPost } from "@/lib/data/queries";
import "../../banner-page.css";
import "../../news/news.css";

export async function generateMetadata({ params }: PageProps<"/explainer/[id]">): Promise<Metadata> {
  const post = await getNewsPost((await params).id);
  return post ? { title: post.title, description: post.excerpt } : {};
}

export default async function ExplainerGuidePage({ params }: PageProps<"/explainer/[id]">) {
  const { id } = await params;
  const [post, guides] = await Promise.all([getNewsPost(id), getExplainers()]);
  if (!post) notFound();
  // A post filed under News is read there; one re-filed from Explainer keeps its old links working.
  if (post.category !== "explainer") redirect(`/news/${post.id}`);

  return (
    <Article
      post={post}
      more={toStories(guides.filter((item) => item.id !== post.id)).slice(0, 3)}
      section={{ label: "Election Explainer", href: "/explainer", moreTitle: "More guides", allLabel: "All guides" }}
    />
  );
}
