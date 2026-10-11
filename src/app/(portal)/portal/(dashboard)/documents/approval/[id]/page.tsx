import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionView } from "@/components/portal/code-revision";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { getRevision, holdersOf, listApprovers } from "@/lib/codes/store";

export const metadata: Metadata = { title: "Review" };

/** One revision of the Constitution or the Elections Code, opened from Approval to be approved or sent back. */
export default async function ApprovalPage({ params, searchParams }: PageProps<"/portal/documents/approval/[id]">) {
  const [{ id }, { notice, show }] = await Promise.all([params, searchParams]);
  const [user, [revision, approvers]] = await withPortalUser(Promise.all([getRevision(id).catch(() => null), listApprovers().catch(() => [])]), allowed("documents/approval"));
  if (!revision) notFound();

  return <RevisionView revision={revision} user={user} holders={holdersOf(approvers)} place="approval" notice={notice} show={show} />;
}
