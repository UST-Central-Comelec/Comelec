import type { Metadata } from "next";
import Link from "next/link";
import { isDriveUploadConfigured } from "@/lib/data/drive-upload";
import { DocumentForm } from "@/components/portal/document-form";
import { requireCentral } from "@/lib/auth/session";
import { isDocumentKind } from "@/lib/data/types";
import { createDocument } from "@/lib/portal/document-actions";

export const metadata: Metadata = { title: "Add document" };

export default async function NewDocumentPage({ searchParams }: PageProps<"/portal/documents/new">) {
  await requireCentral();
  const { kind } = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/documents">← Documents</Link>
          <h1>Add document</h1>
        </div>
      </header>
      <section className="portal-card">
        <DocumentForm canUpload={isDriveUploadConfigured()}
          action={createDocument}
          submitLabel="Publish"
          initial={{ kind: typeof kind === "string" && isDocumentKind(kind) ? kind : "memorandum", title: "", reference: "", date: today, summary: "", body: "", signatories: [], fileUrl: null, fileName: null }}
        />
      </section>
    </main>
  );
}
