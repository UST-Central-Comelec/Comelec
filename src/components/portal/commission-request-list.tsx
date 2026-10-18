import Link from "next/link";
import { formatSlot, requestModes, requestStatusLabel, requestStatusTone } from "@/lib/filing-portal/services";
import { unitName } from "@/lib/party-portal/types";
import type { CommissionRequest } from "@/lib/portal/commission-requests";

export function CommissionRequestList({ requests, sent = false }: { requests: CommissionRequest[]; sent?: boolean }) {
  return requests.length ? <div className="portal-table-wrap"><table className="portal-table fr-table"><thead><tr><th>Request</th><th>{sent ? "Sent to" : "From"}</th><th>Asked for</th><th>Status</th></tr></thead><tbody>
    {requests.map(request => <tr key={request.id}>
      <td><Link className="portal-row-title" href={`/portal/request/internal/${request.id}`}>{request.subject}</Link><small className="fr-sub">{request.reference} · {request.type_name}</small></td>
      <td>{sent ? unitName(request.college) : request.sender_name}<small className="fr-sub">{sent ? "Local unit" : `${request.sender_email} · To ${unitName(request.college)}`}</small></td>
      <td>{formatSlot(request.starts_at, request.ends_at)}<small className="fr-sub">{requestModes[request.mode]} · {request.venue}</small></td>
      <td><span className={`portal-tag ${requestStatusTone[request.status]}`}>{request.status === "confirmed" ? "Approved" : requestStatusLabel[request.status]}</span></td>
    </tr>)}
  </tbody></table></div> : <p className="portal-empty">{sent ? "You haven’t sent any requests to Local units." : "No unit-to-unit requests in this view."}</p>;
}

export function CommissionRequestLoadError() {
  return <p className="portal-form-error" role="alert">Unit-to-unit requests need a database update: apply supabase/migrations/20261018155022_commission_requests.sql, then reload.</p>;
}
