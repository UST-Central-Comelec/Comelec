import { requireAccess } from "@/lib/auth/session";
import { getCandidacy, getCandidacyDocumentById } from "@/lib/candidacy/store";
import { reachesUnit } from "@/lib/candidacy/types";
import { fileResponse } from "@/lib/filing-portal/download";
import { canReadParty } from "@/lib/polpar/store";

// One of a candidate's files, for the commission: a Local unit only its own college's filings'.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; document: string; index: string }> }) {
  const user = await requireAccess("candidacy/filings");
  const { id, document: documentId, index } = await params;
  const candidacy = await getCandidacy(id);
  if (!candidacy || !canReadParty(user, candidacy.college) || !reachesUnit(candidacy)) return new Response("Not found", { status: 404 });
  const document = await getCandidacyDocumentById(documentId);
  return fileResponse(document && document.candidacyId === candidacy.id ? document : null, index);
}
