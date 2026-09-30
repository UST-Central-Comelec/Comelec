import type { AccessRequest } from "@/lib/access-requests/admin";
import { accountRoles, affiliations } from "@/lib/data/types";
import { approveAccessRequest, declineAccessRequest } from "@/lib/portal/access-request-actions";

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/**
 * A portal access request waiting for an executive, as a row of the Accounts table. It came from
 * Request access on the sign-in page, and its email was verified with Google twice by the requester.
 * Approving adds the account as the role and affiliation picked, with the college they gave.
 * Executives are always Central, whatever is picked.
 */
export function AccessRequestRow({ request }: { request: AccessRequest }) {
  const approveForm = `approve-${request.id}`;
  return (
    <tr className="portal-request-row">
      <td>
        <span className="portal-row-title">{request.name}</span>
        <span className="portal-tag is-gold">Request</span>
        <small className="portal-muted">{request.email} · Verified with Google</small>
        <small className="portal-muted">{request.position} · {request.program}, {request.yearLevel}</small>
        <small className="portal-muted">{request.studentNumber}{request.contactNumber ? ` · ${request.contactNumber}` : ""} · {request.referenceCode} · Sent {formatDate(request.submittedAt)}</small>
      </td>
      <td>
        <select className="portal-input portal-request-role" name="role" form={approveForm} defaultValue="commissioner" aria-label={`Role for ${request.name}`}>
          {Object.entries(accountRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </td>
      <td>
        <select className="portal-input portal-request-role" name="affiliation" form={approveForm} defaultValue={request.affiliation} aria-label={`Affiliation for ${request.name}`}>
          {Object.entries(affiliations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <small className="portal-muted">{request.college}</small>
      </td>
      <td><span className="portal-tag is-gold">Pending</span></td>
      <td className="portal-row-actions">
        <div className="portal-request-actions">
          <form id={approveForm} action={approveAccessRequest.bind(null, request.id)}>
            <button className="portal-button is-ok is-small" type="submit">Approve</button>
          </form>
          <form action={declineAccessRequest.bind(null, request.id)}>
            <button className="portal-button is-danger-ghost is-small" type="submit">Decline</button>
          </form>
        </div>
      </td>
    </tr>
  );
}
