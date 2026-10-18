import type { Metadata } from "next";
import { FilingDocuments, SendReadyButton } from "@/components/filing-portal/documents";
import { CandidacyHead } from "@/components/filing-portal/page-heads";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { listCandidacyDocuments } from "@/lib/candidacy/store";
import { reachesUnit } from "@/lib/candidacy/types";
import { requireCandidacy } from "@/lib/filing-portal/session";
import { unitName } from "@/lib/party-portal/types";

export const metadata: Metadata = { title: "Candidacy documents" };

/** Candidacy → Upload documents: each requirement's files, sent for the unit's review. */
export default async function CandidacyDocumentsPage() {
  const { candidacy } = await requireCandidacy();
  const documents = await listCandidacyDocuments(candidacy.id);
  const reaches = reachesUnit(candidacy);
  const open = candidacy.status === "pending" && reaches;
  const ready = documents.filter((item) => (item.status === "draft" || item.status === "changes") && item.files.length > 0).length;

  return (
    <main className="portal-page">
      <CandidacyHead candidacy={candidacy} documents={documents} current="documents" action={open ? <SendReadyButton area="candidacy" count={ready} /> : undefined} />
      {!reaches && <p className="portal-muted pp-locked" role="status">{candidacy.endorsement === "waiting" ? "You can upload and send your documents once the party endorses you." : "This filing wasn’t endorsed, so its documents can’t be sent."}</p>}
      {reaches && candidacy.status !== "pending" && <p className="portal-muted pp-locked" role="status">Your candidacy has been decided, so its documents can’t change now.</p>}
      <FilingDocuments
        area="candidacy"
        requirements={candidacyRequirements.map((item) => ({ id: item.id, label: item.label, hint: item.hint, templateHref: null, optional: item.optional }))}
        documents={documents}
        open={open}
        unit={unitName(candidacy.college)}
      />
    </main>
  );
}
