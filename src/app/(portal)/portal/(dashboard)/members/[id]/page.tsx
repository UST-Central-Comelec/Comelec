import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { MemberForm } from "@/components/portal/member-form";
import { isLocal, withPortalUser } from "@/lib/auth/session";
import { getMember, getMembers, takenColleges } from "@/lib/data/queries";
import { deleteMember, updateMember } from "@/lib/portal/member-actions";

export const metadata: Metadata = { title: "Edit member" };

export default async function EditMemberPage({ params }: PageProps<"/portal/members/[id]">) {
  const { id } = await params;
  const [user, [member, members]] = await withPortalUser(Promise.all([getMember(id), getMembers()]));
  // A Local account can only open its own college's Local Comelec members.
  const lockedCollege = isLocal(user) ? (user.college ?? "") : undefined;
  if (!member || (lockedCollege !== undefined && !(member.body === "local" && member.unit === lockedCollege))) notFound();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/members">← Directory</Link>
          <h1>Edit member</h1>
          <p className="portal-muted">Last updated {new Date(member.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by {member.updatedBy}.</p>
        </div>
      </header>
      <section className="portal-card">
        <MemberForm action={updateMember.bind(null, member.id)} submitLabel="Save changes" initial={member} takenColleges={takenColleges(members, member.id)} lockedCollege={lockedCollege} danger={<DeleteButton action={deleteMember.bind(null, member.id)} label="Remove member" />} />
      </section>
    </main>
  );
}
