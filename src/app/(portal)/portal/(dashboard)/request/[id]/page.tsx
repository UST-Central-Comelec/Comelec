import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ConfirmRequestDialog, DeclineRequest, MarkRequestDone } from "@/components/portal/filing-review/service-actions";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { getAccount } from "@/lib/filing-portal/accounts";
import { formatSlot, isOpenRequest, manilaParts, onBehalfLabels, requestKinds, requestModes, requestStatusLabel, requestStatusTone, topicLabel } from "@/lib/filing-portal/services";
import { closeRequestAction, confirmRequestAction } from "@/lib/filing-portal/services-review-actions";
import { getRequest } from "@/lib/filing-portal/services-store";
import { fullName } from "@/lib/filing-portal/types";
import { unitName, yearLevelLabel } from "@/lib/party-portal/types";
import { canReadParty } from "@/lib/polpar/store";
import "@/components/filing-portal/documents.css";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Request" };

/** One consultation or commissioner request: what was asked, who asked, and the unit's answer. */
export default async function PortalRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("request");
  const { id } = await params;
  const request = await getRequest(id);
  if (!request || !canReadParty(user, request.college)) notFound();
  const filer = await getAccount(request.accountId);
  if (!filer) notFound();
  const name = fullName(filer);
  const noun = requestKinds[request.kind].noun;
  const answerable = request.status === "requested" || (request.status === "confirmed" && isOpenRequest(request));
  const [startDate, startTime] = manilaParts(request.confirmedStart ?? request.startsAt);
  const [, endTime] = manilaParts(request.confirmedEnd ?? request.endsAt);

  return (
    <main className="portal-page fr-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/request">← Requests</Link>
          <TitleWithInfo info={request.kind === "consultation" ? "A consultation booked in the filing portal. Confirm it with a time, a room or meeting link and who meets them, or decline it with a reason. Mark it done once it’s happened." : "A request for a commissioner at an activity. Confirm it with who goes, or decline it with a reason. Mark it done once it’s happened."}>{request.subject}</TitleWithInfo>
          <p className="portal-muted">{request.reference} · <span className={`portal-tag ${requestStatusTone[request.status]}`}>{request.status === "requested" ? "Waiting for you" : requestStatusLabel[request.status]}</span> · {noun[0].toUpperCase() + noun.slice(1)} · {unitName(request.college)}</p>
        </div>
        {user.readOnly ? <ViewOnlyTag /> : answerable && (
          <span className="fr-actions">
            <ConfirmRequestDialog action={confirmRequestAction.bind(null, request.id, request.updatedAt)} kind={request.kind} mode={request.mode} changing={request.status === "confirmed"}
              initial={{ date: startDate, start: startTime, end: endTime, location: request.location || (request.kind === "commissioner" ? request.venue : ""), assigned: request.assigned, response: request.response }} />
            {request.status === "confirmed" && <MarkRequestDone action={closeRequestAction.bind(null, request.id, request.updatedAt, "done")} />}
            <DeclineRequest kind={request.kind} action={closeRequestAction.bind(null, request.id, request.updatedAt, "declined")} />
          </span>
        )}
      </header>

      <div className="fr-summary">
        <section className="portal-card">
          <h2>What they asked</h2>
          <dl className="portal-details">
            <div><dt>{request.kind === "consultation" ? "Topic" : "The commissioner is asked to"}</dt><dd>{topicLabel(request)}</dd></div>
            <div><dt>Asked for</dt><dd>{formatSlot(request.startsAt, request.endsAt)}</dd></div>
            <div><dt>How</dt><dd>{requestModes[request.mode]}{request.venue ? ` · ${request.venue}` : ""}</dd></div>
            <div><dt>For</dt><dd>{request.onBehalf === "party" && request.partyName ? `${onBehalfLabels.party}: ${request.partyName}` : onBehalfLabels[request.onBehalf]}</dd></div>
            <div><dt>Sent</dt><dd>{formatClosing(request.createdAt)}</dd></div>
            {request.cancelledAt && <div><dt>Cancelled</dt><dd>{formatClosing(request.cancelledAt)}, by the filer</dd></div>}
          </dl>
          {request.details && <p className="fr-statement">{request.details}</p>}
        </section>
        <section className="portal-card">
          <h2>From</h2>
          <dl className="portal-details">
            <div><dt>Name</dt><dd>{name}</dd></div>
            <div><dt>Contact</dt><dd>{filer.email} · {filer.mobileNumber}</dd></div>
            <div><dt>Student number</dt><dd>{filer.studentNumber}</dd></div>
            <div><dt>College or faculty</dt><dd>{filer.college}{filer.program ? `, ${filer.program}` : ""}</dd></div>
            <div><dt>Year level</dt><dd>{yearLevelLabel(filer.yearLevel)}</dd></div>
          </dl>
        </section>
      </div>

      {(request.confirmedStart || request.response) && (
        <section className="portal-card">
          <h2 className="fr-card-title">The unit’s answer</h2>
          {request.confirmedStart && (
            <dl className="portal-details">
              <div><dt>Confirmed</dt><dd>{formatSlot(request.confirmedStart, request.confirmedEnd ?? request.endsAt)}</dd></div>
              {request.location && <div><dt>Where</dt><dd>{request.location}</dd></div>}
              {request.assigned && <div><dt>{request.kind === "consultation" ? "Who meets them" : "Commissioner"}</dt><dd>{request.assigned}</dd></div>}
            </dl>
          )}
          {request.response && <div className="pp-feedback"><MessageSquareText size={16} aria-hidden="true" /><div><strong>Note to the filer</strong><p>{request.response}</p>{request.handledAt && <small>{request.handledBy ? `${request.handledBy}, ` : ""}{formatClosing(request.handledAt)}</small>}</div></div>}
        </section>
      )}
    </main>
  );
}
