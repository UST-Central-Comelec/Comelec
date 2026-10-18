import type { Metadata } from "next";
import Link from "next/link";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { requireAccess } from "@/lib/auth/session";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { loadElectivePositions } from "@/lib/candidacy/positions-store";
import { listCandidaciesForUnit, listCandidacyDocumentStatuses } from "@/lib/candidacy/store";
import { councilOf } from "@/lib/candidacy/types";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/filing-review.css";

/** A requirement's reviews across the applications: only what there is, as dots and words. */
function Counts({ approved, waiting, returned }: { approved: number; waiting: number; returned: number }) {
  if (!approved && !waiting && !returned) return <small>Nothing sent yet</small>;
  return (
    <span className="fr-counts">
      {approved > 0 && <span className="portal-tag is-ok">{approved} approved</span>}
      {waiting > 0 && <span className="portal-tag is-gold">{waiting} to review</span>}
      {returned > 0 && <span className="portal-tag is-warn">{returned} returned</span>}
    </span>
  );
}

export const metadata: Metadata = { title: "Filing of Candidacy requirements" };

/**
 * What a certificate of candidacy needs (Elections Code, Sections 6.2 and 6.3), the same checklist
 * the filing portal shows candidates, with where each stands across the filings; then the elective
 * positions each council's candidates run for, from Administrative → Database, with how many filed.
 */
export default async function PortalCandidacyRequirementsPage() {
  const user = await requireAccess("candidacy/requirements");
  const local = user.affiliation === "local";
  const unit = local ? user.college : null;
  const [{ value: statuses, error }, { value: filings }, loaded] = await Promise.all([
    settle(local && !unit ? Promise.resolve([]) : listCandidacyDocumentStatuses(unit)),
    settle(local && !unit ? Promise.resolve([]) : listCandidaciesForUnit(unit)),
    loadElectivePositions(),
  ]);
  const tally = (id: string, status: string) => (statuses ?? []).filter((item) => item.requirement === id && item.status === status).length;
  const live = (filings ?? []).filter((item) => item.status !== "withdrawn");
  const filed = (college: string, position: string) => live.filter((item) => item.college === college && item.position === position).length;
  // The Central Student Council, then the councils that have their own list or have filings.
  const councils = local ? [unit ?? ""] : ["", ...Object.keys(loaded.positions).filter((college) => college && (loaded.stamps[college] || live.some((item) => item.college === college)))];

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing of Candidacy</p>
          <TitleWithInfo info="Every candidate uploads these in the filing portal and sends each for review. The figures count filings pending or qualified. The program of government is optional, so it doesn’t hold up a decision. Elective positions are edited under Administrative → Database.">Requirements</TitleWithInfo>
          <p className="portal-muted">Elections Code, Sections 6.2 and 6.3{local ? ` · ${unitName(unit ?? "")}` : ""}</p>
        </div>
        <Link className="portal-button is-ghost" href="/portal/database/elective-positions">Elective positions</Link>
      </header>
      {error && <p className="portal-form-error" role="alert">Couldn’t count the filings’ documents. Reload the page. ({error})</p>}
      <section className="portal-card is-flush">
        <div className="portal-table-wrap">
          <table className="portal-table fr-table">
            <thead><tr><th>Requirement</th><th>Details</th><th>Across the filings</th></tr></thead>
            <tbody>
              {candidacyRequirements.map((item) => (
                <tr key={item.id}>
                  <td><span className="portal-row-title">{item.label}</span>{item.optional && <small>Optional</small>}</td>
                  <td>{item.hint}</td>
                  <td><Counts approved={tally(item.id, "approved")} waiting={tally(item.id, "submitted")} returned={tally(item.id, "changes")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className="fr-heading">Elective positions</h2>
      {loaded.error && <p className="portal-form-error" role="alert">{loaded.error}</p>}
      <div className="fr-positions">
        {councils.map((college) => (
          <section key={college || "central"} className="portal-card">
            <h3>{councilOf(college)}</h3>
            <ol>
              {(loaded.positions[college] ?? []).map((position) => (
                <li key={position.id}>{position.name}<small>{filed(college, position.name)} filed</small></li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
