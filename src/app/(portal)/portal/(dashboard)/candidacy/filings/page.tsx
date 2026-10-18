import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FilingsTable, type FilingRow } from "@/components/portal/filing-review/filings-table";
import { CandidacyApplicantsTabs } from "@/components/portal/filing-review/tabs";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { requireAccess } from "@/lib/auth/session";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { listCandidaciesForUnit } from "@/lib/candidacy/store";
import { councilOf, endorsementLabel, reachesUnit } from "@/lib/candidacy/types";
import { filingStage } from "@/lib/filing-portal/tracking";
import { documentProgress, fullName } from "@/lib/filing-portal/types";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/filing-review.css";
import "@/components/filing-portal/documents.css";

export const metadata: Metadata = { title: "Candidacy applicants" };

/**
 * Every certificate of candidacy filed through the filing portal, tracked: waiting for its party's
 * endorsement, needing review, returned for revisions, ready to decide, decided or withdrawn. A
 * Local unit sees its own college's.
 */
export default async function PortalCandidacyFilingsPage() {
  const user = await requireAccess("candidacy/filings");
  const local = user.affiliation === "local";
  const { value: filings, error } = await settle(local && !user.college ? Promise.resolve([]) : listCandidaciesForUnit(local ? user.college : null));

  const rows: FilingRow[] = (filings ?? []).map((filing) => {
    const progress = documentProgress(candidacyRequirements, filing.documents);
    return {
      id: filing.id, reference: filing.reference, name: fullName(filing.account), sortName: [filing.account.lastName, filing.account.firstName, filing.account.middleName].join(" "),
      email: filing.account.email, studentNumber: filing.account.studentNumber, studentCollege: filing.account.college,
      college: filing.college, unit: unitName(filing.college), position: filing.position, council: councilOf(filing.college),
      partyName: filing.partyName,
      endorsement: filing.partySanction ? `Party ${filing.partySanction}` : filing.partyStatus && filing.partyStatus !== "accredited" && filing.endorsement !== "waiting" ? "Party no longer accredited" : endorsementLabel[filing.endorsement].replace(" by the party", "").replace("’s endorsement", ""),
      partyFlag: Boolean(filing.partyId && filing.status !== "withdrawn" && (filing.partySanction || filing.partyStatus !== "accredited")),
      stage: filingStage(filing, progress), progress, reachesUnit: reachesUnit(filing), lastActivity: filing.lastActivity, createdAt: filing.createdAt,
    };
  });
  const count = (key: string) => rows.filter((row) => row.stage.key === key).length;
  const live = rows.filter((row) => row.stage.key !== "withdrawn");

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing of Candidacy</p>
          <TitleWithInfo info="Candidates file on the Filing of Candidacy page, then upload their documents in the filing portal and send each for review. One running under a party reaches you once the party’s contact person endorses them. Open a filing to approve each document or return it for revisions, then decide whether they’re qualified (or override missing documents, with remarks). Each filing has its own FC- ID. The candidate is notified and emailed each time.">Applicants</TitleWithInfo>
          <p className="portal-muted">{local ? unitName(user.college ?? "") : "Every unit’s filings"}</p>
        </div>
        <Link className="portal-button is-ghost" href="/candidacy" target="_blank" rel="noopener noreferrer">Filing page <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </header>
      <CandidacyApplicantsTabs current="filings" />

      {error ? <p className="portal-form-error" role="alert">Couldn’t load the filings. Reload the page; if it keeps happening, check that migrations 20261017210000_candidacy_filing.sql and 20261018120000_filing_portal_management.sql have been applied. ({error})</p> : (
        <>
          <dl className="portal-kpis fr-kpis">
            <div className="is-lead"><dt>Filed</dt><dd>{live.length}</dd></div>
            <div><dt>Documents to review</dt><dd>{rows.filter((row) => row.stage.key === "review").reduce((sum, row) => sum + row.progress.waiting, 0)}<small>{count("review")} {count("review") === 1 ? "candidate" : "candidates"}</small></dd></div>
            <div><dt>Returned for revisions</dt><dd>{count("returned")}</dd></div>
            <div><dt>Waiting for a party</dt><dd>{count("endorsement")}</dd></div>
            <div><dt>Qualified</dt><dd>{count("qualified")}</dd></div>
            <div><dt>Disqualified</dt><dd>{count("disqualified")}</dd></div>
          </dl>
          <section className="portal-card is-flush"><FilingsTable rows={rows} showUnits={!local} /></section>
        </>
      )}
    </main>
  );
}
