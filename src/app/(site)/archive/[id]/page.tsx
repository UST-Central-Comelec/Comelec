import { ViewIcon as ActionViewIcon } from "@/components/action-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { NightSky } from "@/components/night-sky";
import { DocumentBody } from "@/components/document-body";
import { parseDocumentBody } from "@/lib/data/document-body";
import { getDocument } from "@/lib/data/queries";
import { archiveKinds, documentKinds, formatDate } from "@/lib/data/types";
import "../../banner-page.css";
import "../../news/news.css";
import "../archive.css";

const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

// None built ahead: each document is rendered on its first visit, then kept like the site's other pages
// (rebuilt at most once a minute, and straight away when it's saved in the portal).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/archive/[id]">): Promise<Metadata> {
  const doc = await getDocument((await params).id);
  return doc ? { title: doc.reference ? `${doc.reference}: ${doc.title}` : doc.title, description: doc.summary || undefined } : {};
}

export default async function ArchiveDocumentPage({ params }: PageProps<"/archive/[id]">) {
  const doc = await getDocument((await params).id);
  if (!doc) notFound();

  const blocks = parseDocumentBody(doc.body);
  const signatories = doc.signatories.filter((signatory) => signatory.name.trim());

  const back = archiveKinds.includes(doc.kind) ? { href: "/archive", label: "Election archive" } : { href: `/archive?type=${doc.kind}`, label: documentKinds[doc.kind] };

  return (
    <main className="bp nr ar">
      <RevealOnScroll />
      <article aria-labelledby="ar-doc-title">
        <header className="bp-banner" data-hero>
          <NightSky seed={1612} count={56} />
          <div className="bp-wrap">
            <nav className="bp-crumbs" aria-label="Breadcrumb" data-enter style={enter(0)}>
              <Link href={back.href}><ArrowLeft size={14} aria-hidden="true" />{back.label}</Link>
              {archiveKinds.includes(doc.kind) && <><span aria-hidden="true">/</span><Link href={`/archive?type=${doc.kind}`}>{documentKinds[doc.kind]}</Link></>}
            </nav>
            <h1 id="ar-doc-title" className="bp-title is-headline" data-enter style={enter(1)}>{doc.title}</h1>
            {doc.summary && <p className="bp-lede" data-enter style={enter(2)}>{doc.summary}</p>}
          </div>
        </header>

        <div className="bp-wrap nr-story">
          <div className="nr-story-body">
            {blocks.length > 0 ? <DocumentBody blocks={blocks} /> : <p>The full text of this document isn’t on the website yet.{doc.fileUrl && " You can read the original from the link beside it."}</p>}
            {signatories.length > 0 && (
              <div className="ar-signatories">
                {signatories.map((signatory, index) => <div className="ar-signatory" key={index}><span>Sgd.</span><strong>{signatory.name}</strong>{signatory.position && <small>{signatory.position}</small>}</div>)}
              </div>
            )}
          </div>
          <aside className="nr-story-side" aria-label="About this document">
            <dl className="nr-facts">
              <div><dt>Type</dt><dd>{documentKinds[doc.kind]}</dd></div>
              {doc.reference && <div><dt>Reference</dt><dd>{doc.reference}</dd></div>}
              <div><dt>Dated</dt><dd><time dateTime={doc.date}>{formatDate(doc.date)}</time></dd></div>
            </dl>
            <div className="nr-story-actions">
              {doc.fileUrl && <a className="bp-button is-primary is-small" href={doc.fileUrl} target="_blank" rel="noreferrer">View original <ActionViewIcon size={15} aria-hidden="true" /></a>}
              <Link href={back.href} className="nr-back"><ArrowLeft size={14} aria-hidden="true" />{back.label}</Link>
            </div>
          </aside>
        </div>
      </article>
    </main>
  );
}
