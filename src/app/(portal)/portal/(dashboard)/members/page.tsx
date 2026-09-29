import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import { requirePortalUser } from "@/lib/auth/session";
import { getMembers } from "@/lib/data/queries";
import { memberBodies, type MemberBody } from "@/lib/data/types";

export const metadata: Metadata = { title: "Commission members" };

export default async function PortalMembersPage({ searchParams }: PageProps<"/portal/members">) {
  await requirePortalUser();
  const [members, { notice }] = await Promise.all([getMembers(), searchParams]);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <h1>Commission members</h1>
          <p className="portal-muted">The people shown in “The Commission” section of the About page.</p>
        </div>
        <Link className="portal-button" href="/portal/members/new"><Plus size={16} /> Add member</Link>
      </header>
      <Notice notice={notice} />

      {(Object.keys(memberBodies) as MemberBody[]).map((body) => {
        const group = members.filter((member) => member.body === body);
        return (
          <section className="portal-card" key={body}>
            <div className="portal-card-head">
              <h2 className="portal-card-title">{memberBodies[body]}</h2>
              <Link className="portal-button is-small is-ghost" href={`/portal/members/new?body=${body}`}><Plus size={14} /> Add</Link>
            </div>
            {group.length === 0 ? (
              <p className="portal-empty">No members listed. This group is hidden on the website until you add someone.</p>
            ) : (
              <ul className="portal-members">
                {group.map((member) => (
                  <li key={member.id}>
                    <Link href={`/portal/members/${member.id}`}>
                      {member.photoUrl ? <Image src={member.photoUrl} alt="" width={44} height={44} /> : <span className="portal-avatar">{member.name.slice(0, 1)}</span>}
                      <span><strong>{member.name}</strong><small>{[member.position, member.unit].filter(Boolean).join(" · ")}</small></span>
                      <span className="portal-muted">Edit</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
