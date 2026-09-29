import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsPost } from "@/lib/data/queries";
import { formatDate, newsCategories } from "@/lib/data/types";

export async function generateMetadata({ params }: PageProps<"/news/[id]">): Promise<Metadata> {
  const post = await getNewsPost((await params).id);
  return post ? { title: post.title, description: post.excerpt } : {};
}

export default async function NewsArticlePage({ params }: PageProps<"/news/[id]">) {
  const post = await getNewsPost((await params).id);
  if (!post) notFound();

  const paragraphs = post.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return <main><section className="page-hero"><div className="page-hero-inner"><Link href={`/news?category=${post.category}`} className="eyebrow">{newsCategories[post.category]}</Link><h1 className="article-title">{post.title}</h1><p><time dateTime={post.date}>{formatDate(post.date)}</time></p></div></section><article className="section article-body"><p className="article-lede">{post.excerpt}</p>{paragraphs.filter((paragraph) => paragraph !== post.excerpt).map((paragraph, index) => <p key={index}>{paragraph}</p>)}<Link className="all-link" href="/news">← Back to all news</Link></article></main>;
}
