import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleSlash, Clock, FileText, MessageSquareText } from "lucide-react";
import { CandidacyDecisionForm, DocumentReviewForm, type Readiness } from "@/components/filing-portal/review-forms";
import { WithdrawCandidacyButton } from "@/components/portal/filing-review/account-actions";
import { DocumentBar } from "@/components/portal/filing-review/progress";
import { RecordTabs } from "@/components/portal/filing-review/tabs";
import { Timeline } from "@/components/portal/filing-review/timeline";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnly } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { decideCandidacyAction, reviewCandidacyDocumentAction } from "@/lib/candidacy/review-actions";
import { getCandidacy, listCandidacyDocuments } from "@/lib/candidacy/store";
import { councilOf, endorsementLabel, reachesUnit } from "@/lib/candidacy/types";
import { getAccount, listAccountNotices } from "@/lib/filing-portal/accounts";
import { filingStage } from "@/lib/filing-portal/tracking";
import { documentProgress, documentStatusLabel, documentStatusTone, fullName, stillToApprove } from "@/lib/filing-portal/types";
import { getParty } from "@/lib/party-portal/store";
import { canFieldCandidates, partyStanding, unitName, yearLevelLabel } from "@/lib/party-portal/types";
import { canReadParty } from "@/lib/polpar/store";
import "@/components/filing-portal/documents.css";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Candidacy filing" };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "");
const views = ["documents", "activity"] as const;
/** The candidate's notices that are about their candidacy, not their party membership or their account. */
const aboutCandidacy = (kind: string) => /^(endorsed|not-endorsed|document-|candidacy-)/.test(kind);

