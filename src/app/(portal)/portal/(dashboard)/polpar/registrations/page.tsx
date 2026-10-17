import { ViewIcon as ActionViewIcon } from "@/components/action-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { requireAccess } from "@/lib/auth/session";
import { listPartyRegistrations } from "@/lib/polpar/store";
import { listPartiesForUnit } from "@/lib/party-portal/store";
import { partyStatusLabel, partyStatusTone, unitName } from "@/lib/party-portal/types";
import { requirements } from "@/lib/polpar/content";
import { settle } from "@/lib/portal/settle";
import { formatClosing } from "@/lib/applications/period";
import "@/components/filing-portal/documents.css";

export const metadata: Metadata = { title: "Party registrations" };

/**
 * The parties registering through the filing portal, each with its members and documents, and
 * below them the one-step online submissions filed before it. A Local unit sees its
 * own college's.
 */
export default async function PortalPartyRegistrationsPage() {
  const user = await requireAccess("polpar/registrations");
  const local = user.affiliation === "local";
  const [{ value: parties }, { value: earlier }] = await Promise.all([
    settle(local && !user.college ? Promise.resolve([]) : listPartiesForUnit(local ? user.college : null)),
    settle(listPartyRegistrations()),
  ]);

  return <main className="portal-page is-wide">
    <header className="portal-page-head">
      <div>
        <p className="portal-eyebrow">Political Party</p>
        <TitleWithInfo info="Each party’s members make their accounts on the Political Party Registration page, then upload the party’s documents in the filing portal. Review each document here, then accredit or decline the party. The party’s members are emailed and notified each time.">Registrations</TitleWithInfo>
        <p className="portal-muted">{local ? user.college : "Central and Local Commission registrations"}</p>
      </div>
      <Link className="portal-button is-ghost" href="/party-registration" target="_blank"><ActionViewIcon size={15} aria-hidden="true" />View registration page</Link>
    </header>

    {parties === null ? <p className="portal-form-error" role="alert">Couldn’t load the parties. Check that migration 20261017190000_party_portal.sql has been applied.</p> : (
      <section className="portal-card is-flush">
        {!parties.length ? <p className="portal-empty">No party has registered through the filing portal yet.</p> : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Political party</th><th>Commission unit</th><th>Status</th><th>Documents</th><th>Members</th><th>Registered</th></tr></thead>
              <tbody>
                {parties.map((party) => (
                  <tr key={party.id}>
                    <td><Link className="portal-row-title" href={`/portal/polpar/registrations/parties/${party.id}`}>{party.name}</Link></td>
                    <td>{unitName(party.college)}</td>
                    <td><span className={`portal-tag ${partyStatusTone[party.status]}`}>{partyStatusLabel[party.status]}</span></td>
                    <td>{party.approved} of {requirements.length} approved{party.waiting > 0 && <small className="portal-muted"><span className="portal-tag is-gold">{party.waiting} waiting for review</span></small>}</td>
                    <td>{party.members}{party.requests > 0 && <small className="portal-muted">{party.requests} asking to join</small>}</td>
                    <td>{formatClosing(party.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )}

    {earlier !== null && earlier.length > 0 && (
      <section className="portal-card is-flush pp-earlier">
        <div className="pp-card-head is-padded"><h2>Earlier online submissions</h2><span className="portal-muted">Filed in one step, before the filing portal</span></div>
        <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Political party</th><th>Commission unit</th><th>Contact email</th><th>Submitted</th><th>Review</th></tr></thead><tbody>{earlier.map((row) => <tr key={row.id}><td><Link className="portal-row-title" href={`/portal/polpar/registrations/${row.id}`}>{row.party_name}</Link><small className="portal-muted">{row.reference}</small></td><td>{row.college || "Central Comelec"}</td><td>{row.email}</td><td>{formatClosing(row.created_at)}</td><td><Link href={`/portal/polpar/registrations/${row.id}`}>Open application</Link></td></tr>)}</tbody></table></div>
      </section>
    )}
  </main>;
}
