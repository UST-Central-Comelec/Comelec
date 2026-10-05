"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { archiveKinds, documentKinds, formatDate, isDocumentKind, type OfficialDocument } from "@/lib/data/types";
import { SlidingFilterButtons } from "./sliding-filters";

type DocumentRow = Pick<OfficialDocument, "id" | "title" | "reference" | "kind" | "date" | "fileUrl">;

const filters = [
  { key: "all", label: "All" },
  ...archiveKinds.map(key => ({ key, label: documentKinds[key] })),
];

export function DocumentsTable({ documents, readOnly }: { documents: DocumentRow[]; readOnly: boolean }) {
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind");
  const active = kind && isDocumentKind(kind) && archiveKinds.includes(kind) ? kind : "all";
  const visible = documents.filter(doc => active === "all" || doc.kind === active);

  function filter(key: string) {
    if (key === active) return;
    const url = new URL(window.location.href);
    if (key === "all") url.searchParams.delete("kind");
    else url.searchParams.set("kind", key);
    // Next.js syncs useSearchParams with native history without a server round trip.
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <>
      <SlidingFilterButtons items={filters} active={active} label="Filter by type" onChange={filter} />
      <section className="portal-card is-flush">
        {visible.length === 0 ? (
          <p className="portal-empty">No documents here yet.{!readOnly && <> <Link href="/portal/documents/new">Add one.</Link></>}</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Title</th><th>Type</th><th>Issued</th><th>Link</th><th /></tr></thead>
              <tbody>
                {visible.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <Link className="portal-row-title" href={`/portal/documents/${doc.id}`}>{doc.title}</Link>
                      {doc.reference && <small className="portal-muted">{doc.reference}</small>}
                    </td>
                    <td><span className="portal-tag">{documentKinds[doc.kind]}</span></td>
                    <td className="portal-muted">{formatDate(doc.date)}</td>
                    <td>{doc.fileUrl ? <a href={doc.fileUrl} target="_blank" rel="noreferrer">Open ↗</a> : <span className="portal-tag is-warn">No link</span>}</td>
                    <td className="portal-row-actions"><Link href={`/portal/documents/${doc.id}`}>{readOnly ? "View" : "Edit"}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
