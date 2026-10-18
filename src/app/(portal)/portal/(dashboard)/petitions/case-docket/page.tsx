import type { Metadata } from "next";
import Link from "next/link";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { requireAccess } from "@/lib/auth/session";
import { isLateFiling, manilaParts, petitionStatusLabel, petitionStatusTone, petitionTypes } from "@/lib/filing-portal/services";
import { isServicesMissing, listPetitionsForUnit, type PetitionRow } from "@/lib/filing-portal/services-store";
import { fullName } from "@/lib/filing-portal/types";
import { formatClosing } from "@/lib/applications/period";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Case docket" };

const views = { filed: "To docket", docketed: "Being heard", decided: "Decided", withdrawn: "Withdrawn", all: "All" } as const;
type View = keyof typeof views;
const isView = (value: unknown): value is View => typeof value === "string" && Object.hasOwn(views, value);
const inView = (view: View, petition: PetitionRow) => view === "all" || (view === "decided" ? petition.status === "resolved" || petition.status === "dismissed" : petition.status === view);

/** Petitions and Cases → Case Docket: what's filed in the filing portal, docketed, heard and decided. A Local unit sees its own college's. */
export default async function PortalCaseDocketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAccess("petitions/case-docket");
  const local = user.affiliation === "local";
  const { show } = await searchParams;
  const view: View = isView(show) ? show : "filed";
  const { value, error } = await settle(local && !user.college ? Promise.resolve([]) : listPetitionsForUnit(local ? user.college : null));
  const all = value ?? [];
  const rows = all.filter((petition) => inView(view, petition));
  const count = (key: View) => all.filter((petition) => inView(key, petition)).length;

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Legals · Petitions and Cases</p>
          <TitleWithInfo info="Petitions and cases filed in the filing portal: qualification contests, nuisance candidates, election protests, election and campaign offenses, complaints against parties, and other petitions. Docket one to take it up (the respondent answers within five school days), then resolve or dismiss it within five school days of the answer (Elections Code, Article XII). Protests and offenses filed more than five school days after what happened are marked. The filer is notified and emailed each time.">Case Docket</TitleWithInfo>
          <p className="portal-muted">{local ? unitName(user.college ?? "") : "Every unit’s petitions"}</p>
        </div>
      </header>
      {error ? <p className="portal-form-error" role="alert">{isServicesMissing(error) ? "The docket needs a database update first: apply supabase/migrations/20261018200000_filing_services_campaign.sql, then reload." : `Couldn’t load the petitions. Reload the page. (${error})`}</p> : (
        <>
          <dl className="portal-kpis fr-kpis">
            <div className="is-lead"><dt>To docket</dt><dd>{count("filed")}</dd></div>
            <div><dt>Being heard</dt><dd>{count("docketed")}</dd></div>
            <div><dt>Resolved</dt><dd>{all.filter((petition) => petition.status === "resolved").length}</dd></div>
            <div><dt>Dismissed</dt><dd>{all.filter((petition) => petition.status === "dismissed").length}</dd></div>
          </dl>
          <section className="portal-card is-flush">
            <div className="fr-tools">
              <SlidingFilters label="Petitions" active={view} items={(Object.keys(views) as View[]).map((key) => ({ key, href: key === "filed" ? "/portal/petitions/case-docket" : `/portal/petitions/case-docket?show=${key}`, label: <>{views[key]} <small>{count(key)}</small></> }))} />
            </div>
            {rows.length ? (
              <div className="portal-table-wrap">
                <table className="portal-table fr-table">
                  <thead><tr><th>Petition</th><th>Filed by</th><th>Against</th><th>Filed</th>{!local && <th>Unit</th>}<th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((petition) => {
                      const late = isLateFiling(petition, manilaParts(petition.createdAt)[0]);
                      return (
                        <tr key={petition.id}>
                          <td><Link className="portal-row-title" href={`/portal/petitions/case-docket/${petition.id}`}>{petition.subject}</Link><small className="fr-sub">{petition.reference} · {petitionTypes[petition.type].label}</small></td>
                          <td>{fullName(petition.account)}<small className="fr-sub">{petition.account.email}</small></td>
                          <td>{petition.respondent || <span className="portal-muted">No one named</span>}</td>
                          <td><time>{formatClosing(petition.createdAt)}</time>{late && <small className="fr-sub fr-flag">After five school days</small>}</td>
                          {!local && <td>{unitName(petition.college)}</td>}
                          <td><span className={`portal-tag ${petitionStatusTone[petition.status]}`}>{petition.status === "filed" ? "To docket" : petitionStatusLabel[petition.status].split(",")[0]}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="portal-empty">{view === "filed" ? "Nothing to docket. Petitions filed in the filing portal show up here." : "Nothing here."}</p>}
          </section>
        </>
      )}
    </main>
  );
}
