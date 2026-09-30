import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ChamberGroup } from "@/components/portal/chamber-group";
import { CollegeFilter } from "@/components/portal/college-filter";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { MemberAvatar } from "@/components/portal/member-avatar";
import { MemberGroup } from "@/components/portal/member-group";
import { Notice } from "@/components/portal/notice";
import { isLocal, withPortalUser } from "@/lib/auth/session";
import { getDirectory } from "@/lib/data/queries";
import { directoryGroups, type Member, type MemberBody } from "@/lib/data/types";

export const metadata: Metadata = { title: "Directory" };

const line = (...parts: string[]) => parts.filter(Boolean).join(" · ");

const groupInfo: Record<keyof typeof directoryGroups, string> = {
  central: "The Central Comelec, which is also its Executive Board. Drag a card to change the order on the About page.",
  local: "Every college’s Local Comelec, grouped by college. Drag a card to change the order within its college on the About page.",
  "en-banc": "Filled in automatically: the Central Comelec Executive Board, then each college’s Local Comelec Central Representative. To change it, edit those members.",
  chamber: "Filled in automatically: every Local Comelec Chairperson. Click a card to make them the chamber’s Primus (its head) or Vicar (the Primus’s associate).",
};

export default async function PortalMembersPage({ searchParams }: PageProps<"/portal/members">) {
  const [user, [directory, { notice, college: collegeParam }]] = await withPortalUser(Promise.all([getDirectory(), searchParams]));
  // A Local account sees and manages only its own college's Local Comelec.
  const local = isLocal(user);
  // Local Comelec, one block per college (alphabetical), optionally narrowed to one college.
  const localColleges = [...new Set(directory.local.map((member) => member.unit))].sort((a, b) => a.localeCompare(b));
  const college = typeof collegeParam === "string" && localColleges.includes(collegeParam) ? collegeParam : "";
  const shownColleges = local ? [user.college ?? ""] : college ? [college] : localColleges;

  const draggable = (body: MemberBody, members: Member[], unit?: string) => (
    // Keyed on the order so it resets after an edit elsewhere changes the group.
    <MemberGroup
      key={members.map((member) => member.id).join()}
      body={body}
      college={unit}
      members={members.map((member) => ({ id: member.id, name: member.name, photoUrl: member.photoUrl, subtitle: unit ? member.position : line(member.position, member.unit) }))}
    />
  );

  const empty = (message: string) => <p className="portal-empty">{message}</p>;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info={local
            ? `Your college’s Local Comelec, as shown in “Meet the commission” on the About page. Drag a card to change the order. Its Chairperson and Central Representative also appear in the Chamber of Chairpersons and En Banc.`
            : "The people shown in “Meet the commission” on the About page, in the order shown here. En Banc and the Chamber of Chairpersons fill in automatically from the other two groups."}>Directory</TitleWithInfo>
          {local && <p className="portal-muted">{user.college}</p>}
        </div>
        <Link className="portal-button" href={local ? "/portal/members/new?body=local" : "/portal/members/new"}><Plus size={16} /> Add member</Link>
      </header>
      <Notice notice={notice} />

      {!local && (
        <>
        <section className="portal-card">
          <div className="portal-card-head">
            <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo.central}>{directoryGroups.central}</TitleWithInfo>
            <Link className="portal-button is-small is-ghost" href="/portal/members/new?body=central"><Plus size={14} /> Add</Link>
          </div>
          {directory.central.length ? draggable("central", directory.central) : empty("No members yet. This group is hidden on the website until you add someone.")}
        </section>

        <section className="portal-card">
          <div className="portal-card-head">
            <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo["en-banc"]}>{directoryGroups["en-banc"]}</TitleWithInfo>
            <span className="portal-tag">Automatic</span>
          </div>
          {directory["en-banc"].length ? (
            <ul className="portal-members">
              {directory["en-banc"].map((member) => (
                <li key={member.id}>
                  <Link href={`/portal/members/${member.id}`}>
                    <MemberAvatar photoUrl={member.photoUrl} />
                    <span><strong>{member.name}</strong><small>{member.body === "central" ? line(member.position, "Executive Board") : line(member.position, member.unit)}</small></span>
                    <span className="portal-muted">Edit</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            empty("Nobody yet. Add Central Comelec members, or Local Comelec Central Representatives.")
          )}
        </section>

        <section className="portal-card">
          <div className="portal-card-head">
            <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo.chamber}>{directoryGroups.chamber}</TitleWithInfo>
            <span className="portal-tag">Automatic</span>
          </div>
          {directory.chamber.length ? (
            <ChamberGroup members={directory.chamber.map((member) => ({ id: member.id, name: member.name, college: member.unit, photoUrl: member.photoUrl, role: member.chamberRole ?? null }))} />
          ) : (
            empty("Nobody yet. Add Local Comelec Chairpersons.")
          )}
        </section>
        </>
      )}

      <section className="portal-card" id="local-comelec">
        <div className="portal-card-head">
          <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo.local}>{directoryGroups.local}</TitleWithInfo>
          <div className="directory-head-actions">
            {!local && localColleges.length > 1 && <CollegeFilter colleges={localColleges} value={college} />}
            {!local && <Link className="portal-button is-small is-ghost" href="/portal/members/new?body=local"><Plus size={14} /> Add</Link>}
          </div>
        </div>
        {shownColleges.length === 0
          ? empty("No members yet. This group is hidden on the website until you add someone.")
          : shownColleges.map((unit) => (
              <div className="directory-college" key={unit}>
                <div className="directory-college-head">
                  <h3>{unit}</h3>
                  <Link className="directory-college-add" href={`/portal/members/new?body=local&college=${encodeURIComponent(unit)}`}><Plus size={13} /> Add</Link>
                </div>
                {draggable("local", directory.local.filter((member) => member.unit === unit), unit)}
              </div>
            ))}
      </section>
    </main>
  );
}
