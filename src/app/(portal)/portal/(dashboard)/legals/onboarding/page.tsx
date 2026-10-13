import type { Metadata } from "next";
import Link from "next/link";
import { AddIcon as Plus } from "@/components/action-icons";
import { Notice } from "@/components/portal/notice";
import { OnboardingStepList } from "@/components/portal/onboarding-step-list";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { requireAccess } from "@/lib/auth/session";
import { defaultOnboardingLayout } from "@/lib/onboarding/documents";
import { getOnboardingDocuments, getOnboardingLayout } from "@/lib/onboarding/store";
import "@/components/portal/onboarding.css";

export const metadata: Metadata = { title: "Onboarding" };

export default async function LegalOnboardingPage({ searchParams }: PageProps<"/portal/legals/onboarding">) {
  const [user, { notice }] = await Promise.all([requireAccess("legals/onboarding"), searchParams]);
  let documents: Awaited<ReturnType<typeof getOnboardingDocuments>> | null = null;
  let layout = defaultOnboardingLayout();
  try {
    [documents, layout] = await Promise.all([getOnboardingDocuments(true), getOnboardingLayout()]);
  } catch {
    documents = null;
  }

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Legals · Documents</p>
          <TitleWithInfo info="What someone agrees to when they request portal access: the Data Privacy Notice at the start, then the onboarding forms and portal policies after their profile. Each save is a new version. Acceptances keep the version that was shown, with the date and time, on the person’s account and in the Directory.">Onboarding</TitleWithInfo>
        </div>
        {user.readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/legals/onboarding/new"><Plus size={15} aria-hidden="true" />Add step</Link>}
      </header>
      <Notice notice={notice} />

      <section className="portal-card is-flush">
        {!documents ? (
          <p className="portal-form-error" role="alert">Couldn’t load the onboarding documents. Reload the page to try again.</p>
        ) : (
          <OnboardingStepList documents={documents} layout={layout} readOnly={user.readOnly} />
        )}
      </section>
    </main>
  );
}
