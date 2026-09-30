import type { Metadata } from "next";
import Link from "next/link";
import { getDocuments, getDocumentYears } from "@/lib/data/queries";
import { archiveKinds, documentKinds, formatDate, isDocumentKind } from "@/lib/data/types";

export const metadata: Metadata = { title: "Archive" };

export default async function ArchivePage({ searchParams }: PageProps<"/archive">) {
  const { type: typeParam, year: yearParam } = await searchParams;
  const kind = typeof typeParam === "string" && isDocumentKind(typeParam) ? typeParam : undefined;
  // Constitution, Elections Code, and Proclamation open on their own from Voter Info, never mixed into the archive.
  const voterInfo = kind !== undefined && !archiveKinds.includes(kind);
  const kinds = kind ? [kind] : archiveKinds;
  const years = await getDocumentYears(kinds);
  const year = typeof yearParam === "string" && years.includes(yearParam) ? yearParam : undefined;
  const documents = await getDocuments({ kinds, year });

  const href = (next: { type?: string; year?: string }) => {
    const query = new URLSearchParams(Object.entries(next).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return query.size ? `/archive?${query}` : "/archive";
  };

  return <main><section className="page-hero"><div className="page-hero-inner">{voterInfo ? <><div className="eyebrow">Voter info</div><h1>{documentKinds[kind]}.</h1></> : <><div className="eyebrow">A record of participation</div><h1>Election<br />archive.</h1><p>Browse the dates, decisions, and documents that make up our shared electoral history.</p></>}</div></section><section className="section">{!voterInfo && <nav className="archive-filter" aria-label="Filter by document type"><span className="filter-label">Type</span><Link href={href({ year })} className={`filter-chip${!kind ? " active" : ""}`}>All</Link>{archiveKinds.map((value) => <Link key={value} href={href({ type: value, year })} className={`filter-chip${kind === value ? " active" : ""}`}>{documentKinds[value]}</Link>)}</nav>}{years.length > 1 && <nav className="archive-filter" aria-label="Filter by year"><span className="filter-label">Year</span><Link href={href({ type: kind })} className={`filter-chip${!year ? " active" : ""}`}>All years</Link>{years.map((value) => <Link key={value} href={href({ type: kind, year: value })} className={`filter-chip${year === value ? " active" : ""}`}>{value}</Link>)}</nav>}{documents.length === 0 ? <p className="empty-state">No documents here yet.</p> : <div className="archive-list">{documents.map((doc) => {
    return <Link className="archive-row" key={doc.id} href={`/archive/${doc.id}`}><time dateTime={doc.date}>{formatDate(doc.date)}</time><span className="category">{documentKinds[doc.kind]}</span><h3>{doc.title}{doc.reference && <small>{doc.reference}</small>}</h3><span className="arrow">→</span></Link>;
  })}</div>}</section></main>;
}
