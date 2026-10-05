import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionView } from "@/components/portal/code-revision";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { codes, isCodeKey } from "@/lib/codes/options";
import { getRevision, holdersOf, listApprovers } from "@/lib/codes/store";

export const metadata: Metadata = { title: "Revision" };

/** One revision of the Constitution or the Elections Code, under the text's own tab. */
export default async function CodeRevisionPage({ params, searchParams }: PageProps<"/portal/codes/[code]/revisions/[id]">) {
  const [{ code, id }, { notice, show }] = await Promise.all([params, searchParams]);
  if (!isCodeKey(code)) notFound();
  const [user, [revision, approvers]] = await withPortalUser(Promise.all([getRevision(id).catch(() => null), listApprovers().catch(() => [])]), allowed(codes[code].tab));
  if (!revision || revision.code !== code) notFound();

  return <RevisionView revision={revision} user={user} holders={holdersOf(approvers)} place="tab" notice={notice} show={show} />;
}
