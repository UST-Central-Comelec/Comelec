import type { Metadata } from "next";
import { MaterialsBoard } from "@/components/filing-portal/campaign";
import { CandidacyHead } from "@/components/filing-portal/page-heads";
import { campaignOpen } from "@/lib/candidacy/campaign";
import { listMaterials } from "@/lib/candidacy/campaign-store";
import { listCandidacyDocuments } from "@/lib/candidacy/store";
import { isServicesMissing } from "@/lib/filing-portal/services-store";
import { requireCandidacy } from "@/lib/filing-portal/session";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import { CampaignClosed } from "../campaign-closed";

export const metadata: Metadata = { title: "Campaign materials" };

/** Candidacy → Campaign materials: what the candidate sends for the unit's approval before it's used. */
export default async function CampaignMaterialsPage() {
  const { candidacy } = await requireCandidacy();
  const [documents, materials] = await Promise.all([listCandidacyDocuments(candidacy.id), settle(listMaterials(candidacy.id))]);
  const list = materials.value ?? [];
  const open = campaignOpen(candidacy);
  const waiting = list.filter((item) => item.status === "submitted").length;

  return (
    <main className="portal-page">
      <CandidacyHead candidacy={candidacy} documents={documents} current="materials" />
      {materials.error ? (
        <p className="portal-form-error" role="alert">{isServicesMissing(materials.error) ? "Campaign materials aren’t set up yet. Try again later." : "Your materials couldn’t be loaded. Reload the page to try again."}</p>
      ) : (
        <>
          {!open && <CampaignClosed candidacy={candidacy} />}
          {waiting > 0 && <p className="portal-muted pp-locked" role="status">{waiting} waiting for the {unitName(candidacy.college)}’s review.</p>}
          {(open || list.length > 0) && <MaterialsBoard open={open} materials={list} underParty={Boolean(candidacy.partyId)} partyName={candidacy.partyName} unit={unitName(candidacy.college)} />}
        </>
      )}
    </main>
  );
}
