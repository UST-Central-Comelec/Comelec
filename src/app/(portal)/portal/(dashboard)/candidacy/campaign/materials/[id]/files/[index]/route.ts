import { requireAccess } from "@/lib/auth/session";
import { getMaterial } from "@/lib/candidacy/campaign-store";
import { getCandidacy } from "@/lib/candidacy/store";
import { fileResponse } from "@/lib/filing-portal/download";
import { canReadParty } from "@/lib/polpar/store";

// A campaign material's copy, for the commission: a Local unit only its own college's candidates'.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const user = await requireAccess("candidacy/campaign");
  const { id, index } = await params;
  const material = await getMaterial(id);
  const candidacy = material ? await getCandidacy(material.candidacyId) : null;
  return fileResponse(material && candidacy && canReadParty(user, candidacy.college) ? material : null, index);
}
