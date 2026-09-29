import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { MemberForm } from "@/components/portal/member-form";
import { requirePortalUser } from "@/lib/auth/session";
import { getMember } from "@/lib/data/queries";
import { deleteMember, updateMember } from "@/lib/portal/member-actions";

export const metadata: Metadata = { title: "Edit member" };

export default async function EditMemberPage({ params }: PageProps<"/portal/members/[id]">) {
  await requirePortalUser();
  const member = await getMember((await params).id);
  if (!member) notFound();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/members">← Commission members</Link>
          <h1>Edit member</h1>
          <p className="portal-muted">Last updated {new Date(member.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by {member.updatedBy}.</p>
        </div>
        <DeleteButton action={deleteMember.bind(null, member.id)} label="Remove member" />
      </header>
      <section className="portal-card">
        <MemberForm action={updateMember.bind(null, member.id)} submitLabel="Save changes" initial={member} />
      </section>
    </main>
  );
}
