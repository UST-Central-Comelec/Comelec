import type { Metadata } from "next";
import { ArrowRight, Clock } from "lucide-react";
import { CandidacyHead } from "@/components/filing-portal/page-heads";
import { WithdrawCandidacy } from "@/components/filing-portal/withdraw";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Toast } from "@/components/portal/toast";
import { formatClosing } from "@/lib/applications/period";
import { listCandidacyDocuments } from "@/lib/candidacy/store";
import { councilOf, endorsementLabel } from "@/lib/candidacy/types";
import { requireFilingAccount } from "@/lib/filing-portal/session";
import { fullName } from "@/lib/filing-portal/types";
import { unitName, yearLevelLabel } from "@/lib/party-portal/types";

export const metadata: Metadata = { title: "Candidacy" };

const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "");

/** Candidacy → Candidate profile: who's running, for what, where the filing stands, and withdrawing it. */
export default async function CandidacyProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { account, candidacy } = await requireFilingAccount();
  const { notice } = await searchParams;

  if (!candidacy) {
    return (
      <main className="portal-page">
        <header className="portal-page-head">
          <div>
            <p className="portal-eyebrow">Candidacy</p>
            <TitleWithInfo info="File your certificate of candidacy on the Filing of Candidacy page while your Comelec unit is taking filings. It shows up here, with its documents, once you do.">Candidacy</TitleWithInfo>
            <p className="portal-muted">You haven’t filed a candidacy.</p>
          </div>
        </header>
        <section className="portal-card pp-waiting">
          <Clock size={22} aria-hidden="true" />
          <div>
            <h2>No candidacy yet</h2>
            <p className="portal-muted">File on the Filing of Candidacy page with this same UST account. Running under a party? It has to be accredited, and its contact person endorses you.</p>
            <p className="pp-waiting-actions"><a className="portal-button is-ghost is-small" href="/candidacy">Filing of Candidacy <ArrowRight size={14} aria-hidden="true" /></a></p>
          </div>
        </section>
      </main>
    );
  }

  const documents = await listCandidacyDocuments(candidacy.id);
  const unit = unitName(candidacy.college);

  return (
    <main className="portal-page">
      {notice === "filed" && <Toast message={candidacy.partyId ? `Filed. ${candidacy.partyName}’s contact person has been asked to endorse you; your documents open once they do.` : "Filed. Upload your documents under Upload documents, and send them for review."} param="notice" />}
      <CandidacyHead candidacy={candidacy} documents={documents} current="profile" />

      {candidacy.endorsement === "waiting" && (
        <section className="portal-card pp-waiting">
          <Clock size={22} aria-hidden="true" />
          <div>
            <h2>Waiting for {candidacy.partyName}’s endorsement</h2>
            <p className="portal-muted">You filed under {candidacy.partyName} on {formatClosing(candidacy.createdAt)}. Its contact person endorses the party’s candidates; once they do, your filing goes to the {unit} and you can send your documents. We’ll email you.</p>
          </div>
        </section>
      )}
      {candidacy.endorsement === "declined" && <p className="pp-feedback is-changes pp-remarks"><span><strong>{candidacy.partyName} didn’t endorse this candidacy.</strong>Talk to the party’s contact person. To run as an independent instead, withdraw this filing below, then file again before the period closes.</span></p>}
      {candidacy.partySanction && candidacy.status !== "withdrawn" && <p className="pp-feedback is-changes pp-remarks"><span><strong>{candidacy.partyName} is {candidacy.partySanction}.</strong>You can’t be qualified as its candidate while it is. Talk to the party, or withdraw this filing and file again as an independent before the period closes.</span></p>}
      {candidacy.decisionRemarks && <p className="pp-feedback pp-remarks"><span><strong>The unit wrote</strong>{candidacy.decisionRemarks}</span></p>}

      <div className="pp-dash-grid">
        <section className="portal-card">
          <h2>Certificate of candidacy</h2>
          <dl className="portal-details">
            <div><dt>Filing ID</dt><dd>{candidacy.reference}</dd></div>
            <div><dt>Running for</dt><dd>{candidacy.position}, {councilOf(candidacy.college)}</dd></div>
            <div><dt>Filed with</dt><dd>{unit}</dd></div>
            <div><dt>Party</dt><dd>{candidacy.partyName ? `${candidacy.partyName} · ${endorsementLabel[candidacy.endorsement]}` : "Independent"}</dd></div>
            <div><dt>Date of birth</dt><dd>{formatDate(candidacy.dateOfBirth)}</dd></div>
            <div><dt>Address for election matters</dt><dd>{candidacy.residence}</dd></div>
            <div><dt>Filed</dt><dd>{formatClosing(candidacy.createdAt)}</dd></div>
          </dl>
        </section>
        <section className="portal-card">
          <h2>Candidate</h2>
          <dl className="portal-details">
            <div><dt>Name</dt><dd>{fullName(account)}</dd></div>
            <div><dt>Student number</dt><dd>{account.studentNumber}</dd></div>
            <div><dt>College or faculty</dt><dd>{account.college}{account.program ? <><br /><small className="portal-muted">{account.program}</small></> : null}</dd></div>
            <div><dt>Year level</dt><dd>{yearLevelLabel(account.yearLevel)}</dd></div>
            <div><dt>Contact</dt><dd>{account.mobileNumber} · {account.email}</dd></div>
          </dl>
        </section>
      </div>

      {candidacy.status === "pending" && (
        <section className="portal-card pp-withdraw">
          <div>
            <h2>Withdraw</h2>
            <p className="portal-muted">You can withdraw before the election. Give the {unit} your sworn declaration of withdrawal too. Once withdrawn, you can file again while filing is open.</p>
          </div>
          <WithdrawCandidacy />
        </section>
      )}
    </main>
  );
}
