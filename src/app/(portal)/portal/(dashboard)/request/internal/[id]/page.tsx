import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalUser } from "@/lib/auth/session";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { CommissionRequestAnswer } from "@/components/portal/commission-request-forms";
import { canAnswerCommissionRequest, canReadCommissionRequest } from "@/lib/portal/commission-requests";
import { getCommissionRequest } from "@/lib/portal/commission-requests-store";
import { formatSlot, requestModes, requestStatusLabel, requestStatusTone } from "@/lib/filing-portal/services";
import { unitName } from "@/lib/party-portal/types";
import "@/components/portal/commission-requests.css";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Unit request" };
export default async function UnitRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser();
  const { id } = await params;
  const request = await getCommissionRequest(id);
  if (!request || !canReadCommissionRequest(user, request) || !(user.tabs.includes("request") || (user.tabs.includes("request/create") && request.sender_email === user.email))) notFound();
  return <main className="portal-page">
    <Link className="portal-back" href={user.tabs.includes("request") ? "/portal/request" : "/portal/request/create"}>← {user.tabs.includes("request") ? "Approvals" : "Sent requests"}</Link>
    <header className="portal-page-head"><div><p className="portal-eyebrow">Requests · {request.reference}</p><TitleWithInfo info="Each receiving Local unit answers its copy independently. An answer saves only over the record you opened, and the sender is notified by email.">{request.subject}</TitleWithInfo><span className={`portal-tag ${requestStatusTone[request.status]}`}>{request.status === "confirmed" ? "Approved" : requestStatusLabel[request.status]}</span></div>{user.readOnly && <ViewOnlyTag />}</header>
    <section className="portal-card"><h2 className="portal-card-title">Request details</h2><dl className="portal-details">
      <div><dt>Type</dt><dd>{request.type_name}</dd></div><div><dt>From</dt><dd>{request.sender_name} · {request.sender_email}</dd></div><div><dt>To</dt><dd>{unitName(request.college)}</dd></div><div><dt>Asked for</dt><dd>{formatSlot(request.starts_at, request.ends_at)}</dd></div><div><dt>How</dt><dd>{requestModes[request.mode]}</dd></div><div><dt>Where</dt><dd>{request.venue}</dd></div>
    </dl><p className="fr-statement">{request.details}</p></section>
    {request.handled_at && <section className="portal-card"><h2 className="portal-card-title">The unit’s answer</h2><p className="fr-statement">{request.response || requestStatusLabel[request.status]}</p><p className="portal-muted">{request.handled_by} · {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(request.handled_at))}</p></section>}
    {user.tabs.includes("request") && canAnswerCommissionRequest(user, request) && (request.status === "requested" || request.status === "confirmed") && <CommissionRequestAnswer key={request.updated_at} request={request} />}
  </main>;
}
