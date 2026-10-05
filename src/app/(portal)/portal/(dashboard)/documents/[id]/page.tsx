import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { isDriveUploadConfigured } from "@/lib/data/drive-upload";
import { DocumentForm } from "@/components/portal/document-form";
import { ViewOnly } from "@/components/portal/view-only";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { archiveKinds } from "@/lib/data/types";
import { getDocument } from "@/lib/data/queries";
import { deleteDocument, updateDocument } from "@/lib/portal/document-actions";

export const metadata: Metadata = { title: "Edit document" };

export default async function EditDocumentPage({ params }: PageProps<"/portal/documents/[id]">) {
  const [{ readOnly }, doc] = await withPortalUser(getDocument((await params).id), allowed("documents"));
  if (!doc || !archiveKinds.includes(doc.kind)) notFound();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/documents">← Documents</Link>
          <h1>{readOnly ? "Document" : "Edit document"}</h1>
          <p className="portal-muted">Last updated {new Date(doc.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by {doc.updatedBy}. <a href={`/archive/${doc.id}`} target="_blank" rel="noreferrer">View on website ↗</a></p>
        </div>
      </header>
      <section className="portal-card">
        <ViewOnly when={readOnly}>
          <DocumentForm readOnly={readOnly} canUpload={isDriveUploadConfigured()} action={updateDocument.bind(null, doc.id)} submitLabel="Save changes" initial={doc} danger={<DeleteButton action={deleteDocument.bind(null, doc.id)} label="Delete document" />} />
        </ViewOnly>
      </section>
    </main>
  );
}
