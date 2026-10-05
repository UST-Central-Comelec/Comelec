"use client";

import { useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Check, ExternalLink, X } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import type { ApplicationRecord } from "@/lib/applications/admin";
import { applicantDisplayName } from "@/lib/applications/name";
import { applicationStatuses, statusTag } from "@/lib/applications/status";
import { ApplicationQualifications } from "./application-qualifications";
import { ApplicationRetentionCountdown } from "./application-retention-countdown";
import { interviewModes, slotDate, slotTimeRange } from "@/lib/applications/interview-format";
import { deleteApplicationRecord, updateApplicationStatus } from "@/lib/portal/application-actions";
import { onboardApplication } from "@/lib/portal/account-actions";
import { ReviewModalDetailsGroup, ReviewModalHeader, ReviewModalToolbar } from "./review-modal-ui";
import { InfoTip } from "@/components/portal/info-tip";
import "./event-workflows.css";

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children || <span className="portal-muted">Not provided</span>}</dd></div>;
}

function FileLink({ href }: { href: string | null }) {
  return href?.trim() ? <a href={href} target="_blank" rel="noreferrer">Google Drive Link <ExternalLink size={13} /></a> : <span className="portal-muted">No Submission</span>;
}

function DetailGroup({ title, number, children }: {
  title: string;
  number: string;
  children: React.ReactNode;
}) {
  return <ReviewModalDetailsGroup title={title} number={number}>{children}</ReviewModalDetailsGroup>;
}

