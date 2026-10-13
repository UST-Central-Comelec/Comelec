import type { Metadata } from "next";
import Link from "next/link";
import { AddIcon as Plus } from "@/components/action-icons";
import { Notice } from "@/components/portal/notice";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { getDocuments } from "@/lib/data/queries";
import { archiveKinds } from "@/lib/data/types";
import { DocumentsTable } from "@/components/portal/documents-table";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Archive" };

export default async function PortalDocumentsPage({ searchParams }: PageProps<"/portal/documents/archive">) {
  const { notice } = await searchParams;
  const [{ readOnly }, documents] = await withPortalUser(getDocuments({ kinds: archiveKinds }), allowed("documents/archive"));

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Legals · Documents</p>
          <TitleWithInfo info="Executive orders, memorandums, resolutions and other official documents listed in the Archive.">Archive</TitleWithInfo>
        </div>
        {readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/documents/archive/new"><Plus size={16} /> Add document</Link>}
      </header>
      <Notice notice={notice} />

      <DocumentsTable
        documents={documents.map(({ id, title, reference, kind, date, fileUrl }) => ({ id, title, reference, kind, date, fileUrl }))}
        readOnly={readOnly}
      />
    </main>
  );
}
