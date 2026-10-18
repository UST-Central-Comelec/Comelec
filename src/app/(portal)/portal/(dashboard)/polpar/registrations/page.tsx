import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { PartiesTable, type PartyRow } from "@/components/portal/filing-review/parties-table";
import { PartyApplicantsTabs } from "@/components/portal/filing-review/tabs";
import { requireAccess } from "@/lib/auth/session";
import { formatClosing } from "@/lib/applications/period";
import { partyStage } from "@/lib/filing-portal/tracking";
import { documentProgress } from "@/lib/filing-portal/types";
import { listPartiesForUnit } from "@/lib/party-portal/store";
import { partyRequirements, unitName } from "@/lib/party-portal/types";
import { listPartyRegistrations } from "@/lib/polpar/store";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/filing-review.css";
import "@/components/filing-portal/documents.css";

export const metadata: Metadata = { title: "Party applicants" };

/**
 * Every party registering through the filing portal, tracked: where each stands (needs review,
 * returned for revisions, ready to accredit…), its documents and members, filtered and searched.
 * Below, the one-step online registrations filed before the filing portal, when there are any.
 * A Local unit sees its own college's.
 */
export default async function PortalPartyRegistrationsPage() {
  const user = await requireAccess("polpar/registrations");
  const local = user.affiliation === "local";
  const [{ value: parties, error }, { value: earlier }] = await Promise.all([
    settle(local && !user.college ? Promise.resolve([]) : listPartiesForUnit(local ? user.college : null)),
    settle(listPartyRegistrations()),
  ]);

  const rows: PartyRow[] = (parties ?? []).map((party) => {
    const progress = documentProgress(partyRequirements, party.documents);
    return {
      id: party.id, reference: party.reference, name: party.name, college: party.college, unit: unitName(party.college),
      contactName: party.contact?.name ?? "", contactEmail: party.contact?.email ?? "",
      members: party.members, requests: party.requests, candidates: party.candidates,
      stage: partyStage(party, progress), progress, lastActivity: party.lastActivity, createdAt: party.createdAt,
    };
  });
  const open = rows.filter((row) => row.stage.key !== "withdrawn" && row.stage.key !== "declined" && row.stage.key !== "blacklisted");
  const count = (key: string) => rows.filter((row) => row.stage.key === key).length;
  // Only a party still registering can have its documents reviewed.
  const documentsWaiting = rows.filter((row) => row.stage.key === "review").reduce((sum, row) => sum + row.progress.waiting, 0);
  const members = open.reduce((sum, row) => sum + row.members, 0);

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Political Party</p>
          <TitleWithInfo info="A party’s members sign up on the Political Party Registration page, then upload the party’s documents in the filing portal and send each for review. Open a party to approve each document or return it for revisions, manage its members, and accredit or decline it once every required document is approved (or override that, with remarks). A party can also be suspended or blacklisted. Every party keeps its PP- ID and its records. Its members are notified and emailed each time.">Applicants</TitleWithInfo>
          <p className="portal-muted">{local ? unitName(user.college ?? "") : "Every unit’s party registrations"}</p>
        </div>
        <Link className="portal-button is-ghost" href="/party-registration" target="_blank" rel="noopener noreferrer">Registration page <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </header>
      <PartyApplicantsTabs current="parties" />

      {error ? <p className="portal-form-error" role="alert">Couldn’t load the parties. Reload the page; if it keeps happening, check that migrations 20261017190000_party_portal.sql and 20261018120000_filing_portal_management.sql have been applied. ({error})</p> : (
        <>
          <dl className="portal-kpis fr-kpis">
            <div className="is-lead"><dt>Registering now</dt><dd>{rows.filter((row) => ["review", "returned", "ready", "progress"].includes(row.stage.key)).length}</dd></div>
            <div><dt>Documents to review</dt><dd>{documentsWaiting}<small>{count("review")} {count("review") === 1 ? "party" : "parties"}</small></dd></div>
            <div><dt>Returned for revisions</dt><dd>{count("returned")}</dd></div>
            <div><dt>Ready to accredit</dt><dd>{count("ready")}</dd></div>
            <div><dt>Accredited</dt><dd>{count("accredited")}{count("suspended") > 0 && <small>{count("suspended")} suspended</small>}</dd></div>
            <div><dt>Members</dt><dd>{members}</dd></div>
          </dl>
          <section className="portal-card is-flush">
            <PartiesTable rows={rows} showUnits={!local} />
          </section>
        </>
      )}

      {earlier !== null && earlier.length > 0 && (
        <section className="portal-card is-flush pp-earlier">
          <div className="pp-card-head is-padded"><h2>Earlier online submissions</h2><span className="portal-muted">Filed in one step, before the filing portal</span></div>
          <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Political party</th><th>Commission unit</th><th>Contact email</th><th>Submitted</th></tr></thead><tbody>{earlier.map((row) => <tr key={row.id}><td><Link className="portal-row-title" href={`/portal/polpar/registrations/${row.id}`}>{row.party_name}</Link><small className="portal-muted">{row.reference}</small></td><td>{unitName(row.college || "")}</td><td>{row.email}</td><td>{formatClosing(row.created_at)}</td></tr>)}</tbody></table></div>
        </section>
      )}
    </main>
  );
}
