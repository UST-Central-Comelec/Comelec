import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { applicationStatuses, listApplications, statusTag } from "@/lib/applications/admin";
import { getUnitSlots } from "@/lib/applications/slots";
import { unitAbbreviations } from "@/lib/applications/options";
import { canOpen, isLocal, requireAccess } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ApplicantsTable } from "@/components/portal/applicants-table";
import { Notice } from "@/components/portal/notice";

export const metadata: Metadata = { title: "Applications" };

export default async function PortalApplicationsPage({ searchParams }: PageProps<"/portal/recruitment/applications">) {
  const [user, { notice }] = await Promise.all([requireAccess("recruitment/applications"), searchParams]);
  // Local accounts see only their college's applicants, whichever body they applied to.
  const local = isLocal(user);

  const [{ value: applications, error: loadError }, slots] = await Promise.all([
    // Load the authorized rows once; the table filters them without a server round trip.
    settle(listApplications(local ? { college: user.college ?? "" } : {})),
    getUnitSlots().catch(() => null),
  ]);

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
        <div className="portal-head-actions">
          <Link className="portal-button is-ghost" href="/apply/preview" target="_blank" rel="noopener noreferrer">View Mode <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link className="portal-button is-ghost" href="/apply" target="_blank" rel="noopener noreferrer">Application form <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </header>
      <Notice notice={notice} />

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load applications. Please reload or contact the site administrator if this continues. ({loadError})
        </p>
      ) : (
        <section className="portal-card is-flush">
          <ApplicantsTable
            localCollege={local ? user.college ?? "your college" : null}
            slots={slots}
            readOnly={user.readOnly}
            canOnboard={canOpen(user, "accounts") && !user.readOnly}
            rows={(applications ?? []).map((application) => ({
              id: application.id,
              application,
              name: application.name,
              position: application.position,
              college: application.college,
              collegeAbbreviation: unitAbbreviations[application.college] ?? application.college,
              statusLabel: applicationStatuses[application.status],
              statusTone: statusTag[application.status],
            }))}
          />
        </section>
      )}
    </main>
  );
}
