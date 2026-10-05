"use client";

import type { AccessRequest } from "@/lib/access-requests/admin";
import { unitAbbreviations } from "@/lib/applications/options";
import { accountPositions, affiliations, type Affiliation, type CommissionerPosition } from "@/lib/data/types";
import { approveAccessRequest, declineAccessRequest } from "@/lib/portal/access-request-actions";
import { grantableCommissionerPositions, type Manager } from "@/lib/portal/account-scope";
import { Dropdown, optionsOf } from "./dropdown";
import { useHydrated } from "./portal-form";
import { RoleSelect, useRoleChoice } from "./role-field";

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/**
 * A portal access request waiting to be decided, as a row of the Accounts table. It came from
 * Request access on the sign-in page, and its email was verified with Google twice by the requester.
 * Approving adds a commissioner's account with the details they gave, as the affiliation, position
 * and role picked here (they start as what the requester said). `manager` is whoever is deciding:
 * they can only give out positions up to their own, and a Local manager only adds to its own Local
 * Comelec. With no `manager` (an Adviser or Admin reading the list) the row only shows the request.
 */
export function AccessRequestRow({ request, manager }: { request: AccessRequest; manager: Manager | null }) {
  const hydrated = useHydrated();
  const localManager = manager?.affiliation === "local";
  const start: Affiliation = localManager ? "local" : request.affiliation;
  const { affiliation, setAffiliation, position, setPosition, role, setRole, options } = useRoleChoice({
    affiliation: start,
    position: request.position && (!manager || grantableCommissionerPositions(manager, start).includes(request.position)) ? request.position : "",
    role: request.role,
  });
  const positions: CommissionerPosition[] = manager && affiliation ? grantableCommissionerPositions(manager, affiliation) : [];
  // A request sent before positions were asked for says what they do in their own words.
  const ownWords = request.position === null;

  return (
    <tr className="portal-request-row">
      <td>
        <span className="portal-row-title">{request.lastName}, {request.firstName} {request.middleInitial}.</span>
        <span className="portal-tag is-gold">Request</span>
        <small className="portal-muted">{request.email} · Verified with Google</small>
        <small className="portal-muted">{request.referenceCode} · Sent {formatDate(request.submittedAt)}{request.contactNumber ? ` · ${request.contactNumber}` : ""}</small>
      </td>
      <td>
        {request.studentNumber}
      </td>
      <td>
        {!manager || localManager ? affiliations[start] : <Dropdown size="pill" label={`Affiliation for ${request.name}`} value={affiliation} onChange={(next) => setAffiliation(next as Affiliation)} options={optionsOf(affiliations)} disabled={!hydrated} />}
        <small className="portal-muted" title={request.college}>{unitAbbreviations[request.college] ?? request.college}</small>
      </td>
      <td>
        {manager ? (
          <div className="portal-request-picks">
            <Dropdown size="pill" label={`Position for ${request.name}`} value={position} onChange={(next) => setPosition(next as CommissionerPosition)} options={positions.map((value) => ({ value, label: accountPositions[value] }))} placeholder="Select position" disabled={!hydrated} />
            <RoleSelect size="pill" position={position} role={role} options={options} onChange={setRole} label={`Role for ${request.name}`} disabled={!hydrated} />
          </div>
        ) : (
          <>
            {request.position ? accountPositions[request.position] : "Not said"}
            {!ownWords && <small className="portal-muted">{request.role}</small>}
          </>
        )}
        {ownWords && <small className="portal-muted">They wrote: “{request.role}”</small>}
      </td>
      <td><span className="portal-tag is-gold">Pending</span></td>
      <td className="portal-row-actions">
        {manager && (
          <div className="portal-request-actions">
            {/* What's picked in the row goes with the form. */}
            <form action={approveAccessRequest.bind(null, request.id)}>
              <input type="hidden" name="affiliation" value={affiliation} />
              <input type="hidden" name="position" value={position} />
              <input type="hidden" name="role" value={role} />
              <button className="portal-button is-ok is-small" type="submit" disabled={!hydrated}>Approve</button>
            </form>
            <form action={declineAccessRequest.bind(null, request.id)}>
              <button className="portal-button is-danger-ghost is-small" type="submit">Decline</button>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}
