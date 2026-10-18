import { requireAccess } from "@/lib/auth/session";
import { fileResponse } from "@/lib/filing-portal/download";
import { getPetition } from "@/lib/filing-portal/services-store";
import { canReadParty } from "@/lib/polpar/store";

// A petition's evidence, for the commission: a Local unit only its own college's petitions'.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const user = await requireAccess("petitions/case-docket");
  const { id, index } = await params;
  const petition = await getPetition(id);
  return fileResponse(petition && canReadParty(user, petition.college) ? petition : null, index);
}
