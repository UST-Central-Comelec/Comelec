import type { Metadata } from "next";
import { news } from "@/lib/content";

export const metadata: Metadata = { title: "News" };

export default function NewsPage() {
  return <main><section className="page-hero"><div className="page-hero-inner"><div className="eyebrow">Updates & announcements</div><h1>News from the<br />commission.</h1><p>Clear information for a more confident electorate. Follow the latest announcements, explainers, and stories from UST Central Comelec.</p></div></section><section className="section"><div className="news-grid">{news.map((item) => <article key={item.title} className={`news-card${item.featured ? " featured" : ""}`} style={{ "--accent": item.accent } as React.CSSProperties}><div className="news-meta"><span>{item.category}</span><time>{item.date}</time></div><h3>{item.title}</h3><p>{item.excerpt}</p></article>)}</div></section></main>;
}