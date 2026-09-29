import type { Metadata } from "next";
import { news } from "@/lib/content";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return <main><section className="page-hero"><div className="page-hero-inner"><div className="eyebrow">A record of participation</div><h1>Election<br />archive.</h1><p>Browse the dates, decisions, and documents that make up our shared electoral history.</p></div></section><section className="section"><div className="archive-filter"><span className="filter-label">Filter by year</span><button className="filter-chip active">2026</button><button className="filter-chip">2025</button><button className="filter-chip">2024</button><button className="filter-chip">2023</button></div><div className="archive-list">{news.map((item) => <article className="archive-row" key={item.title}><time>{item.date}</time><span className="category">{item.category}</span><h3>{item.title}</h3><span className="arrow">↗</span></article>)}<article className="archive-row"><time>May 24, 2026</time><span className="category">Results</span><h3>2026 Central Elections: Official results</h3><span className="arrow">↗</span></article></div></section></main>;
}