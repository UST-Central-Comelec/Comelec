import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { OnboardingDocumentEditor } from "@/components/portal/onboarding-document-editor";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { requireAccess } from "@/lib/auth/session";
import { formatAccepted, isOnboardingDocumentKey, stepOf } from "@/lib/onboarding/documents";
import { getOnboardingDocument } from "@/lib/onboarding/store";

export const metadata: Metadata = { title: "Onboarding document" };

export default async function OnboardingDocumentPage({ params }: PageProps<"/portal/legals/onboarding/[key]">) {
  const [user, { key }] = await Promise.all([requireAccess("legals/onboarding"), params]);
  if (!isOnboardingDocumentKey(key)) notFound();
  const document = await getOnboardingDocument(key);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/legals/onboarding">← Onboarding</Link>
          <p className="portal-eyebrow">Legals · Documents · Step {stepOf(key)}</p>
          <TitleWithInfo info="Saving adds a new version, and Request access shows it from then on. Anyone who already accepted keeps the version they were shown, with the date and time they accepted it.">{document.title}</TitleWithInfo>
          <p className="portal-muted">Version {document.version}{document.savedAt ? ` · saved ${formatAccepted(document.savedAt)} by ${document.savedBy}` : " · original draft"}</p>
        </div>
        {user.readOnly && <ViewOnlyTag />}
      </header>
      <OnboardingDocumentEditor key={document.version} document={document} readOnly={user.readOnly} />
    </main>
  );
}
