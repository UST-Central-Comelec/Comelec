import type { Metadata } from "next";
import Link from "next/link";
import { MemberForm } from "@/components/portal/member-form";
import { isLocal, withPortalUser } from "@/lib/auth/session";
import { getMembers, takenColleges } from "@/lib/data/queries";
import { isMemberBody } from "@/lib/data/types";
import { createMember } from "@/lib/portal/member-actions";

export const metadata: Metadata = { title: "Add member" };

export default async function NewMemberPage({ searchParams }: PageProps<"/portal/members/new">) {
  const { body: bodyParam, college } = await searchParams;
  const [user, members] = await withPortalUser(getMembers());
  // A Local account adds only to its own college's Local Comelec.
  const lockedCollege = isLocal(user) ? (user.college ?? "") : undefined;
  const body = lockedCollege !== undefined ? "local" : typeof bodyParam === "string" && isMemberBody(bodyParam) ? bodyParam : "central";
  const unit = lockedCollege ?? (typeof college === "string" ? college : "");

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/members">← Directory</Link>
          <h1>Add member</h1>
        </div>
      </header>
      <section className="portal-card">
        <MemberForm action={createMember} submitLabel="Add member" initial={{ name: "", position: "", body, unit, photoUrl: null }} takenColleges={takenColleges(members)} lockedCollege={lockedCollege} />
      </section>
    </main>
  );
}
