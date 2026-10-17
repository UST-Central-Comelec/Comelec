import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MessageSquareText } from "lucide-react";
import { DocumentReviewForm, PartyDecisionForm } from "@/components/filing-portal/review-forms";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnly } from "@/components/portal/view-only";
import { requireAccess } from "@/lib/auth/session";
import { formatClosing } from "@/lib/applications/period";
import { requirements } from "@/lib/polpar/content";
import { canReadParty } from "@/lib/polpar/store";
import { getParty, listMembers, listSubmissions } from "@/lib/party-portal/store";
import { decidePartyRegistration, reviewPartyDocument } from "@/lib/party-portal/review-actions";
import { partyStatusLabel, partyStatusTone, unitName, yearLevelLabel } from "@/lib/party-portal/types";
import { documentStatusLabel, documentStatusTone, fullName } from "@/lib/filing-portal/types";
import "@/components/filing-portal/documents.css";

export const metadata: Metadata = { title: "Party registration" };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "");

/** One party: its details and members, each document to review, and the decision on the party. */
export default async function PortalPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("polpar/registrations");
  const party = await getParty((await params).id);
  if (!party || !canReadParty(user, party.college)) notFound();
  const [members, submissions] = await Promise.all([listMembers(party.id), listSubmissions(party.id)]);
  const active = members.filter((item) => item.status === "active");
  const contact = members.find((item) => item.id === party.contactMemberId);
  const byRequirement = new Map(submissions.map((item) => [item.requirement, item]));
  const approved = submissions.filter((item) => item.status === "approved").length;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Political Party · {unitName(party.college)}</p>
          <TitleWithInfo info="Review each document the party sends: approve it, or send it back with what to change. When everything is in order, accredit the party. Its members are emailed and notified each time.">{party.name}</TitleWithInfo>
          <p className="portal-muted"><span className={`portal-tag ${partyStatusTone[party.status]}`}>{partyStatusLabel[party.status]}</span> · {approved} of {requirements.length} documents approved</p>
        </div>
        <Link className="portal-button is-ghost" href="/portal/polpar/registrations">All registrations</Link>
      </header>

      <div className="pp-review-grid">
        <section className="portal-card">
          <h2>Party</h2>
          <dl className="portal-details">
            <div><dt>Registering with</dt><dd>{unitName(party.college)}</dd></div>
            <div><dt>Established</dt><dd>{formatDate(party.establishedAt)}</dd></div>
            <div><dt>Headquarters</dt><dd>{party.headquarters || "Not given"}</dd></div>
            <div><dt>Contact person</dt><dd>{contact ? <>{fullName(contact)}<br />{contact.mobileNumber} · <a href={`mailto:${contact.email}`}>{contact.email}</a></> : "Not named"}</dd></div>
            <div><dt>Registered</dt><dd>{formatClosing(party.createdAt)}</dd></div>
          </dl>
        </section>
        <section className="portal-card">
          <h2>Decision</h2>
          <ViewOnly when={user.readOnly}>
            <PartyDecisionForm action={decidePartyRegistration.bind(null, party.id)} status={party.status} remarks={party.decisionRemarks} />
          </ViewOnly>
          {party.decidedAt && <p className="pp-review-meta">Last decided by {party.decidedBy} · {formatClosing(party.decidedAt)}</p>}
        </section>
      </div>

      <section className="portal-card is-flush pp-members-card">
        <div className="pp-card-head is-padded"><h2>Members · {active.length}</h2>{members.length > active.length && <span className="portal-muted">{members.length - active.length} asking to join</span>}</div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Name</th><th>College or faculty</th><th>Student number</th><th>Mobile number</th><th>Facebook</th><th>Role</th></tr></thead>
            <tbody>
              {members.map((person) => (
                <tr key={person.id}>
                  <td><span className="portal-row-title">{fullName(person)}</span><small className="portal-muted">{person.email}</small></td>
                  <td>{person.college}<small className="portal-muted">{[person.program, yearLevelLabel(person.yearLevel)].filter(Boolean).join(" · ")}</small></td>
                  <td>{person.studentNumber}</td>
                  <td>{person.mobileNumber}</td>
                  <td><a href={/^https?:\/\//i.test(person.facebookUrl) ? person.facebookUrl : `https://${person.facebookUrl}`} target="_blank" rel="noopener noreferrer">Profile</a></td>
                  <td><span className={`portal-tag${person.status === "requested" ? " is-gold" : ""}`}>{person.status === "requested" ? "Asking to join" : person.role === "contact" ? "Contact person" : "Member"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className="pp-section-title">Documents</h2>
      <ol className="pp-requirements">
        {requirements.map((requirement, index) => {
          const submission = byRequirement.get(requirement.id);
          const status = submission?.status ?? "draft";
          const files = submission?.files ?? [];
          const sent = status !== "draft";
          return (
            <li key={requirement.id} className="portal-card pp-requirement">
              <div className="pp-requirement-head">
                <span className="pp-requirement-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div className="pp-requirement-title"><h2>{requirement.label}</h2><p>{requirement.hint}</p></div>
                <span className={`portal-tag ${documentStatusTone[status]}`}>{sent ? documentStatusLabel[status] : files.length ? "Being put together" : "Nothing uploaded"}</span>
              </div>
              {files.length > 0 && (
                <ul className="pp-files">
                  {files.map((file, fileIndex) => (
                    <li key={file.path}>
                      <FileText size={15} aria-hidden="true" />
                      <span className="pp-file-name"><a href={`/portal/polpar/registrations/parties/${party.id}/files/${submission!.id}/${fileIndex}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)} · {file.uploadedBy}, {formatClosing(file.uploadedAt)}</small></span>
                    </li>
                  ))}
                </ul>
              )}
              {submission?.submittedAt && <p className="pp-review-meta">Sent by {submission.submittedBy} · {formatClosing(submission.submittedAt)}{submission.reviewedAt ? ` · Reviewed by ${submission.reviewedBy}, ${formatClosing(submission.reviewedAt)}` : ""}</p>}
              {submission?.feedback && status !== "submitted" && (
                <div className={`pp-feedback${status === "changes" ? " is-changes" : ""}`}>
                  <MessageSquareText size={16} aria-hidden="true" />
                  <div><strong>{status === "changes" ? "Changes asked" : "Your note"}</strong><p>{submission.feedback}</p></div>
                </div>
              )}
              {submission && files.length > 0 && sent && (
                <ViewOnly when={user.readOnly}>
                  <DocumentReviewForm action={reviewPartyDocument.bind(null, party.id, submission.id)} status={status} feedback={submission.feedback} filer="the party" />
                </ViewOnly>
              )}
              {files.length > 0 && !sent && <p className="pp-review-meta">The party hasn’t sent this one for review yet.</p>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