export function ApplicationDetailsView({ application, slotsLeft, readOnly, canOnboard, notice, modalTitleId }: {
  application: ApplicationRecord;
  slotsLeft: number | null;
  readOnly: boolean;
  canOnboard: boolean;
  notice?: string | string[];
  modalTitleId: string;
}) {
  const [view, setView] = useState<"details" | "qualifications" | "documents" | "logs">("details");
  const statusDialog = useRef<HTMLDialogElement>(null);
  const statusTitleId = useId();
  const statusDescriptionId = useId();
  const [proposedStatus, setProposedStatus] = useState<"accepted" | "declined">("accepted");
  const [notifyApplicant, setNotifyApplicant] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [actionNotice, setActionNotice] = useState<string>();
  const [updatingStatus, startStatusTransition] = useTransition();
  const updatingStatusRef = useRef(false);
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const confirmationTitleId = useId();
  const confirmationDescriptionId = useId();
  const [confirmationError, setConfirmationError] = useState("");
  const [deleting, startDeleteTransition] = useTransition();
  const deletingRef = useRef(false);
  const [onboarding, startOnboardingTransition] = useTransition();
  const onboardingRef = useRef(false);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const full = application.status !== "accepted" && slotsLeft === 0;

  const setStatus = updateApplicationStatus.bind(null, application.id);
  const decided = application.status === "accepted" || application.status === "declined";
  const interview = application.interviewDetails;

  function openStatusConfirmation(status: "accepted" | "declined") {
    setProposedStatus(status);
    setNotifyApplicant(true);
    setStatusError("");
    statusDialog.current?.showModal();
  }

  function confirmStatus(formData: FormData) {
    if (updatingStatusRef.current) return;
    updatingStatusRef.current = true;
    setStatusError("");
    startStatusTransition(async () => {
      try {
        setActionNotice(await setStatus(formData));
        statusDialog.current?.close();
      } catch (error) {
        unstable_rethrow(error);
        setStatusError("Couldn’t update the application. Please try again.");
      } finally {
        updatingStatusRef.current = false;
      }
    });
  }

  function confirmDeletion() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setConfirmationError("");
    startDeleteTransition(async () => {
      try {
        await deleteApplicationRecord(application.id);
        confirmationDialog.current?.close();
      } catch (error) {
        unstable_rethrow(error);
        setConfirmationError("Couldn’t delete the application. Please try again.");
      } finally {
        deletingRef.current = false;
      }
    });
  }

  function onboard() {
    if (onboardingRef.current || onboarded) return;
    onboardingRef.current = true;
    setOnboardingError("");
    startOnboardingTransition(async () => {
      try {
        const result = await onboardApplication(application.id);
        if (result?.error) {
          setOnboardingError([result.error, ...Object.values(result.fieldErrors ?? {})].join(" "));
        } else {
          setOnboarded(true);
          setActionNotice("application-onboarded");
        }
      } catch (error) {
        unstable_rethrow(error);
        setOnboardingError("Couldn’t onboard the applicant. Please try again.");
      } finally {
        onboardingRef.current = false;
      }
    });
  }

  const profile = (
    <DetailGroup title="Profile" number="01">
      <Detail label="Last name">{application.lastName}</Detail>
      <Detail label="First name">{application.firstName}</Detail>
      <Detail label="Middle name">{application.middleName}</Detail>
      <Detail label="UST email"><a href={`mailto:${application.email}`}>{application.email}</a></Detail>
      <Detail label="Student number">{application.studentNumber}</Detail>
      <Detail label="Mobile number">{application.contactNumber && <a href={`tel:${application.contactNumber}`}>{application.contactNumber}</a>}</Detail>
      <Detail label="Facebook"><a href={application.facebookUrl} target="_blank" rel="noreferrer">Open profile <ExternalLink size={13} /></a></Detail>
      <Detail label="College or faculty">{application.college}</Detail>
      <Detail label="Program">{application.program}</Detail>
      <Detail label="Year level">{application.yearLevel}</Detail>
    </DetailGroup>
  );
  const applicationFacts = (
    <DetailGroup title="Application" number="02">
      <Detail label="Serve in">{application.preferredBody}</Detail>
      <Detail label="Division">{application.division}</Detail>
      <Detail label="Position">{application.position}</Detail>
      <Detail label="Interview date">{interview ? slotDate(interview.startsAt) : "Not scheduled"}</Detail>
      <Detail label="Interview time">{interview ? slotTimeRange(interview.startsAt, interview.durationMinutes) : "Not scheduled"}</Detail>
      <Detail label="Mode">{interview ? interviewModes[interview.mode] : "Not scheduled"}</Detail>
    </DetailGroup>
  );
  const qualifications = (
    <section className="portal-registrant-group">
      <h3><span>03</span>Qualifications</h3>
      <ApplicationQualifications key={application.id} declared={application.conflicts} />
    </section>
  );
  const documents = (
    <DetailGroup title="Documents" number="04">
      <Detail label="CV or résumé"><FileLink href={application.cvUrl} /></Detail>
      <Detail label="Latest Registration Form"><FileLink href={application.registrationFormUrl} /></Detail>
      <Detail label="Letter of Intent"><FileLink href={application.letterOfIntentUrl} /></Detail>
      <Detail label="Recommendation Letter"><FileLink href={application.endorsementUrl} /></Detail>
      <Detail label="Portfolio"><FileLink href={application.portfolioUrl} /></Detail>
      <Detail label="Latest Copy of Grades"><FileLink href={application.gradesUrl} /></Detail>
    </DetailGroup>
  );


  const logItems = [
    { at: application.submittedAt, action: "Application submitted" },
    ...(application.statusUpdatedAt ? [{
      at: application.statusUpdatedAt,
      action: `Marked “${applicationStatuses[application.status]}”${application.statusUpdatedBy ? ` by ${application.statusUpdatedBy}` : ""}`,
    }] : []),
    ...application.emailLogs.map((email) => ({
      at: email.sentAt,
      action: email.kind === "acknowledgement" ? "Acknowledgement email successfully sent" : `Result email successfully sent (${email.kind === "accepted" ? "Accepted" : "Rejected"})`,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <article className="portal-registrant-receipt portal-application-receipt">
      <ReviewModalHeader titleId={modalTitleId} name={applicantDisplayName(application)} date={formatDate(application.submittedAt)} dateAside={<ApplicationRetentionCountdown submittedAt={application.submittedAt} />} reference={application.referenceCode} status={<span className={`portal-tag ${statusTag[application.status]} portal-application-status-tag`}>{application.status === "pending" ? "Pending" : applicationStatuses[application.status]}</span>} />
      <ReviewModalToolbar label="Applicant details view" active={view} onChange={setView} items={[
          { key: "details", label: "Application Details" },
          { key: "qualifications", label: "Qualifications" },
          { key: "documents", label: "Documents" },
          { key: "logs", label: "Logs" },
        ]} actions={!readOnly ? <>
          {!decided && <div className="portal-application-status">
            <button className="portal-registrant-action-button" type="button" onClick={() => openStatusConfirmation("accepted")} disabled={full}><Check size={15} /> Accept</button>
            <button className="portal-registrant-action-button" type="button" onClick={() => openStatusConfirmation("declined")}><X size={15} /> Reject</button>
          </div>}
          <button type="button" className="portal-registrant-action-button" disabled={deleting || onboarding} onClick={() => {
            setConfirmationError("");
            confirmationDialog.current?.showModal();
          }}>Delete application</button>
          {application.status === "accepted" && <button type="button" className="portal-registrant-action-button portal-application-onboard" disabled={!canOnboard || onboarding || onboarded || deleting} title={!canOnboard ? "Account management access is required to onboard applicants." : undefined} onClick={onboard}>{onboarding ? "Onboarding…" : onboarded ? "Onboarded" : "Onboard"}</button>}
        </> : undefined} />
      <div className="portal-registrant-receipt-body">
        <Notice notice={actionNotice ?? notice} />
        {onboardingError && <p className="portal-form-error" role="alert">{onboardingError}</p>}
        <div className="portal-registrant-groups">
          {view === "details" && <>
            {profile}
            {applicationFacts}
          </>}
          {view === "qualifications" && qualifications}
          {view === "documents" && documents}
          {view === "logs" && <section className="portal-registrant-group is-profile portal-application-logs" aria-label="Application logs">
            <h3>Logs</h3>
            {!application.emailLogsAvailable && <p className="portal-muted">Email send history is currently unavailable.</p>}
            <div className="portal-table-wrap">
              <table className="portal-table portal-application-log-table" aria-label="Applicant activity">
                <thead><tr><th scope="col">Date</th><th scope="col">Time</th><th scope="col">Action Item</th></tr></thead>
                <tbody>
                  {logItems.map((item, index) => (
                    <tr key={`${item.at}-${index}`}>
                      <td>{new Date(item.at).toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" })}</td>
                      <td>{new Date(item.at).toLocaleTimeString("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" })}</td>
                      <td>{item.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>}
        </div>
      </div>
      {!readOnly && <dialog
        ref={statusDialog}
        className="portal-registrant-confirmation"
        aria-labelledby={statusTitleId}
        aria-describedby={statusDescriptionId}
        onCancel={(event) => {
          event.stopPropagation();
          if (updatingStatus) event.preventDefault();
        }}
      >
        <h2 id={statusTitleId}>{proposedStatus === "accepted" ? "Accept" : "Reject"} application?</h2>
        <p id={statusDescriptionId}>Mark <strong>{applicantDisplayName(application)}</strong>’s application as {proposedStatus === "accepted" ? "accepted" : "rejected"}?{proposedStatus === "accepted" && " This will take one of the position’s slots."}</p>
        <form action={confirmStatus} className="portal-application-result-confirmation" aria-busy={updatingStatus}>
          <input type="hidden" name="status" value={proposedStatus} />
          <label className="portal-check">
            <input type="checkbox" name="notify" checked={notifyApplicant} onChange={(event) => setNotifyApplicant(event.target.checked)} disabled={updatingStatus} />
            <span>Email the applicant about this result<InfoTip>Sent to {application.email} when you confirm.</InfoTip></span>
          </label>
          {statusError && <p className="portal-form-error" role="alert">{statusError}</p>}
          <div className="portal-registrant-confirmation-actions">
            <button type="button" className="portal-registrant-action-button" disabled={updatingStatus} autoFocus onClick={() => statusDialog.current?.close()}>Cancel</button>
            <button type="submit" className="portal-registrant-action-button" disabled={updatingStatus || (proposedStatus === "accepted" && full)}>{updatingStatus ? "Saving…" : proposedStatus === "accepted" ? "Accept application" : "Reject application"}</button>
          </div>
        </form>
      </dialog>}
      {!readOnly && <dialog
        ref={confirmationDialog}
        className="portal-registrant-confirmation"
        aria-labelledby={confirmationTitleId}
        aria-describedby={confirmationDescriptionId}
        onCancel={(event) => {
          event.stopPropagation();
          if (deleting) event.preventDefault();
        }}
      >
        <h2 id={confirmationTitleId}>Delete application?</h2>
        <p id={confirmationDescriptionId}>This will permanently delete <strong>{applicantDisplayName(application)}</strong>’s application. This can’t be undone.{application.status === "accepted" && " Their slot stays taken."}</p>
        {confirmationError && <p className="portal-form-error" role="alert">{confirmationError}</p>}
        <div className="portal-registrant-confirmation-actions">
          <button type="button" className="portal-registrant-action-button" disabled={deleting} autoFocus onClick={() => confirmationDialog.current?.close()}>Cancel</button>
          <button type="button" className="portal-registrant-action-button" disabled={deleting} onClick={confirmDeletion}>{deleting ? "Deleting…" : "Delete application"}</button>
        </div>
      </dialog>}
    </article>
  );
}
