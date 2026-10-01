import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Article } from "@/components/news/article";
import { toStories } from "@/components/news/story";
import { getNews, getNewsPost } from "@/lib/data/queries";
import { isNewsroomCategory, newsroomLabels } from "@/lib/data/types";
import "../../banner-page.css";
import "../news.css";

export async function generateMetadata({ params }: PageProps<"/news/[id]">): Promise<Metadata> {
  const post = await getNewsPost((await params).id);
  return post ? { title: post.title, description: post.excerpt } : {};
}

export default async function NewsArticlePage({ params }: PageProps<"/news/[id]">) {
  const { id } = await params;
  const [post, news] = await Promise.all([getNewsPost(id), getNews()]);
  if (!post) notFound();
  // Explainers have their own page; a post re-filed as one keeps its old links working.
  if (!isNewsroomCategory(post.category)) redirect(`/explainer/${post.id}`);

  // More from the same category first, then the latest of the rest.
  const others = toStories(news.filter((item) => item.id !== post.id));
  const more = [...others.filter((item) => item.category === post.category), ...others.filter((item) => item.category !== post.category)].slice(0, 3);

  return (
    <Article
      post={post}
      more={more}
      section={{ label: "News", href: "/news", crumb: { label: newsroomLabels[post.category], href: `/news?category=${post.category}` }, moreTitle: "More news", allLabel: "All news" }}
    />
  );
}
