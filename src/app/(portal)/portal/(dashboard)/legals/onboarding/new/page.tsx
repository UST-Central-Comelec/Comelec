import type { Metadata } from "next";
import Link from "next/link";
import { requireEditor } from "@/lib/auth/session";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { OnboardingDocumentEditor } from "@/components/portal/onboarding-document-editor";

export const metadata: Metadata = { title: "Add onboarding step" };

export default async function NewOnboardingStepPage() {
  await requireEditor("legals/onboarding");
  return <main className="portal-page">
    <header className="portal-page-head"><div>
      <Link className="portal-back" href="/portal/legals/onboarding">← Onboarding</Link>
      <p className="portal-eyebrow">Legals · Documents</p>
      <TitleWithInfo info="Add a document for requesters to read and agree to. It appears after the existing documents and before Review and submit.">Add onboarding step</TitleWithInfo>
    </div></header>
    <OnboardingDocumentEditor isNew readOnly={false} document={{ key: "custom-new", title: "", statement: "", body: "", version: 0, savedAt: null, savedBy: null }} />
  </main>;
}
