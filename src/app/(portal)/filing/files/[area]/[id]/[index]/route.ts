import { getMaterial } from "@/lib/candidacy/campaign-store";
import { getCandidacyDocumentById } from "@/lib/candidacy/store";
import { fileResponse } from "@/lib/filing-portal/download";
import { getPetition } from "@/lib/filing-portal/services-store";
import { getFilingAccount } from "@/lib/filing-portal/session";
import { getSubmissionById } from "@/lib/party-portal/store";

// One of the account's own files: its party's (for a member of its group), its candidacy's or its
// campaign materials', or its petitions'.

export async function GET(_request: Request, { params }: { params: Promise<{ area: string; id: string; index: string }> }) {
  const { area, id, index } = await params;
  const account = await getFilingAccount();
  if (!account) return new Response("Not found", { status: 404 });
  if (area === "party") {
    const { membership } = account;
    if (!membership || membership.member.status !== "active") return new Response("Not found", { status: 404 });
    const document = await getSubmissionById(id);
    return fileResponse(document && document.partyId === membership.party.id ? document : null, index);
  }
  if (area === "candidacy" && account.candidacy) {
    const document = await getCandidacyDocumentById(id);
    return fileResponse(document && document.candidacyId === account.candidacy.id ? document : null, index);
  }
  if (area === "material" && account.candidacy) {
    const material = await getMaterial(id);
    return fileResponse(material && material.candidacyId === account.candidacy.id ? material : null, index);
  }
  if (area === "petition") {
    const petition = await getPetition(id);
    return fileResponse(petition && petition.accountId === account.account.id ? petition : null, index);
  }
  return new Response("Not found", { status: 404 });
}
