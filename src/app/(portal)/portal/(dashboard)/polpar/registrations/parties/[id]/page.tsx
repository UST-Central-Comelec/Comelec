import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CirclePause, CircleSlash, FileText, MessageSquareText } from "lucide-react";
import { DocumentReviewForm, PartyDecisionForm, type Readiness } from "@/components/filing-portal/review-forms";
import { MemberActions, SanctionActions, WithdrawPartyButton } from "@/components/portal/filing-review/party-actions";
import { DocumentBar } from "@/components/portal/filing-review/progress";
import { RecordTabs } from "@/components/portal/filing-review/tabs";
import { Timeline } from "@/components/portal/filing-review/timeline";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnly } from "@/components/portal/view-only";
import { requireAccess } from "@/lib/auth/session";
import { formatClosing } from "@/lib/applications/period";
import { listPartyCandidates } from "@/lib/candidacy/store";
import { candidacyStatusLabel, candidacyStatusTone, councilOf, endorsementLabel } from "@/lib/candidacy/types";
import { partyStage } from "@/lib/filing-portal/tracking";
import { documentProgress, documentStatusLabel, documentStatusTone, fullName, stillToApprove } from "@/lib/filing-portal/types";
import { templateHref } from "@/lib/polpar/content";
import { canReadParty } from "@/lib/polpar/store";
import { getParty, listMemberHistory, listPartyActivity, listSubmissions } from "@/lib/party-portal/store";
import { decidePartyRegistration, reviewPartyDocument } from "@/lib/party-portal/review-actions";
import { canFieldCandidates, partyRequirements, partyStatusLabel, unitName, yearLevelLabel } from "@/lib/party-portal/types";
import "@/components/filing-portal/documents.css";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Party registration" };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "");
const facebookHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const views = ["documents", "members", "candidates", "activity"] as const;

