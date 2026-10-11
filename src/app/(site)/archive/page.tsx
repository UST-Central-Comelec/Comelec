import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ArchiveFilters } from "@/components/archive/archive-filters";
import { PageBanner } from "@/components/page-banner";
import { dateParts } from "@/components/news/story";
import { getDocuments, getDocumentYears } from "@/lib/data/queries";
import { archiveKinds, documentKinds, isDocumentKind } from "@/lib/data/types";
import "../banner-page.css";
import "../news/news.css";
import "./archive.css";

export const metadata: Metadata = { title: "Archive" };

function RowDate({ date }: { date: string }) {
  const { day, month, year } = dateParts(date);
  return <time className="nr-row-date" dateTime={date}><b>{day}</b><span>{month} {year}</span></time>;
}

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

  const title = voterInfo ? documentKinds[kind] : "Election archive";

  return (
    <main className="bp nr ar">
      <PageBanner seed={1611} eyebrow={voterInfo ? "Voter info" : "Records"} title={voterInfo ? title : <>Election <em>archive.</em></>}
        lede={voterInfo ? `Every ${documentKinds[kind].toLowerCase()} the commission has published, newest first.` : "Resolutions, memoranda, results and other records the commission has published, newest first."}
        readings={[{ label: "Documents", value: String(documents.length) }, ...(years.length ? [{ label: "Years", value: years.length > 1 ? `${years.at(-1)}–${years[0]}` : years[0] }] : [])]} />
      <div className="bp-wrap bp-body">
        {(!voterInfo || years.length > 1) && (
          <div className="ar-filters">
            {!voterInfo && <ArchiveFilters id="type" label="Type" items={[{ href: href({ year }), label: "All", active: !kind }, ...archiveKinds.map((value) => ({ href: href({ type: value, year }), label: documentKinds[value], active: kind === value }))]} />}
            {years.length > 1 && <ArchiveFilters id="year" label="Year" items={[{ href: href({ type: kind }), label: "All years", active: !year }, ...years.map((value) => ({ href: href({ type: kind, year: value }), label: value, active: year === value }))]} />}
          </div>
        )}
        {documents.length === 0 ? <p className="bp-empty">No documents here yet.</p> : (
          <ol className="nr-list ar-list">
            {documents.map((doc) => (
              <li key={doc.id}>
                <article className="nr-row">
                  <RowDate date={doc.date} />
                  <div className="nr-row-main">
                    <p className="nr-meta"><span>{documentKinds[doc.kind]}</span>{doc.reference && <span>{doc.reference}</span>}</p>
                    <h2 className="nr-row-title"><Link className="nr-stretch" href={`/archive/${doc.id}`}>{doc.title}</Link></h2>
                    {doc.summary && <p className="nr-row-excerpt">{doc.summary}</p>}
                  </div>
                  <ArrowUpRight className="nr-row-arrow" size={20} aria-hidden="true" />
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