/** One candidate: their certificate and where it stands, the decision, each document to review, and what happened. */
export default async function PortalCandidacyPage({ params, searchParams }: PageProps<"/portal/candidacy/filings/[id]">) {
  const user = await requireAccess("candidacy/filings");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const candidacy = await getCandidacy(id);
  if (!candidacy || !canReadParty(user, candidacy.college)) notFound();
  const view = views.find((item) => item === query.view) ?? "documents";
  const [candidate, documents, notices, party] = await Promise.all([getAccount(candidacy.accountId), listCandidacyDocuments(candidacy.id), listAccountNotices(candidacy.accountId, 100), candidacy.partyId ? getParty(candidacy.partyId) : Promise.resolve(null)]);
  if (!candidate) notFound();

  const byRequirement = new Map(documents.map((item) => [item.requirement, item]));
  const progress = documentProgress(candidacyRequirements, documents);
  const stage = filingStage(candidacy, progress);
  const reaches = reachesUnit(candidacy);
  const pending = candidacy.status === "pending";
  const withdrawn = candidacy.status === "withdrawn";
  const partyLapsed = Boolean(candidacy.partyId) && (!party || !canFieldCandidates(party));
  const partyState = party ? partyStanding(party).label.toLowerCase() : "gone";
  const readiness: Readiness = {
    favourable: "qualified",
    blockers: partyLapsed ? [`${candidacy.partyName ?? "Their party"} isn’t accredited now (${partyState}), so they can’t be qualified as its candidate.`] : [],
    outstanding: [
      ...(progress.waiting ? [`${progress.waiting === 1 ? "A document is" : `${progress.waiting} documents are`} waiting for review.`] : []),
      ...(progress.missing.length ? [stillToApprove(progress)] : []),
    ],
    warnings: [],
  };
  const name = fullName(candidate);
  const base = `/portal/candidacy/filings/${candidacy.id}`;

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/candidacy/filings">← Filing of Candidacy applicants</Link>
          <TitleWithInfo info="Approve each document the candidate sends, or return it for revisions with what to change. When every required document is approved, decide whether they’re qualified. Record a withdrawal once they give the unit their sworn declaration. The candidate is notified and emailed each time.">{name}</TitleWithInfo>
          <p className="portal-muted">{candidacy.reference} · <span className={`portal-tag ${stage.tone}`}>{stage.label}</span> · {stage.next} · {candidacy.position}, {councilOf(candidacy.college)}</p>
        </div>
        {!user.readOnly && !withdrawn && <WithdrawCandidacyButton candidacyId={candidacy.id} name={name} />}
      </header>

      {withdrawn && (
        <div className="fr-banner" role="status">
          <CircleSlash size={17} aria-hidden="true" />
          <div><strong>Withdrawn{candidacy.withdrawnAt ? ` ${formatClosing(candidacy.withdrawnAt)}` : ""}{candidacy.withdrawnBy ? ` by ${candidacy.withdrawnBy === candidate.email ? "the candidate" : candidacy.withdrawnBy}` : ""}</strong><p>{candidacy.withdrawalReason || "They can file again while filing is open."}</p></div>
        </div>
      )}
      {!withdrawn && !reaches && (
        <div className="fr-banner is-info" role="status">
          <Clock size={17} aria-hidden="true" />
          <div>
            <strong>{candidacy.endorsement === "waiting" ? `Waiting for ${candidacy.partyName ?? "the party"}’s endorsement` : `${candidacy.partyName ?? "The party"} didn’t endorse this candidacy`}</strong>
            <p>{candidacy.endorsement === "waiting" ? "The party’s contact person endorses its candidates in the filing portal. The candidate can send documents, and you can review them, once they do." : "The candidate can withdraw this filing and file again as an independent before the period closes."}</p>
          </div>
        </div>
      )}
      {!withdrawn && reaches && partyLapsed && (
        <div className="fr-banner" role="status">
          <CircleSlash size={17} aria-hidden="true" />
          <div><strong>{candidacy.partyName ?? "Their party"} isn’t accredited now: it’s {partyState}</strong><p>They can’t be qualified as its candidate while it is. They can withdraw and file again as an independent.</p></div>
        </div>
      )}

      <div className="fr-summary">
        <section className="portal-card">
          <h2>Certificate of candidacy</h2>
          <dl className="portal-details">
            <div><dt>Filing ID</dt><dd>{candidacy.reference}</dd></div>
            <div><dt>Running for</dt><dd>{candidacy.position}, {councilOf(candidacy.college)}</dd></div>
            <div><dt>Filed with</dt><dd>{unitName(candidacy.college)}</dd></div>
            <div><dt>Party</dt><dd>{candidacy.partyId ? <><Link href={`/portal/polpar/registrations/parties/${candidacy.partyId}`}>{candidacy.partyName}</Link> · {endorsementLabel[candidacy.endorsement]}{candidacy.endorsedAt ? `, ${formatClosing(candidacy.endorsedAt)}` : ""}</> : "Independent"}</dd></div>
            <div><dt>Candidate</dt><dd><Link href={`/portal/candidacy/filings/accounts/${candidate.id}`}>{name}</Link><br /><small className="portal-muted">{candidate.studentNumber} · {candidate.college}{candidate.program ? `, ${candidate.program}` : ""} · {yearLevelLabel(candidate.yearLevel)}</small></dd></div>
            <div><dt>Contact</dt><dd>{candidate.mobileNumber} · <a href={`mailto:${candidate.email}`}>{candidate.email}</a></dd></div>
            <div><dt>Date of birth</dt><dd>{formatDate(candidacy.dateOfBirth)}</dd></div>
            <div><dt>Address</dt><dd>{candidacy.residence}</dd></div>
            <div><dt>Filed</dt><dd>{formatClosing(candidacy.createdAt)}</dd></div>
          </dl>
        </section>
        <section className="portal-card fr-decision">
          <h2>Decision</h2>
          {reaches && <DocumentBar progress={progress} large />}
          {withdrawn ? <p className="portal-muted">A withdrawn candidacy can’t be decided.</p> : !reaches ? <p className="portal-muted">You can decide once the filing reaches the unit.</p> : (
            <ViewOnly when={user.readOnly}>
              <CandidacyDecisionForm action={decideCandidacyAction.bind(null, candidacy.id)} status={candidacy.status} remarks={candidacy.decisionRemarks} readiness={readiness} />
            </ViewOnly>
          )}
          {candidacy.decidedAt && <p className="pp-review-meta">{candidacy.decisionOverride && candidacy.status === "qualified" ? "Qualified with documents outstanding" : "Last decided"} by {candidacy.decidedBy} · {formatClosing(candidacy.decidedAt)}</p>}
        </section>
      </div>

      <RecordTabs base={base} current={view} label="The filing’s records" scope={`candidacy-${candidacy.id}`} items={[
        { key: "documents", label: `Documents · ${progress.approved}/${progress.total}` },
        { key: "activity", label: "Activity" },
      ]} />

      {view === "documents" && (
        <div className="fr-section">
          {reaches && !pending && !withdrawn && <p className="portal-muted pp-locked" role="status">The candidacy has been decided, so its documents are locked. Reopen it for review to change a document’s review; the candidate can then change their files again.</p>}
          <ol className="pp-requirements">
            {candidacyRequirements.map((requirement, index) => {
              const document = byRequirement.get(requirement.id);
              const status = document?.status ?? "draft";
              const files = document?.files ?? [];
              const sent = status !== "draft";
              return (
                <li key={requirement.id} className="portal-card pp-requirement">
                  <div className="pp-requirement-head">
                    <span className="pp-requirement-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className="pp-requirement-title"><h2>{requirement.label}{requirement.optional && <small>Optional</small>}</h2><p>{requirement.hint}</p></div>
                    <span className={`portal-tag ${documentStatusTone[status]}`}>{sent ? (status === "changes" ? "Returned for revisions" : documentStatusLabel[status]) : files.length ? "Being put together" : "Nothing uploaded"}</span>
                  </div>
                  {files.length > 0 && (
                    <ul className="pp-files">
                      {files.map((file, fileIndex) => (
                        <li key={file.path}>
                          <FileText size={15} aria-hidden="true" />
                          <span className="pp-file-name"><a href={`${base}/files/${document!.id}/${fileIndex}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)} · {formatClosing(file.uploadedAt)}</small></span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {document?.submittedAt && <p className="pp-review-meta">Sent {formatClosing(document.submittedAt)}{document.reviewedAt ? ` · Reviewed by ${document.reviewedBy}, ${formatClosing(document.reviewedAt)}` : ""}</p>}
                  {document?.feedback && status !== "submitted" && (
                    <div className={`pp-feedback${status === "changes" ? " is-changes" : ""}`}>
                      <MessageSquareText size={16} aria-hidden="true" />
                      <div><strong>{status === "changes" ? "What to revise" : "Your note"}</strong><p>{document.feedback}</p></div>
                    </div>
                  )}
                  {document && files.length > 0 && sent && pending && reaches && (
                    <ViewOnly when={user.readOnly}>
                      <DocumentReviewForm action={reviewCandidacyDocumentAction.bind(null, candidacy.id, document.id, document.updatedAt)} status={status} feedback={document.feedback} filer="the candidate" />
                    </ViewOnly>
                  )}
                  {files.length > 0 && !sent && <p className="pp-review-meta">The candidate hasn’t sent this one for review yet.</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {view === "activity" && (
        <section className="portal-card">
          <h2 className="fr-card-title">What the candidate has been told</h2>
          <Timeline notices={notices.filter((item) => aboutCandidacy(item.kind))} empty="Nothing yet. The party’s endorsement, reviews and decisions show here." />
        </section>
      )}
    </main>
  );
}
