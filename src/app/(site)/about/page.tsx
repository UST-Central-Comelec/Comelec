import type { Metadata } from "next";
import Image from "next/image";
import { Mail, UserRound } from "lucide-react";
import { PageBanner } from "@/components/page-banner";
import { getDirectory } from "@/lib/data/queries";
import { accountPositions, chamberRoles, directoryGroups, type DirectoryEntry, type DirectoryGroup } from "@/lib/data/types";
import "../banner-page.css";
import "./about.css";

export const metadata: Metadata = { title: "About us" };

const anchors: Record<DirectoryGroup, string> = { central: "central-comelec", local: "local-comelec", "en-banc": "en-banc", chamber: "chamber-of-chairpersons" };

// "Meet the commission" is read from the portal's Accounts (getDirectory): everyone with an active
// account and a role. Only the name, role, college and photo are shown here.

/** The role line under a member's name: in the Chamber, Primus or Vicar where they hold it. */
function roleOf(member: DirectoryEntry, group: DirectoryGroup) {
  if (group === "chamber" && member.chamberRole) return `${chamberRoles[member.chamberRole]} · Chairperson`;
  if (group === "en-banc" && member.affiliation === "central") return `${member.role} · ${accountPositions["executive-board"]}`;
  return member.role;
}

/** Local Comelec members by college, colleges in alphabetical order; each keeps its order of rank. */
function byCollege(members: DirectoryEntry[]) {
  const colleges = new Map<string, DirectoryEntry[]>();
  for (const member of members) colleges.set(member.college ?? "", [...(colleges.get(member.college ?? "") ?? []), member]);
  return [...colleges].sort(([a], [b]) => a.localeCompare(b));
}

function MemberGrid({ members, group, showCollege }: { members: DirectoryEntry[]; group: DirectoryGroup; showCollege: boolean }) {
  return (
    <ul className="ab-grid">
      {members.map((member) => (
        <li className="ab-member" key={`${group}-${member.id}`}>
          {member.photoUrl ? <Image className="ab-photo" src={member.photoUrl} alt="" width={160} height={160} /> : <span className="ab-photo is-empty" aria-hidden="true"><UserRound size={28} strokeWidth={1.4} /></span>}
          <strong>{member.name}</strong>
          <span>{roleOf(member, group)}</span>
          {showCollege && member.college && <small>{member.college}</small>}
        </li>
      ))}
    </ul>
  );
}

export default async function AboutPage() {
  const directory = await getDirectory();
  const groups = (Object.keys(directoryGroups) as DirectoryGroup[]).map((body) => ({ body, members: directory[body] })).filter((group) => group.members.length > 0);

  const people = groups.reduce((total, group) => total + group.members.length, 0);

  return (
    <main className="bp ab">
      <PageBanner seed={1101} eyebrow="The commission" title={<>Built on trust. <em>Held by students.</em></>}
        lede="UST Central Comelec is the independent body responsible for conducting fair and credible student elections at the University of Santo Tomas."
        readings={[{ label: "Central elections", value: "93rd" }, ...(people ? [{ label: "Members", value: String(people) }] : [])]} />
      <div className="bp-wrap bp-body">
        <section className="ab-mandate" aria-labelledby="ab-mandate-title">
          <div className="ab-copy">
            <p className="bp-eyebrow">Our mandate</p>
            <h2 id="ab-mandate-title">A steady hand for a changing student body.</h2>
            <p>We believe elections work best when they are easy to understand and hard to doubt. Every year, our commission works with student organizations, candidates, and voters to make that belief tangible.</p>
            <p>From setting the calendar to certifying the results, we steward the process so that the student body can focus on the ideas and leaders that move it forward.</p>
          </div>
          <aside className="ab-contact" id="contact" aria-labelledby="ab-contact-title">
            <p className="bp-eyebrow">Have a question?</p>
            <h2 id="ab-contact-title">Let’s make the process clearer.</h2>
            <p>Our office is here for voters, candidates, and every Thomasian who wants to participate.</p>
            <a className="bp-button is-primary is-small" href="mailto:comelec@ust.edu.ph"><Mail size={15} aria-hidden="true" />comelec@ust.edu.ph</a>
          </aside>
        </section>

        {groups.length > 0 && (
          <section className="ab-people" aria-labelledby="ab-people-title">
            <header className="bp-head">
              <h2 id="ab-people-title">Meet the commission</h2>
              <i aria-hidden="true" />
              <p>{people} {people === 1 ? "member" : "members"}</p>
            </header>
            <p className="ab-intro">The students entrusted with running fair, credible elections for the Thomasian community.</p>
            {groups.map((group) => (
              <div className="ab-group" id={anchors[group.body]} key={group.body}>
                <h3>{directoryGroups[group.body]}</h3>
                {group.body === "local"
                  ? byCollege(group.members).map(([college, members]) => <div className="ab-college" key={college}><h4>{college}</h4><MemberGrid members={members} group={group.body} showCollege={false} /></div>)
                  : <MemberGrid members={group.members} group={group.body} showCollege />}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
