import type { Metadata } from "next";
import Link from "next/link";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { requireAccess } from "@/lib/auth/session";
import { formatClosing } from "@/lib/applications/period";
import { listPartiesForUnit } from "@/lib/party-portal/store";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/filing-review.css";
import "@/components/filing-portal/documents.css";

export const metadata: Metadata = { title: "Accredited parties" };

const byName = new Intl.Collator("en-PH", { sensitivity: "base" });

/**
 * The parties accredited through the filing portal, by unit: who to reach, how many members, and
 * the candidates each fields. Candidates file under these on the Filing of Candidacy page. A Local
 * unit sees its own college's.
 */
export default async function PortalAccreditedPartiesPage() {
  const user = await requireAccess("polpar/accredited-parties");
  const local = user.affiliation === "local";
  const { value: parties, error } = await settle(local && !user.college ? Promise.resolve([]) : listPartiesForUnit(local ? user.college : null));
  // Suspended parties keep their accreditation, so they're listed with a tag; blacklisted ones aren't.
  const accredited = (parties ?? []).filter((party) => party.status === "accredited" && party.sanction !== "blacklisted")
    .sort((a, b) => (a.college === b.college ? byName.compare(a.name, b.name) : a.college === "" ? -1 : b.college === "" ? 1 : byName.compare(a.college, b.college)));
  const units = new Set(accredited.map((party) => party.college));

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Political Party</p>
          <TitleWithInfo info="Parties accredited under Applicants. Each one’s members can file candidacies under it on the Filing of Candidacy page, and its contact person endorses them. A suspended party is listed but can’t field or endorse candidates until it’s lifted; a blacklisted one isn’t listed. To take back an accreditation, open the party and reopen or decline it.">Accredited parties</TitleWithInfo>
          <p className="portal-muted">{local ? unitName(user.college ?? "") : "Every unit’s accredited parties"}</p>
        </div>
      </header>

      {error ? <p className="portal-form-error" role="alert">Couldn’t load the parties. Reload the page. ({error})</p> : (
        <>
          <dl className="portal-kpis fr-kpis">
            <div className="is-lead"><dt>Accredited</dt><dd>{accredited.length}{accredited.some((party) => party.sanction) && <small>{accredited.filter((party) => party.sanction).length} suspended</small>}</dd></div>
            {!local && <div><dt>Units</dt><dd>{units.size}</dd></div>}
            <div><dt>Members</dt><dd>{accredited.reduce((sum, party) => sum + party.members, 0)}</dd></div>
            <div><dt>Candidates endorsed</dt><dd>{accredited.reduce((sum, party) => sum + party.endorsed, 0)}</dd></div>
            <div><dt>Candidates qualified</dt><dd>{accredited.reduce((sum, party) => sum + party.qualified, 0)}</dd></div>
          </dl>
          <section className="portal-card is-flush">
            {!accredited.length ? <p className="portal-empty">No party is accredited yet. Accredit one from <Link href="/portal/polpar/registrations?stage=ready">Applicants</Link> once every required document is approved.</p> : (
              <div className="portal-table-wrap">
                <table className="portal-table fr-table">
                  <thead><tr><th>Political party</th>{!local && <th>Unit</th>}<th>Contact person</th><th>Members</th><th>Candidates</th><th>Accredited</th></tr></thead>
                  <tbody>
                    {accredited.map((party) => (
                      <tr key={party.id}>
                        <td><Link className="portal-row-title" href={`/portal/polpar/registrations/parties/${party.id}`}>{party.name}</Link><small>{party.reference}</small>{party.sanction === "suspended" && <small><span className="portal-tag is-warn">Suspended</span></small>}{party.decisionOverride && <small>Accredited with documents outstanding</small>}</td>
                        {!local && <td>{unitName(party.college)}</td>}
                        <td>{party.contact ? <>{party.contact.name}<small><a href={`mailto:${party.contact.email}`}>{party.contact.email}</a></small></> : <span className="fr-flag">None</span>}</td>
                        <td>{party.members}</td>
                        <td>{party.candidates ? <Link href={`/portal/polpar/registrations/parties/${party.id}?view=candidates`}>{party.candidates}</Link> : 0}{party.candidates > 0 && <small>{party.endorsed} endorsed · {party.qualified} qualified</small>}</td>
                        <td>{party.decidedAt ? <time dateTime={party.decidedAt}>{formatClosing(party.decidedAt)}</time> : "—"}{party.decidedBy && <small>By {party.decidedBy}</small>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
