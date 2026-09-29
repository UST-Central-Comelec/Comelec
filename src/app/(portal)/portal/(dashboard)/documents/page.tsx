import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import { withPortalUser } from "@/lib/auth/session";
import { getDocuments } from "@/lib/data/queries";
import { documentKinds, formatDate, isDocumentKind } from "@/lib/data/types";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Documents" };

export default async function PortalDocumentsPage({ searchParams }: PageProps<"/portal/documents">) {
  const { notice, kind: kindParam } = await searchParams;
  const kind = typeof kindParam === "string" && isDocumentKind(kindParam) ? kindParam : undefined;
  const [, documents] = await withPortalUser(getDocuments({ kind }));

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info="Executive orders, memorandums, resolutions and other official documents listed in the Archive.">Documents</TitleWithInfo>
        </div>
        <Link className="portal-button" href="/portal/documents/new"><Plus size={16} /> Add document</Link>
      </header>
      <Notice notice={notice} />

      <nav className="portal-filters" aria-label="Filter by type">
        <Link href="/portal/documents" className={!kind ? "is-active" : undefined}>All</Link>
        {Object.entries(documentKinds).map(([value, label]) => (
          <Link key={value} href={`/portal/documents?kind=${value}`} className={kind === value ? "is-active" : undefined}>{label}</Link>
        ))}
      </nav>

      <section className="portal-card is-flush">
        {documents.length === 0 ? (
          <p className="portal-empty">No documents here yet. <Link href="/portal/documents/new">Add one.</Link></p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Title</th><th>Type</th><th>Issued</th><th>Link</th><th /></tr></thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <Link className="portal-row-title" href={`/portal/documents/${doc.id}`}>{doc.title}</Link>
                      {doc.reference && <small className="portal-muted">{doc.reference}</small>}
                    </td>
                    <td><span className="portal-tag">{documentKinds[doc.kind]}</span></td>
                    <td className="portal-muted">{formatDate(doc.date)}</td>
                    <td>{doc.fileUrl ? <a href={doc.fileUrl} target="_blank" rel="noreferrer">Open ↗</a> : <span className="portal-tag is-warn">No link</span>}</td>
                    <td className="portal-row-actions"><Link href={`/portal/documents/${doc.id}`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
