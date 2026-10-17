import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MessageSquareText } from "lucide-react";
import { CandidacyDecisionForm, DocumentReviewForm } from "@/components/filing-portal/review-forms";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnly } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { decideCandidacyAction, reviewCandidacyDocumentAction } from "@/lib/candidacy/review-actions";
import { getCandidacy, listCandidacyDocuments } from "@/lib/candidacy/store";
import { candidacyStatusLabel, candidacyStatusTone, councilOf, endorsementLabel, reachesUnit } from "@/lib/candidacy/types";
import { getAccount } from "@/lib/filing-portal/accounts";
import { documentStatusLabel, documentStatusTone, fullName } from "@/lib/filing-portal/types";
import { unitName, yearLevelLabel } from "@/lib/party-portal/types";
import { canReadParty } from "@/lib/polpar/store";
import "@/components/filing-portal/documents.css";

export const metadata: Metadata = { title: "Candidacy filing" };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "");

/** One candidate: their certificate and profile, each document to review, and the decision. */
export default async function PortalCandidacyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("candidacy/filings");
  const candidacy = await getCandidacy((await params).id);
  if (!candidacy || !canReadParty(user, candidacy.college) || !reachesUnit(candidacy)) notFound();
  const [candidate, documents] = await Promise.all([getAccount(candidacy.accountId), listCandidacyDocuments(candidacy.id)]);
  if (!candidate) notFound();
  const byRequirement = new Map(documents.map((item) => [item.requirement, item]));
  const approved = documents.filter((item) => item.status === "approved").length;
  const facebook = /^https?:\/\//i.test(candidate.facebookUrl) ? candidate.facebookUrl : `https://${candidate.facebookUrl}`;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing of Candidacy · {unitName(candidacy.college)}</p>
          <TitleWithInfo info="Review each document the candidate sends: approve it, or send it back with what to change. When everything is in order, decide whether they’re qualified. The candidate is emailed and notified each time.">{fullName(candidate)}</TitleWithInfo>
          <p className="portal-muted"><span className={`portal-tag ${candidacyStatusTone[candidacy.status]}`}>{candidacyStatusLabel[candidacy.status]}</span> · {candidacy.position}, {councilOf(candidacy.college)} · {approved} of {candidacyRequirements.length} documents approved</p>
        </div>
        <Link className="portal-button is-ghost" href="/portal/candidacy/filings">All filings</Link>
      </header>

      <div className="pp-review-grid">
        <section className="portal-card">
          <h2>Certificate of candidacy</h2>
          <dl className="portal-details">
            <div><dt>Running for</dt><dd>{candidacy.position}, {councilOf(candidacy.college)}</dd></div>
            <div><dt>Party</dt><dd>{candidacy.partyName ? `${candidacy.partyName} · ${endorsementLabel[candidacy.endorsement]}` : "Independent"}</dd></div>
            <div><dt>Date of birth</dt><dd>{formatDate(candidacy.dateOfBirth)}</dd></div>
            <div><dt>Address</dt><dd>{candidacy.residence}</dd></div>
            <div><dt>Contact</dt><dd>{candidate.mobileNumber} · <a href={`mailto:${candidate.email}`}>{candidate.email}</a></dd></div>
            <div><dt>Student</dt><dd>{candidate.studentNumber} · {candidate.college}{candidate.program ? `, ${candidate.program}` : ""} · {yearLevelLabel(candidate.yearLevel)}</dd></div>
            <div><dt>Facebook</dt><dd><a href={facebook} target="_blank" rel="noopener noreferrer">Profile</a></dd></div>
            <div><dt>Filed</dt><dd>{formatClosing(candidacy.createdAt)}{candidacy.endorsedAt ? ` · endorsed ${formatClosing(candidacy.endorsedAt)}` : ""}</dd></div>
          </dl>
        </section>
        <section className="portal-card">
          <h2>Decision</h2>
          <ViewOnly when={user.readOnly}>
            <CandidacyDecisionForm action={decideCandidacyAction.bind(null, candidacy.id)} status={candidacy.status} remarks={candidacy.decisionRemarks} />
          </ViewOnly>
          {candidacy.decidedAt && <p className="pp-review-meta">Last decided by {candidacy.decidedBy} · {formatClosing(candidacy.decidedAt)}</p>}
        </section>
      </div>

      <h2 className="pp-section-title">Documents</h2>
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
                <div className="pp-requirement-title"><h2>{requirement.label}{requirement.optional && <small> Optional</small>}</h2><p>{requirement.hint}</p></div>
                <span className={`portal-tag ${documentStatusTone[status]}`}>{sent ? documentStatusLabel[status] : files.length ? "Being put together" : "Nothing uploaded"}</span>
              </div>
              {files.length > 0 && (
                <ul className="pp-files">
                  {files.map((file, fileIndex) => (
                    <li key={file.path}>
                      <FileText size={15} aria-hidden="true" />
                      <span className="pp-file-name"><a href={`/portal/candidacy/filings/${candidacy.id}/files/${document!.id}/${fileIndex}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)} · {formatClosing(file.uploadedAt)}</small></span>
                    </li>
                  ))}
                </ul>
              )}
              {document?.submittedAt && <p className="pp-review-meta">Sent {formatClosing(document.submittedAt)}{document.reviewedAt ? ` · Reviewed by ${document.reviewedBy}, ${formatClosing(document.reviewedAt)}` : ""}</p>}
              {document?.feedback && status !== "submitted" && (
                <div className={`pp-feedback${status === "changes" ? " is-changes" : ""}`}>
                  <MessageSquareText size={16} aria-hidden="true" />
                  <div><strong>{status === "changes" ? "Changes asked" : "Your note"}</strong><p>{document.feedback}</p></div>
                </div>
              )}
              {document && files.length > 0 && sent && (
                <ViewOnly when={user.readOnly}>
                  <DocumentReviewForm action={reviewCandidacyDocumentAction.bind(null, candidacy.id, document.id)} status={status} feedback={document.feedback} filer="the candidate" />
                </ViewOnly>
              )}
              {files.length > 0 && !sent && <p className="pp-review-meta">The candidate hasn’t sent this one for review yet.</p>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
