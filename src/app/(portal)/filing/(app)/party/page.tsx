import type { Metadata } from "next";
import { FilingDocuments, SendReadyButton } from "@/components/filing-portal/documents";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Toast } from "@/components/portal/toast";
import { requirePartyMember } from "@/lib/filing-portal/session";
import { requirements, templateHref } from "@/lib/polpar/content";
import { listSubmissions } from "@/lib/party-portal/store";
import { partyStatusLabel, partyStatusTone, unitName } from "@/lib/party-portal/types";

export const metadata: Metadata = { title: "Party documents" };

/** The party's registration documents: any member uploads, sends and takes back; the unit reviews each. */
export default async function PartyDocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { party } = await requirePartyMember();
  const { notice } = await searchParams;
  const documents = await listSubmissions(party.id);
  const open = party.status === "pending";
  const ready = documents.filter((item) => (item.status === "draft" || item.status === "changes") && item.files.length > 0).length;
  const approved = documents.filter((item) => item.status === "approved").length;

  return (
    <main className="portal-page">
      {notice === "created" && <Toast message="Your party is made, and you’re its contact person. Start with its documents." param="notice" />}
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">{party.name}</p>
          <TitleWithInfo info={`Upload each requirement’s files, then send it for review. The ${unitName(party.college)} approves it, or sends it back with what to change. A sent document is locked until it’s reviewed; take it back to change it. Every member of the party sees the same documents.`}>Party <em>documents</em></TitleWithInfo>
          <p className="portal-muted"><span className={`portal-tag ${partyStatusTone[party.status]}`}>{partyStatusLabel[party.status]}</span> · {approved} of {requirements.length} approved · Reviewed by the {unitName(party.college)}</p>
        </div>
        {open && <SendReadyButton area="party" count={ready} />}
      </header>
      {!open && <p className="portal-muted pp-locked" role="status">The party’s registration has been decided, so its documents can’t change now.</p>}
      {party.decisionRemarks && <p className="pp-feedback pp-remarks"><span><strong>The unit wrote</strong>{party.decisionRemarks}</span></p>}
      <FilingDocuments
        area="party"
        requirements={requirements.map((item) => ({ id: item.id, label: item.label, hint: item.id === "alumniIds" ? `${item.hint} Only if the party has active alumni members.` : item.hint, templateHref: "template" in item ? templateHref(item.template) : null, optional: item.id === "alumniIds" }))}
        documents={documents}
        open={open}
        unit={unitName(party.college)}
      />
    </main>
  );
}
