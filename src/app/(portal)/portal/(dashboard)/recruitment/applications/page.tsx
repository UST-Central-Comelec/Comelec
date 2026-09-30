import type { Metadata } from "next";
import Link from "next/link";
import { applicationStatuses, isApplicationStatus, listApplications, statusTag, type ApplicationStatus, type PreferredBody } from "@/lib/applications/admin";
import { daysUntilDeletion, deletionDate, preferredBodies } from "@/lib/applications/options";
import { isLocal, requirePortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";

export const metadata: Metadata = { title: "Applications" };

/** The filters shown; "reviewing" is kept in the database but isn't used in the portal. */
const filters: ApplicationStatus[] = ["pending", "accepted", "declined"];

/** Which body applicants want to serve in. Central accounts start on Central; "all" shows everyone. */
type BodyFilter = PreferredBody | "all";
const bodyFilters: Record<BodyFilter, string> = { central: "Central Comelec", local: "Local Comelec", all: "All bodies" };
const isBodyFilter = (value: unknown): value is BodyFilter => typeof value === "string" && value in bodyFilters;

/** The list's address with one filter changed, keeping the other. */
function filterHref(filters: { status?: ApplicationStatus; body: BodyFilter }) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.body !== "central") params.set("body", filters.body);
  const query = params.toString();
  return `/portal/recruitment/applications${query ? `?${query}` : ""}`;
}

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** Days left before the application is deleted: gold in its last two weeks, red in its last week. */
function DeletionCountdown({ submittedAt }: { submittedAt: string }) {
  const days = daysUntilDeletion(submittedAt);
  const tone = days <= 7 ? " is-warn" : days <= 14 ? " is-gold" : "";
  return (
    <>
      <span className={`portal-tag${tone}`}>{days === 1 ? "1 day left" : `${days} days left`}</span>
      <small className="portal-muted">Deletes {formatDate(deletionDate(submittedAt))}</small>
    </>
  );
}

export default async function PortalApplicationsPage({ searchParams }: PageProps<"/portal/recruitment/applications">) {
  const [user, { status: statusParam, body: bodyParam, notice }] = await Promise.all([requirePortalUser(), searchParams]);
  const status = isApplicationStatus(statusParam) ? statusParam : undefined;
  // Local accounts see only their college's applicants, whichever body they applied to.
  const local = isLocal(user);
  const body: BodyFilter = isBodyFilter(bodyParam) ? bodyParam : "central";

  const { value: applications, error: loadError } = await settle(
    local ? listApplications({ status, college: user.college ?? "" }) : listApplications({ status, body: body === "all" ? undefined : body }),
  );

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Recruitment</p>
          <TitleWithInfo info={local
            ? `Applicants from ${user.college ?? "your college"}, for Central or Local Comelec. Open an application to email the applicant, accept or reject it, or delete it early. Applicants see the result when they track their application. Applications are deleted automatically 60 days after they’re submitted.`
            : "Everyone who applied through the Apply page, starting with those applying to serve in the Central Comelec. Open an application to email the applicant, accept or reject it, or delete it early. Applicants see the result when they track their application. Applications are deleted automatically 60 days after they’re submitted."}>Applications</TitleWithInfo>
          {local && <p className="portal-muted">{user.college}</p>}
        </div>
      </header>
      <Notice notice={notice} />

      <div className="portal-filter-rows">
        {!local && (
          <nav className="portal-filters" aria-label="Filter by where they’d serve">
            {(Object.keys(bodyFilters) as BodyFilter[]).map((value) => (
              <Link key={value} href={filterHref({ status, body: value })} className={body === value ? "is-active" : undefined}>{bodyFilters[value]}</Link>
            ))}
          </nav>
        )}
        <nav className="portal-filters" aria-label="Filter by status">
          <Link href={filterHref({ body })} className={!status ? "is-active" : undefined}>All</Link>
          {filters.map((value) => (
            <Link key={value} href={filterHref({ status: value, body })} className={status === value ? "is-active" : undefined}>{applicationStatuses[value]}</Link>
          ))}
        </nav>
      </div>

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load applications. Run <code>supabase/migrations/0005_application_reference_codes.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      ) : (
        <section className="portal-card is-flush">
          {applications!.length === 0 ? (
            <p className="portal-empty">
              {status ? `No applications marked “${applicationStatuses[status]}”` : "No applications yet"}
              {local ? ` from ${user.college ?? "your college"}.` : body === "all" ? "." : ` from applicants for ${preferredBodies[body]}.`}
            </p>
          ) : (
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Applicant</th><th>Position</th><th>Submitted</th><th>Status</th><th>Auto-delete</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {applications!.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <Link className="portal-row-title" href={`/portal/recruitment/applications/${application.id}`}>{application.name}</Link>
                        <small className="portal-muted">{application.referenceCode} · {application.college}</small>
                      </td>
                      <td>{application.position}<small className="portal-muted">{local || body === "all" ? `${application.division} · ${application.preferredBody}` : application.division}</small></td>
                      <td className="portal-muted">{formatDate(application.submittedAt)}</td>
                      <td><span className={`portal-tag ${statusTag[application.status]}`}>{applicationStatuses[application.status]}</span></td>
                      <td><DeletionCountdown submittedAt={application.submittedAt} /></td>
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
