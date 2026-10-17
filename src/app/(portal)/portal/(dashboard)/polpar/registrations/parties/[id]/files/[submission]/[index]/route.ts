import { requireAccess } from "@/lib/auth/session";
import { fileResponse } from "@/lib/filing-portal/download";
import { getParty, getSubmissionById } from "@/lib/party-portal/store";
import { canReadParty } from "@/lib/polpar/store";

// One of a party's files, for the commission: a Local unit only its own college's parties'.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; submission: string; index: string }> }) {
  const user = await requireAccess("polpar/registrations");
  const { id, submission: submissionId, index } = await params;
  const party = await getParty(id);
  if (!party || !canReadParty(user, party.college)) return new Response("Not found", { status: 404 });
  const submission = await getSubmissionById(submissionId);
  return fileResponse(submission && submission.partyId === party.id ? submission : null, index);
}
