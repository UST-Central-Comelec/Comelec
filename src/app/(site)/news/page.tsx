import type { Metadata } from "next";
import Link from "next/link";
import { getNews } from "@/lib/data/queries";
import { formatDate, isNewsCategory, newsCategories, type NewsCategory } from "@/lib/data/types";

export const metadata: Metadata = { title: "News" };

const accents: Record<NewsCategory, string> = {
  announcement: "#d4a017",
  "press-release": "#8b1e3f",
  event: "#1d5360",
  explainer: "#d4a017",
  "election-watch": "#8b1e3f",
};

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const { category: categoryParam } = await searchParams;
  const category = typeof categoryParam === "string" && isNewsCategory(categoryParam) ? categoryParam : undefined;
  const news = (await getNews(category)).sort((a, b) => Number(b.featured) - Number(a.featured));

  return <main><section className="page-hero"><div className="page-hero-inner"><div className="eyebrow">Updates & announcements</div><h1>News from the<br />commission.</h1><p>Clear information for a more confident electorate. Follow the latest announcements, explainers, and stories from UST Central Comelec.</p></div></section><section className="section"><nav className="archive-filter" aria-label="Filter by category"><span className="filter-label">Show</span><Link href="/news" className={`filter-chip${!category ? " active" : ""}`}>All news</Link>{Object.entries(newsCategories).map(([value, label]) => <Link key={value} href={`/news?category=${value}`} className={`filter-chip${category === value ? " active" : ""}`}>{label}</Link>)}</nav>{news.length === 0 ? <p className="empty-state">Nothing posted here yet. Check back soon.</p> : <div className="news-grid">{news.map((item) => <Link key={item.id} href={`/news/${item.id}`} className={`news-card${item.featured ? " featured" : ""}`} style={{ "--accent": accents[item.category] } as React.CSSProperties}><div className="news-meta"><span>{newsCategories[item.category]}</span><time dateTime={item.date}>{formatDate(item.date)}</time></div><h3>{item.title}</h3><p>{item.excerpt}</p></Link>)}</div>}</section></main>;
}
