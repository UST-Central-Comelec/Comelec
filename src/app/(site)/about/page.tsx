import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { getDirectory } from "@/lib/data/queries";
import { chamberRoles, directoryGroups, type DirectoryGroup, type Member } from "@/lib/data/types";

export const metadata: Metadata = { title: "About us" };

const anchors: Record<DirectoryGroup, string> = { central: "central-comelec", local: "local-comelec", "en-banc": "en-banc", chamber: "chamber-of-chairpersons" };

/** The role line under a member's name: in the Chamber, Primus or Vicar where they hold it. */
function roleOf(member: Member, group: DirectoryGroup) {
  if (group === "chamber" && member.chamberRole) return `${chamberRoles[member.chamberRole]} · Chairperson`;
  if (group === "en-banc" && member.body === "central") return `${member.position} · Executive Board`;
  return member.position;
}

/** Local Comelec members by college, colleges in alphabetical order; each keeps its dragged order. */
function byCollege(members: Member[]) {
  const colleges = new Map<string, Member[]>();
  for (const member of members) colleges.set(member.unit, [...(colleges.get(member.unit) ?? []), member]);
  return [...colleges].sort(([a], [b]) => a.localeCompare(b));
}

function MemberGrid({ members, group, showCollege }: { members: Member[]; group: DirectoryGroup; showCollege: boolean }) {
  return (
    <div className="member-grid">
      {members.map((member) => (
        <article className="member-card" key={`${group}-${member.id}`}>
          {member.photoUrl ? <Image className="member-photo" src={member.photoUrl} alt={member.name} width={160} height={160} /> : <span className="member-photo is-empty" aria-hidden="true"><UserRound strokeWidth={1.4} /></span>}
          <strong>{member.name}</strong>
          <span>{roleOf(member, group)}</span>
          {showCollege && member.unit && <small>{member.unit}</small>}
        </article>
      ))}
    </div>
  );
}

export default async function AboutPage() {
  const directory = await getDirectory();
  const groups = (Object.keys(directoryGroups) as DirectoryGroup[]).map((body) => ({ body, members: directory[body] })).filter((group) => group.members.length > 0);

  return <main><section className="page-hero"><div className="page-hero-inner"><div className="eyebrow">The commission</div><h1>Built on trust.<br />Held by students.</h1><p>UST Central Comelec is the independent body responsible for conducting fair and credible student elections at the University of Santo Tomas.</p></div></section><section className="section"><div className="about-grid"><div><div className="eyebrow">Our mandate</div><h2>A steady hand for a changing student body.</h2><div className="about-copy"><p>We believe elections work best when they are easy to understand and hard to doubt. Every year, our commission works with student organizations, candidates, and voters to make that belief tangible.</p><p>From setting the calendar to certifying the results, we steward the process so that the student body can focus on the ideas and leaders that move it forward.</p></div><div className="stat-line"><div className="stat"><strong>93rd</strong><span>Central elections</span></div><div className="stat"><strong>1</strong><span>Student body</span></div></div></div><div className="contact-band section" id="contact"><div className="eyebrow">Have a question?</div><h2>Let’s make the process clearer.</h2><p>Our office is here for voters, candidates, and every Thomasian who wants to participate.</p><Link className="contact-link" href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph ↗</Link></div></div></section>{groups.length > 0 && <section className="section members-section"><div className="section-head"><div><div className="eyebrow">The people</div><h2>Meet the<br />commission.</h2></div><p className="section-intro">The students entrusted with running fair, credible elections for the Thomasian community.</p></div>{groups.map((group) => <div className="member-group" id={anchors[group.body]} key={group.body}><h3 className="member-group-title">{directoryGroups[group.body]}</h3>{group.body === "local" ? byCollege(group.members).map(([college, members]) => <div className="member-college" key={college}><h4 className="member-college-title">{college}</h4><MemberGrid members={members} group={group.body} showCollege={false} /></div>) : <MemberGrid members={group.members} group={group.body} showCollege />}</div>)}</section>}</main>;
}
