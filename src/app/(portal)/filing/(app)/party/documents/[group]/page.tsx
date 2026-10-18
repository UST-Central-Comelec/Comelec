import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilingDocuments, SendReadyButton } from "@/components/filing-portal/documents";
import { PartyHead } from "@/components/filing-portal/page-heads";
import { requirePartyMember } from "@/lib/filing-portal/session";
import { templateHref } from "@/lib/polpar/content";
import { listSubmissions } from "@/lib/party-portal/store";
import { isPartyRequirementGroup, isRegistering, partyRequirementGroups, partyRequirements, unitName } from "@/lib/party-portal/types";

export const metadata: Metadata = { title: "Party requirements" };

/** One group of the party's requirements: any member uploads, sends and takes back; the unit reviews each. */
export default async function PartyRequirementsPage({ params }: { params: Promise<{ group: string }> }) {
  const { party } = await requirePartyMember();
  const { group: key } = await params;
  if (!isPartyRequirementGroup(key)) notFound();
  const group = partyRequirementGroups.find((item) => item.key === key)!;
  const documents = await listSubmissions(party.id);
  const open = isRegistering(party);
  const ready = documents.filter((item) => (item.status === "draft" || item.status === "changes") && item.files.length > 0).length;
  const requirements = partyRequirements
    .map((item, index) => ({ ...item, number: index + 1 }))
    .filter((item) => (group.ids as readonly string[]).includes(item.id))
    .map((item) => ({ id: item.id, label: item.label, number: item.number, hint: item.optional ? `${item.hint} Only if the party has active alumni members.` : item.hint, templateHref: item.template ? templateHref(item.template) : null, optional: item.optional }));

  return (
    <main className="portal-page">
      <PartyHead party={party} documents={documents} current={group.key} action={open ? <SendReadyButton area="party" count={ready} /> : undefined} />
      {!open && <p className="portal-muted pp-locked" role="status">{party.sanction ? `The party is ${party.sanction}, so its documents can’t change now.` : "The party’s registration has been decided, so its documents can’t change now."}</p>}
      <FilingDocuments area="party" requirements={requirements} documents={documents} open={open} unit={unitName(party.college)} />
    </main>
  );
}
