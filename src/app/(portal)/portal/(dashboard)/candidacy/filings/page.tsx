import type { Metadata } from "next";
import Link from "next/link";
import { ViewIcon as ActionViewIcon } from "@/components/action-icons";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { formatClosing } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { listCandidaciesForUnit } from "@/lib/candidacy/store";
import { candidacyStatusLabel, candidacyStatusTone, councilOf, reachesUnit } from "@/lib/candidacy/types";
import { fullName } from "@/lib/filing-portal/types";
import { settle } from "@/lib/portal/settle";
import "@/components/filing-portal/documents.css";

export const metadata: Metadata = { title: "Candidacy filings" };

/**
 * The certificates of candidacy filed through the filing portal, newest first. One running under a
 * party opens for review once the party endorses it; until then it's listed, waiting. A Local unit
 * sees its own college's.
 */
export default async function PortalCandidacyFilingsPage() {
  const user = await requireAccess("candidacy/filings");
  const local = user.affiliation === "local";
  const { value: filings } = await settle(local && !user.college ? Promise.resolve([]) : listCandidaciesForUnit(local ? user.college : null));

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing of Candidacy</p>
          <TitleWithInfo info="Candidates file on the Filing of Candidacy page, then upload their documents in the filing portal. One running under a party reaches you once the party’s contact person endorses them. Review each document, then decide whether they’re qualified; the candidate is emailed and notified each time.">Filings</TitleWithInfo>
          <p className="portal-muted">{local ? user.college : "Central and Local Commission filings"}</p>
        </div>
        <Link className="portal-button is-ghost" href="/candidacy" target="_blank"><ActionViewIcon size={15} aria-hidden="true" />View filing page</Link>
      </header>

      {filings === null ? <p className="portal-form-error" role="alert">Couldn’t load the filings. Check that migration 20261017210000_candidacy_filing.sql has been applied.</p> : (
        <section className="portal-card is-flush">
          {!filings.length ? <p className="portal-empty">No candidacy has been filed yet.</p> : (
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead><tr><th>Candidate</th><th>Running for</th><th>Party</th><th>Status</th><th>Documents</th><th>Filed</th></tr></thead>
                <tbody>
                  {filings.map((filing) => {
                    const open = reachesUnit(filing);
                    return (
                      <tr key={filing.id}>
                        <td>{open ? <Link className="portal-row-title" href={`/portal/candidacy/filings/${filing.id}`}>{fullName(filing.account)}</Link> : <span className="portal-row-title">{fullName(filing.account)}</span>}<small className="portal-muted">{filing.account.college}</small></td>
                        <td>{filing.position}<small className="portal-muted">{councilOf(filing.college)}</small></td>
                        <td>{filing.partyName ?? "Independent"}</td>
                        <td>{open ? <span className={`portal-tag ${candidacyStatusTone[filing.status]}`}>{candidacyStatusLabel[filing.status]}</span> : <span className={`portal-tag${filing.endorsement === "declined" ? " is-warn" : ""}`}>{filing.endorsement === "declined" ? "Not endorsed by the party" : "Waiting for the party"}</span>}</td>
                        <td>{open ? <>{filing.approved} of {candidacyRequirements.length} approved{filing.waiting > 0 && <small className="portal-muted"><span className="portal-tag is-gold">{filing.waiting} waiting for review</span></small>}</> : "—"}</td>
                        <td>{formatClosing(filing.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
