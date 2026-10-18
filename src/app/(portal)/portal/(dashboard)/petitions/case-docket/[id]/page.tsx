import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MessageSquareText } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { PetitionActions } from "@/components/portal/filing-review/service-actions";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { formatEventDate } from "@/lib/events/format";
import { getAccount } from "@/lib/filing-portal/accounts";
import { PETITION_DEADLINE_SCHOOL_DAYS, isLateFiling, manilaParts, petitionStatusLabel, petitionStatusTone, petitionTypes, schoolDaysBetween } from "@/lib/filing-portal/services";
import { movePetitionAction } from "@/lib/filing-portal/services-review-actions";
import { getPetition } from "@/lib/filing-portal/services-store";
import { fullName } from "@/lib/filing-portal/types";
import { unitName, yearLevelLabel } from "@/lib/party-portal/types";
import { canReadParty } from "@/lib/polpar/store";
import "@/components/filing-portal/documents.css";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Petition" };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;

/** One petition on the docket: what's alleged, by whom and against whom, its evidence, and where it stands. */
export default async function PortalPetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("petitions/case-docket");
  const { id } = await params;
  const petition = await getPetition(id);
  if (!petition || !canReadParty(user, petition.college)) notFound();
  const filer = await getAccount(petition.accountId);
  if (!filer) notFound();
  const type = petitionTypes[petition.type];
  const filedOn = manilaParts(petition.createdAt)[0];
  const late = isLateFiling(petition, filedOn);
  const live = petition.status !== "withdrawn";
  const act = (status: "docketed" | "resolved" | "dismissed") => movePetitionAction.bind(null, petition.id, petition.updatedAt, status);

  return (
    <main className="portal-page fr-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/petitions/case-docket">← Case Docket</Link>
          <TitleWithInfo info={`${type.label} (${type.basis}). Docket it to take it up, and serve a copy on whoever it’s against, who answers in writing within five school days. Decide within five school days of the answer: resolve it, or dismiss it. The filer is notified and emailed each time.`}>{petition.subject}</TitleWithInfo>
          <p className="portal-muted">{petition.reference} · <span className={`portal-tag ${petitionStatusTone[petition.status]}`}>{petition.status === "filed" ? "To docket" : petitionStatusLabel[petition.status].split(",")[0]}</span> · {type.label} · {unitName(petition.college)}</p>
        </div>
        {user.readOnly ? <ViewOnlyTag /> : live && <PetitionActions status={petition.status as "filed" | "docketed" | "resolved" | "dismissed"} docket={act("docketed")} resolve={act("resolved")} dismiss={act("dismissed")} />}
      </header>

      {late && (
        <div className="fr-banner" role="status">
          <MessageSquareText size={17} aria-hidden="true" />
          <div><strong>Filed {schoolDaysBetween(petition.occurredOn, filedOn)} school days after what happened</strong><p>Election protests and offenses are filed within {PETITION_DEADLINE_SCHOOL_DAYS} school days of the event (Elections Code, Article XII, Section 4).</p></div>
        </div>
      )}

      <div className="fr-summary">
        <section className="portal-card">
          <h2>The petition</h2>
          <dl className="portal-details">
            <div><dt>Type</dt><dd>{type.label} · {type.basis}</dd></div>
            <div><dt>Against</dt><dd>{petition.respondent || "No one named"}</dd></div>
            <div><dt>When it happened</dt><dd>{petition.occurredOn ? formatEventDate(petition.occurredOn) : "Not given"}</dd></div>
            <div><dt>Filed</dt><dd>{formatClosing(petition.createdAt)}</dd></div>
            {petition.docketedAt && <div><dt>Docketed</dt><dd>{formatClosing(petition.docketedAt)}{petition.docketedBy ? `, by ${petition.docketedBy}` : ""}</dd></div>}
            {petition.decidedAt && (petition.status === "resolved" || petition.status === "dismissed") && <div><dt>{petition.status === "resolved" ? "Resolved" : "Dismissed"}</dt><dd>{formatClosing(petition.decidedAt)}{petition.decidedBy ? `, by ${petition.decidedBy}` : ""}</dd></div>}
            {petition.withdrawnAt && <div><dt>Withdrawn</dt><dd>{formatClosing(petition.withdrawnAt)}, by the filer</dd></div>}
          </dl>
        </section>
        <section className="portal-card">
          <h2>Filed by</h2>
          <dl className="portal-details">
            <div><dt>Name</dt><dd>{fullName(filer)}</dd></div>
            <div><dt>Contact</dt><dd>{filer.email} · {filer.mobileNumber}</dd></div>
            <div><dt>Student number</dt><dd>{filer.studentNumber}</dd></div>
            <div><dt>College or faculty</dt><dd>{filer.college}{filer.program ? `, ${filer.program}` : ""}</dd></div>
            <div><dt>Year level</dt><dd>{yearLevelLabel(filer.yearLevel)}</dd></div>
          </dl>
          <p className="portal-muted">They certified that what they wrote is true and correct.</p>
        </section>
      </div>

      <section className="portal-card fr-section">
        <h2 className="fr-card-title">What happened</h2>
        <p className="fr-statement">{petition.statement}</p>
        {petition.relief && <><h2 className="fr-card-title">What they ask</h2><p className="fr-statement">{petition.relief}</p></>}
        <h2 className="fr-card-title">Evidence</h2>
        {petition.files.length ? (
          <ul className="pp-files" aria-label="Evidence">
            {petition.files.map((file, index) => <li key={file.path}><FileText size={15} aria-hidden="true" /><span className="pp-file-name"><a href={`/portal/petitions/case-docket/${petition.id}/files/${index}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)} · {formatClosing(file.uploadedAt)}</small></span></li>)}
          </ul>
        ) : <p className="portal-muted">None attached.</p>}
      </section>

      {petition.remarks && (
        <section className="portal-card">
          <div className="pp-feedback"><MessageSquareText size={16} aria-hidden="true" /><div><strong>The unit’s remarks, as the filer reads them</strong><p>{petition.remarks}</p></div></div>
        </section>
      )}
    </main>
  );
}
