import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/portal/notice";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { requireAccess } from "@/lib/auth/session";
import { formatAccepted, stepOf } from "@/lib/onboarding/documents";
import { getOnboardingDocuments } from "@/lib/onboarding/store";
import "@/components/portal/onboarding.css";

export const metadata: Metadata = { title: "Onboarding" };

export default async function LegalOnboardingPage({ searchParams }: PageProps<"/portal/legals/onboarding">) {
  const [user, { notice }] = await Promise.all([requireAccess("legals/onboarding"), searchParams]);
  let documents: Awaited<ReturnType<typeof getOnboardingDocuments>> | null = null;
  try {
    documents = await getOnboardingDocuments();
  } catch {
    documents = null;
  }

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Legals · Documents</p>
          <TitleWithInfo info="What someone agrees to when they request portal access: the Data Privacy Notice at the start, then the onboarding forms and portal policies after their profile. Each save is a new version. Acceptances keep the version that was shown, with the date and time, on the person’s account and in the Directory.">Onboarding</TitleWithInfo>
          <p className="portal-muted">Shown in Request access, in this order.</p>
        </div>
        {user.readOnly && <ViewOnlyTag />}
      </header>
      <Notice notice={notice} />

      <section className="portal-card is-flush">
        {!documents ? (
          <p className="portal-form-error" role="alert">Couldn’t load the onboarding documents. Reload the page to try again.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table onboarding-docs">
              <thead><tr><th>Step</th><th>Document</th><th>Version</th><th>Last saved</th></tr></thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.key}>
                    <td className="onboarding-figure">{stepOf(document.key)}</td>
                    <td>
                      <Link className="portal-row-title" href={`/portal/legals/onboarding/${document.key}`}>{document.title}</Link>
                      <small className="portal-muted">{document.statement}</small>
                    </td>
                    <td className="onboarding-figure">{document.version}</td>
                    <td>{document.savedAt ? <>{formatAccepted(document.savedAt)}<small className="portal-muted">{document.savedBy}</small></> : <span className="portal-tag">Original draft</span>}</td>
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