/** One party: where it stands and the decision, then its documents to review, its members, its candidates and what happened. */
export default async function PortalPartyPage({ params, searchParams }: PageProps<"/portal/polpar/registrations/parties/[id]">) {
  const user = await requireAccess("polpar/registrations");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const party = await getParty(id);
  if (!party || !canReadParty(user, party.college)) notFound();
  const view = views.find((item) => item === query.view) ?? "documents";
  const [members, submissions, candidates, activity] = await Promise.all([listMemberHistory(party.id), listSubmissions(party.id), listPartyCandidates(party.id), listPartyActivity(party.id)]);

  const current = members.filter((item) => item.status === "active" || item.status === "requested");
  const active = current.filter((item) => item.status === "active");
  const past = members.filter((item) => item.status === "removed" || item.status === "declined");
  const contact = members.find((item) => item.id === party.contactMemberId && item.status === "active");
  const byRequirement = new Map(submissions.map((item) => [item.requirement, item]));
  const progress = documentProgress(partyRequirements, submissions);
  const stage = partyStage(party, progress);
  const pending = party.status === "pending" && !party.sanction;
  const withdrawn = party.status === "withdrawn";
  const editable = !user.readOnly && !withdrawn;
  const endorsed = candidates.filter((item) => item.endorsement === "endorsed").length;
  const readiness: Readiness = {
    favourable: "accredited",
    blockers: contact ? [] : ["Make one of its members the contact person first."],
    outstanding: [
      ...(progress.waiting ? [`${progress.waiting === 1 ? "A document is" : `${progress.waiting} documents are`} waiting for review.`] : []),
      ...(progress.missing.length ? [stillToApprove(progress)] : []),
    ],
    warnings: party.status === "accredited" && endorsed ? [`${endorsed === 1 ? "One candidate runs" : `${endorsed} candidates run`} under this party. Reopening or declining it leaves them without an accredited party.`] : [],
  };
  const base = `/portal/polpar/registrations/parties/${party.id}`;

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/polpar/registrations">← Political Party applicants</Link>
          <TitleWithInfo info="Approve each document the party sends, or return it for revisions with what to change. When every required document is approved, accredit the party. Manage its members under Members. Its members are notified and emailed each time.">{party.name}</TitleWithInfo>
          <p className="portal-muted">{party.reference} · <span className={`portal-tag ${stage.tone}`}>{stage.label}</span> · {stage.next} · {unitName(party.college)}</p>
        </div>
        {editable && party.sanction !== "blacklisted" && <WithdrawPartyButton partyId={party.id} name={party.name} members={current.length} />}
      </header>

      {withdrawn && (
        <div className="fr-banner" role="status">
          <CircleSlash size={17} aria-hidden="true" />
          <div><strong>Withdrawn{party.withdrawnAt ? ` ${formatClosing(party.withdrawnAt)}` : ""}{party.withdrawnBy ? ` by ${party.withdrawnBy}` : ""}</strong><p>{party.withdrawalReason || "Its members and name are free."}</p></div>
        </div>
      )}

      {party.sanction && (
        <div className="fr-banner" role="status">
          {party.sanction === "blacklisted" ? <Ban size={17} aria-hidden="true" /> : <CirclePause size={17} aria-hidden="true" />}
          <div>
            <strong>{party.sanction === "blacklisted" ? "Blacklisted" : "Suspended"}{party.sanctionedAt ? ` ${formatClosing(party.sanctionedAt)}` : ""}{party.sanctionedBy ? ` by ${party.sanctionedBy}` : ""}</strong>
            <p>{party.sanctionReason}{"\n"}{party.sanction === "blacklisted" ? "It can’t take members, endorse or field candidates, or change its documents, and its name stays taken." : "It can’t take members or endorse candidates, and its candidates can’t be qualified, until it’s lifted."} Underneath, it’s {partyStatusLabel[party.status].toLowerCase()}.</p>
          </div>
        </div>
      )}

      <div className="fr-summary">
        <section className="portal-card">
          <h2>Party</h2>
          <dl className="portal-details">
            <div><dt>Party ID</dt><dd>{party.reference}</dd></div>
            <div><dt>Registering with</dt><dd>{unitName(party.college)}</dd></div>
            <div><dt>Established</dt><dd>{formatDate(party.establishedAt)}</dd></div>
            <div><dt>Headquarters</dt><dd>{party.headquarters || "Not given"}</dd></div>
            <div><dt>Contact person</dt><dd>{contact ? <>{fullName(contact)}<br /><small className="portal-muted">{contact.mobileNumber} · <a href={`mailto:${contact.email}`}>{contact.email}</a></small></> : withdrawn ? "None" : "None. Make a member the contact person under Members."}</dd></div>
            <div><dt>Members</dt><dd>{active.length}{current.length > active.length ? ` · ${current.length - active.length} asking to join` : ""}</dd></div>
            <div><dt>Candidates</dt><dd>{candidates.length ? `${candidates.length} · ${endorsed} endorsed` : "None"}</dd></div>
            <div><dt>Registered</dt><dd>{formatClosing(party.createdAt)}</dd></div>
          </dl>
        </section>
        <section className="portal-card fr-decision">
          <h2>Decision</h2>
          <DocumentBar progress={progress} large />
          {withdrawn ? <p className="portal-muted">A withdrawn registration can’t be decided.</p> : party.sanction ? (
            <p className="portal-muted">The party is {party.sanction}. Lift the {party.sanction === "blacklisted" ? "blacklisting" : "suspension"} below to change its decision.</p>
          ) : (
            <ViewOnly when={user.readOnly}>
              <PartyDecisionForm action={decidePartyRegistration.bind(null, party.id)} status={party.status} remarks={party.decisionRemarks} readiness={readiness} />
            </ViewOnly>
          )}
          {party.decidedAt && <p className="pp-review-meta">{party.decisionOverride && party.status === "accredited" ? "Accredited with documents outstanding" : "Last decided"} by {party.decidedBy} · {formatClosing(party.decidedAt)}</p>}
          {!withdrawn && !user.readOnly && <SanctionActions partyId={party.id} name={party.name} status={party.status} sanction={party.sanction} />}
        </section>
      </div>

      <RecordTabs base={base} current={view} label="The party’s records" scope={`party-${party.id}`} items={[
        { key: "documents", label: `Documents · ${progress.approved}/${progress.total}` },
        { key: "members", label: `Members · ${active.length}` },
        { key: "candidates", label: `Candidates · ${candidates.length}` },
        { key: "activity", label: "Activity" },
      ]} />

      {view === "documents" && (
        <div className="fr-section">
          {party.sanction && <p className="portal-muted pp-locked" role="status">The party is {party.sanction}, so its documents are locked until it’s lifted.</p>}
          {!party.sanction && !pending && !withdrawn && <p className="portal-muted pp-locked" role="status">The registration has been decided, so its documents are locked. Reopen it for review to change a document’s review; the party can then change its files again.</p>}
          <ol className="pp-requirements">
            {partyRequirements.map((requirement, index) => {
              const submission = byRequirement.get(requirement.id);
              const status = submission?.status ?? "draft";
              const files = submission?.files ?? [];
              const sent = status !== "draft";
              return (
                <li key={requirement.id} className="portal-card pp-requirement">
                  <div className="pp-requirement-head">
                    <span className="pp-requirement-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className="pp-requirement-title">
                      <h2>{requirement.label}{requirement.optional && <small>Optional</small>}</h2>
                      <p>{requirement.hint}{requirement.template && <> <a className="fr-template-link" href={templateHref(requirement.template)} download>Template</a></>}</p>
                    </div>
                    <span className={`portal-tag ${documentStatusTone[status]}`}>{sent ? (status === "changes" ? "Returned for revisions" : documentStatusLabel[status]) : files.length ? "Being put together" : "Nothing uploaded"}</span>
                  </div>
                  {files.length > 0 && (
                    <ul className="pp-files">
                      {files.map((file, fileIndex) => (
                        <li key={file.path}>
                          <FileText size={15} aria-hidden="true" />
                          <span className="pp-file-name"><a href={`${base}/files/${submission!.id}/${fileIndex}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)} · {file.uploadedBy}, {formatClosing(file.uploadedAt)}</small></span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {submission?.submittedAt && <p className="pp-review-meta">Sent by {submission.submittedBy} · {formatClosing(submission.submittedAt)}{submission.reviewedAt ? ` · Reviewed by ${submission.reviewedBy}, ${formatClosing(submission.reviewedAt)}` : ""}</p>}
                  {submission?.feedback && status !== "submitted" && (
                    <div className={`pp-feedback${status === "changes" ? " is-changes" : ""}`}>
                      <MessageSquareText size={16} aria-hidden="true" />
                      <div><strong>{status === "changes" ? "What to revise" : "Your note"}</strong><p>{submission.feedback}</p></div>
                    </div>
                  )}
                  {submission && files.length > 0 && sent && pending && (
                    <ViewOnly when={user.readOnly}>
                      <DocumentReviewForm action={reviewPartyDocument.bind(null, party.id, submission.id, submission.updatedAt)} status={status} feedback={submission.feedback} filer="the party" />
                    </ViewOnly>
                  )}
                  {files.length > 0 && !sent && <p className="pp-review-meta">The party hasn’t sent this one for review yet.</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {view === "members" && (
        <div className="fr-section">
          <section className="portal-card is-flush fr-people">
            <div className="pp-card-head is-padded"><h2>Members and requests</h2><span className="portal-muted">The contact person approves who joins, in the filing portal</span></div>
            {!current.length ? <p className="portal-empty">{withdrawn ? "The registration was withdrawn, so nobody is in the party now." : "Nobody is in the party."}</p> : (
              <div className="portal-table-wrap">
                <table className="portal-table fr-table">
                  <thead><tr><th>Name</th><th>College or faculty</th><th>Student number</th><th>Mobile number</th><th>Place</th><th><span className="portal-visually-hidden">Actions</span></th></tr></thead>
                  <tbody>
                    {current.map((person) => (
                      <tr key={person.id}>
                        <td>{person.accountId ? <Link className="portal-row-title" href={`/portal/polpar/registrations/accounts/${person.accountId}`}>{fullName(person)}</Link> : <span className="portal-row-title">{fullName(person)}</span>}<small>{person.email} · <a href={facebookHref(person.facebookUrl)} target="_blank" rel="noopener noreferrer">Facebook</a></small></td>
                        <td>{person.college}<small>{[person.program, yearLevelLabel(person.yearLevel)].filter(Boolean).join(" · ")}</small></td>
                        <td>{person.studentNumber}</td>
                        <td>{person.mobileNumber}</td>
                        <td><span className={`portal-tag${person.status === "requested" ? " is-gold" : person.id === party.contactMemberId ? " is-ok" : ""}`}>{person.status === "requested" ? "Asking to join" : person.id === party.contactMemberId ? "Contact person" : "Member"}</span><small>Since {formatClosing(person.createdAt)}</small></td>
                        <td>{editable ? <MemberActions partyId={party.id} memberId={person.id} name={fullName(person)} status={person.status as "requested" | "active"} isContact={person.id === party.contactMemberId} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section className="portal-card is-flush fr-people">
              <div className="pp-card-head is-padded"><h2>Left or turned away</h2><span className="portal-muted">{past.length}</span></div>
              <div className="portal-table-wrap">
                <table className="portal-table fr-table">
                  <thead><tr><th>Name</th><th>College or faculty</th><th>What happened</th><th>When</th></tr></thead>
                  <tbody>
                    {past.map((person) => (
                      <tr key={person.id} className="fr-muted-row">
                        <td>{person.accountId ? <Link className="portal-row-title" href={`/portal/polpar/registrations/accounts/${person.accountId}`}>{fullName(person)}</Link> : <span className="portal-row-title">{fullName(person)}</span>}<small>{person.email}</small></td>
                        <td>{person.college}</td>
                        <td>{person.status === "declined" ? `Request declined${person.decidedBy ? ` by ${person.decidedBy}` : ""}` : `Removed${person.removedBy ? ` by ${person.removedBy}` : ""}`}{person.removalReason && <small>{person.removalReason}</small>}</td>
                        <td>{formatClosing(person.removedAt ?? person.decidedAt ?? person.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {view === "candidates" && (
        <section className="portal-card is-flush">
          <div className="pp-card-head is-padded"><h2>Candidates under this party</h2><span className="portal-muted">The contact person endorses them, in the filing portal</span></div>
          {!candidates.length ? <p className="portal-empty">{canFieldCandidates(party) ? "No member has filed a candidacy under this party yet." : "Only an accredited party that isn’t suspended or blacklisted fields candidates."}</p> : (
            <div className="portal-table-wrap">
              <table className="portal-table fr-table">
                <thead><tr><th>Candidate</th><th>Running for</th><th>Endorsement</th><th>Status</th><th>Filed</th></tr></thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id}>
                      <td><Link className="portal-row-title" href={`/portal/candidacy/filings/${candidate.id}`}>{fullName(candidate.account)}</Link><small>{candidate.reference} · {candidate.account.studentNumber}</small></td>
                      <td>{candidate.position}<small>{councilOf(candidate.college)}</small></td>
                      <td><span className={`portal-tag${candidate.endorsement === "endorsed" ? " is-ok" : candidate.endorsement === "declined" ? " is-warn" : ""}`}>{endorsementLabel[candidate.endorsement].replace(" by the party", "")}</span></td>
                      <td><span className={`portal-tag ${candidacyStatusTone[candidate.status]}`}>{candidacyStatusLabel[candidate.status]}</span></td>
                      <td>{formatClosing(candidate.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === "activity" && (
        <section className="portal-card">
          <h2 className="fr-card-title">What happened</h2>
          <Timeline notices={activity} empty="Nothing yet. Documents sent, reviews, decisions and members joining show here." />
        </section>
      )}
    </main>
  );
}
