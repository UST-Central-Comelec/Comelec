import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ExternalLink, Mail, RotateCcw, X } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import { applicationStatuses, getApplication, statusTag, type ApplicationRecord } from "@/lib/applications/admin";
import { deletionDate } from "@/lib/applications/options";
import { getSlots } from "@/lib/applications/slots";
import { withPortalUser } from "@/lib/auth/session";
import { updateApplicationStatus } from "@/lib/portal/application-actions";
import { InfoTip } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Application" };

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** A mailto: link with a subject and a starting message that fits the application's status. */
function emailLink(application: ApplicationRecord) {
  const subject = `Your Central COMELEC application (${application.referenceCode})`;
  const greeting = `Hi ${application.firstName},`;
  const bodies: Record<ApplicationRecord["status"], string> = {
    pending: `${greeting}\n\nThank you for applying for ${application.position} in the ${application.division}. `,
    reviewing: `${greeting}\n\nThank you for applying for ${application.position} in the ${application.division}. `,
    accepted: `${greeting}\n\nCongratulations! You’ve been accepted as ${application.position} in the ${application.division}. `,
    declined: `${greeting}\n\nThank you for applying for ${application.position} in the ${application.division}. After careful review, we won’t be moving forward with your application this time. `,
  };
  const body = `${bodies[application.status]}\n\nUST Central Commission on Elections`;
  return `mailto:${application.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children || <span className="portal-muted">Not provided</span>}</dd></div>;
}

function FileLink({ href }: { href: string | null }) {
  return href ? <a href={href} target="_blank" rel="noreferrer">Open in Google Drive <ExternalLink size={13} /></a> : null;
}

export default async function PortalApplicationPage({ params, searchParams }: PageProps<"/portal/recruitment/applications/[id]">) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const [, [application, slots]] = await withPortalUser(Promise.all([getApplication(id), getSlots().catch(() => null)]));
  if (!application) notFound();
  // Recruitment slots still open for this position; accepting takes one. Null if they couldn't load.
  const slotsLeft = slots ? (slots[application.positionId] ?? 0) : null;
  const full = application.status !== "accepted" && slotsLeft === 0;

  const setStatus = updateApplicationStatus.bind(null, application.id);
  const decided = application.status === "accepted" || application.status === "declined";

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/recruitment/applications">← Applications</Link>
          <p className="portal-eyebrow">{application.referenceCode}</p>
          <h1>{application.name}</h1>
          <p className="portal-muted">
            Applied for {application.position}, {application.division} · Submitted {formatDate(application.submittedAt)} · Deleted automatically on {formatDate(deletionDate(application.submittedAt))}
          </p>
        </div>
        <span className={`portal-tag ${statusTag[application.status]} portal-status-tag`}>{applicationStatuses[application.status]}</span>
      </header>
      <Notice notice={notice} />

      <section className="portal-card portal-application-actions" aria-label="Actions">
        <div>
          <div className="portal-title-row">
            <strong>Result</strong>
            <InfoTip>
              The applicant sees any change when they track their application. Accepting takes one of the position’s slots; moving an applicant off Accepted gives it back.
            </InfoTip>
          </div>
          <p className="portal-muted">
            {application.statusUpdatedAt && application.statusUpdatedBy
              ? `Marked “${applicationStatuses[application.status]}” by ${application.statusUpdatedBy} on ${formatDate(application.statusUpdatedAt)}.`
              : "Pending review since it was submitted."}
          </p>
          {slotsLeft !== null && (
            <p className="portal-muted">
              {slotsLeft === 1 ? "1 slot" : `${slotsLeft} slots`} left for {application.position}
              {application.status === "accepted" ? ", besides the one this applicant holds." : full ? <>. Add one under <Link href="/portal/recruitment/slots">Recruitment → Slots</Link> to accept this applicant.</> : "."}
            </p>
          )}
        </div>
        <div className="portal-form-actions">
          <a className="portal-button is-ghost" href={emailLink(application)}><Mail size={15} /> Send email</a>
          <form action={setStatus} id="application-status" className="portal-application-status">
            {decided && <button className="portal-button is-ghost" type="submit" name="status" value="pending"><RotateCcw size={15} /> Back to pending</button>}
            <button className="portal-button is-danger-ghost" type="submit" name="status" value="declined" disabled={application.status === "declined"}><X size={15} /> Reject</button>
            <button className="portal-button is-ok" type="submit" name="status" value="accepted" disabled={application.status === "accepted" || full}><Check size={15} /> Accept</button>
          </form>
        </div>
        <label className="portal-check portal-application-notify">
          <input type="checkbox" name="notify" form="application-status" defaultChecked />
          <span><strong>Email the applicant about this result<InfoTip>Sent to {application.email} when you accept or reject. Use Send email for anything else.</InfoTip></strong></span>
        </label>
      </section>

      <div className="portal-application-grid">
        <section className="portal-card">
          <h2 className="portal-card-title">Applicant</h2>
          <dl className="portal-details">
            <Detail label="Last name">{application.lastName}</Detail>
            <Detail label="First name">{application.firstName}</Detail>
            <Detail label="Middle initial">{application.middleInitial}</Detail>
            <Detail label="Student number">{application.studentNumber}</Detail>
            <Detail label="UST email"><a href={`mailto:${application.email}`}>{application.email}</a></Detail>
            <Detail label="Mobile number"><a href={`tel:${application.contactNumber}`}>{application.contactNumber}</a></Detail>
            <Detail label="Facebook"><a href={application.facebookUrl} target="_blank" rel="noreferrer">Open profile <ExternalLink size={13} /></a></Detail>
            <Detail label="College or faculty">{application.college}</Detail>
            <Detail label="Program">{application.program}</Detail>
            <Detail label="Year level">{application.yearLevel}</Detail>
          </dl>
        </section>

        <div className="portal-application-stack">
          <section className="portal-card">
            <h2 className="portal-card-title">Application</h2>
            <dl className="portal-details">
              <Detail label="Serve in">{application.preferredBody}</Detail>
              <Detail label="Division">{application.division}</Detail>
              <Detail label="Position">{application.position}</Detail>
              <Detail label="Interview">{application.interview ?? "Not scheduled"}</Detail>
            </dl>
          </section>
          <section className="portal-card">
            <h2 className="portal-card-title">Documents</h2>
            <dl className="portal-details">
              <Detail label="CV or résumé"><FileLink href={application.cvUrl} /></Detail>
              <Detail label="Endorsement letter"><FileLink href={application.endorsementUrl} /></Detail>
              {application.portfolioUrl && <Detail label="Portfolio"><FileLink href={application.portfolioUrl} /></Detail>}
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
