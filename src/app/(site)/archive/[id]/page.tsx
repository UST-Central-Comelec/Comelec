import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { DocumentBody } from "@/components/document-body";
import { parseDocumentBody } from "@/lib/data/document-body";
import { getDocument } from "@/lib/data/queries";
import { documentKinds, formatDate } from "@/lib/data/types";

export async function generateMetadata({ params }: PageProps<"/archive/[id]">): Promise<Metadata> {
  const doc = await getDocument((await params).id);
  return doc ? { title: doc.reference ? `${doc.reference}: ${doc.title}` : doc.title, description: doc.summary || undefined } : {};
}

export default async function ArchiveDocumentPage({ params }: PageProps<"/archive/[id]">) {
  const doc = await getDocument((await params).id);
  if (!doc) notFound();

  const blocks = parseDocumentBody(doc.body);
  const signatories = doc.signatories.filter((signatory) => signatory.name.trim());

  return <main><section className="page-hero"><div className="page-hero-inner"><Link href={`/archive?type=${doc.kind}`} className="eyebrow">{documentKinds[doc.kind]}</Link><h1 className="article-title">{doc.title}</h1><p className="document-meta">{doc.reference && <span>{doc.reference}</span>}<time dateTime={doc.date}>{formatDate(doc.date)}</time></p></div></section><article className="section article-body document-body">{blocks.length > 0 ? <DocumentBody blocks={blocks} /> : <p className="document-empty">{doc.summary || "The full text of this document isn’t on the website yet."}{doc.fileUrl && " You can read the original below."}</p>}{signatories.length > 0 && <div className="signatories">{signatories.map((signatory, index) => <div className="signatory" key={index}><span className="signatory-sgd">SGD.</span><strong>{signatory.name}</strong>{signatory.position && <span>{signatory.position}</span>}</div>)}</div>}<div className="document-actions">{doc.fileUrl && <a className="button-primary" href={doc.fileUrl} target="_blank" rel="noreferrer">View original document <ArrowUpRight size={15} /></a>}<Link className="all-link" href="/archive">← Back to the archive</Link></div></article></main>;
}
