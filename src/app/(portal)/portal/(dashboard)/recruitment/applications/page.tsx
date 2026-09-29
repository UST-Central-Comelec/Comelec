import type { Metadata } from "next";
import Link from "next/link";
import { applicationStatuses, isApplicationStatus, listApplications, statusTag, type ApplicationStatus } from "@/lib/applications/admin";
import { withPortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Applications" };

/** The filters shown; "reviewing" is kept in the database but isn't used in the portal. */
const filters: ApplicationStatus[] = ["pending", "accepted", "declined"];

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export default async function PortalApplicationsPage({ searchParams }: PageProps<"/portal/recruitment/applications">) {
  const { status: statusParam } = await searchParams;
  const status = isApplicationStatus(statusParam) ? statusParam : undefined;

  const [, { value: applications, error: loadError }] = await withPortalUser(settle(listApplications(status)));

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Recruitment</p>
          <TitleWithInfo info="Everyone who applied through the Apply page. Open an application to email the applicant, or to accept or reject it. Applicants see the result when they track their application. Applications are deleted automatically 60 days after they’re submitted.">Applications</TitleWithInfo>
        </div>
      </header>

      <nav className="portal-filters" aria-label="Filter by status">
        <Link href="/portal/recruitment/applications" className={!status ? "is-active" : undefined}>All</Link>
        {filters.map((value) => (
          <Link key={value} href={`/portal/recruitment/applications?status=${value}`} className={status === value ? "is-active" : undefined}>{applicationStatuses[value]}</Link>
        ))}
      </nav>

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load applications. Run <code>supabase/migrations/0005_application_reference_codes.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      ) : (
        <section className="portal-card is-flush">
          {applications!.length === 0 ? (
            <p className="portal-empty">{status ? `No applications marked “${applicationStatuses[status]}”.` : "No applications yet."}</p>
          ) : (
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Applicant</th><th>Position</th><th>Submitted</th><th>Status</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {applications!.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <Link className="portal-row-title" href={`/portal/recruitment/applications/${application.id}`}>{application.name}</Link>
                        <small className="portal-muted">{application.referenceCode} · {application.college}</small>
                      </td>
                      <td>{application.position}<small className="portal-muted">{application.division}</small></td>
                      <td className="portal-muted">{formatDate(application.submittedAt)}</td>
                      <td><span className={`portal-tag ${statusTag[application.status]}`}>{applicationStatuses[application.status]}</span></td>
                      <td className="portal-row-actions"><Link href={`/portal/recruitment/applications/${application.id}`}>Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
