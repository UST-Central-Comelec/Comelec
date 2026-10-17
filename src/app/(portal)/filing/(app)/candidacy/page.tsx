import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { FilingDocuments, SendReadyButton } from "@/components/filing-portal/documents";
import { WithdrawCandidacy } from "@/components/filing-portal/withdraw";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Toast } from "@/components/portal/toast";
import { formatClosing } from "@/lib/applications/period";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { listCandidacyDocuments } from "@/lib/candidacy/store";
import { candidacyStatusLabel, candidacyStatusTone, councilOf, endorsementLabel, reachesUnit } from "@/lib/candidacy/types";
import { requireCandidacy } from "@/lib/filing-portal/session";
import { unitName } from "@/lib/party-portal/types";

export const metadata: Metadata = { title: "My candidacy" };

const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "");

/** The candidate's own filing: where it stands, what it states, and its documents for the unit's review. */
export default async function CandidacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { account, candidacy } = await requireCandidacy();
  const { notice } = await searchParams;
  const documents = await listCandidacyDocuments(candidacy.id);
  const reaches = reachesUnit(candidacy);
  const open = candidacy.status === "pending" && reaches;
  const ready = documents.filter((item) => (item.status === "draft" || item.status === "changes") && item.files.length > 0).length;
  const approved = documents.filter((item) => item.status === "approved").length;
  const unit = unitName(candidacy.college);

  return (
    <main className="portal-page">
      {notice === "filed" && <Toast message={candidacy.partyId ? `Filed. ${candidacy.partyName}’s contact person has been asked to endorse you; your documents open once they do.` : "Filed. Upload your documents and send them for review."} param="notice" />}
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing of Candidacy · {unit}</p>
          <TitleWithInfo info={`Your certificate of candidacy and its documents. ${candidacy.partyId ? "Running under a party, your filing reaches the unit once the party’s contact person endorses you. " : ""}Upload each document, then send it for review; the ${unit} approves it or sends it back with what to change, then decides whether you’re qualified.`}>My <em>candidacy</em></TitleWithInfo>
          <p className="portal-muted"><span className={`portal-tag ${candidacyStatusTone[candidacy.status]}`}>{candidacyStatusLabel[candidacy.status]}</span> · {approved} of {candidacyRequirements.length} documents approved</p>
        </div>
        {open && <SendReadyButton area="candidacy" count={ready} />}
      </header>

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
      {candidacy.decisionRemarks && <p className="pp-feedback pp-remarks"><span><strong>The unit wrote</strong>{candidacy.decisionRemarks}</span></p>}

      <section className="portal-card pp-candidacy-details">
        <h2>Certificate of candidacy</h2>
        <dl className="portal-details">
          <div><dt>Running for</dt><dd>{candidacy.position}, {councilOf(candidacy.college)}</dd></div>
          <div><dt>Filed with</dt><dd>{unit}</dd></div>
          <div><dt>Party</dt><dd>{candidacy.partyName ? `${candidacy.partyName} · ${endorsementLabel[candidacy.endorsement]}` : "Independent"}</dd></div>
          <div><dt>Date of birth</dt><dd>{formatDate(candidacy.dateOfBirth)}</dd></div>
          <div><dt>Address for election matters</dt><dd>{candidacy.residence}</dd></div>
          <div><dt>Contact</dt><dd>{account.mobileNumber} · {account.email}</dd></div>
          <div><dt>Filed</dt><dd>{formatClosing(candidacy.createdAt)}</dd></div>
        </dl>
      </section>

      <h2 className="pp-section-title">Documents</h2>
      {!reaches && <p className="portal-muted pp-locked" role="status">{candidacy.endorsement === "waiting" ? "You can upload and send your documents once the party endorses you." : "This filing wasn’t endorsed, so its documents can’t be sent."}</p>}
      {reaches && candidacy.status !== "pending" && <p className="portal-muted pp-locked" role="status">Your candidacy has been decided, so its documents can’t change now.</p>}
      <FilingDocuments
        area="candidacy"
        requirements={candidacyRequirements.map((item) => ({ id: item.id, label: item.label, hint: item.hint, templateHref: null, optional: item.optional }))}
        documents={documents}
        open={open}
        unit={unit}
      />

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
