import type { Metadata } from "next";
import Link from "next/link";
import { MemberForm } from "@/components/portal/member-form";
import { requirePortalUser } from "@/lib/auth/session";
import { getMembers } from "@/lib/data/queries";
import { isMemberBody } from "@/lib/data/types";
import { createMember } from "@/lib/portal/member-actions";

export const metadata: Metadata = { title: "Add member" };

export default async function NewMemberPage({ searchParams }: PageProps<"/portal/members/new">) {
  await requirePortalUser();
  const { body: bodyParam } = await searchParams;
  const body = typeof bodyParam === "string" && isMemberBody(bodyParam) ? bodyParam : "central";
  const group = await getMembers(body);
  const nextOrder = group.reduce((max, member) => Math.max(max, member.order), 0) + 1;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/members">← Commission members</Link>
          <h1>Add member</h1>
        </div>
      </header>
      <section className="portal-card">
        <MemberForm action={createMember} submitLabel="Add member" initial={{ name: "", position: "", body, unit: "", order: nextOrder, photoUrl: null }} />
      </section>
    </main>
  );
}
