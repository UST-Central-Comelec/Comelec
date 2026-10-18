import type { Metadata } from "next";
import { EndorsementActions, JoinRequestActions } from "@/components/party-portal/member-requests";
import { PartyHead } from "@/components/filing-portal/page-heads";
import { formatClosing } from "@/lib/applications/period";
import { listPartyCandidates } from "@/lib/candidacy/store";
import { councilOf, endorsementLabel } from "@/lib/candidacy/types";
import { isContactPerson, requirePartyMember } from "@/lib/filing-portal/session";
import { fullName } from "@/lib/filing-portal/types";
import { listMembers, listSubmissions } from "@/lib/party-portal/store";
import { yearLevelLabel } from "@/lib/party-portal/types";

export const metadata: Metadata = { title: "Party members" };

/** The party's group: its members, who's asking to join, and its candidates, whom the contact person endorses. */
export default async function PartyMembersPage() {
  const account = await requirePartyMember();
  const contactPerson = isContactPerson(account);
  const [everyone, candidates, documents] = await Promise.all([listMembers(account.party.id), listPartyCandidates(account.party.id), listSubmissions(account.party.id)]);
  const members = everyone.filter((item) => item.status === "active");
  const requests = everyone.filter((item) => item.status === "requested");
  const asking = candidates.filter((item) => item.endorsement === "waiting");
  const answered = candidates.filter((item) => item.endorsement !== "waiting");

  return (
    <main className="portal-page">
      <PartyHead party={account.party} documents={documents} current="members" />
      <p className="portal-muted pp-locked">{members.length} {members.length === 1 ? "member" : "members"}{requests.length ? ` · ${requests.length} asking to join` : ""}{candidates.length ? ` · ${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"}` : ""}. People join from this tab or the Political Party Registration page; the contact person approves them and endorses the party’s candidates.</p>

      {requests.length > 0 && (
        <section className="portal-card is-flush">
          <div className="pp-card-head is-padded"><h2>Asking to join</h2>{!contactPerson && <span className="portal-muted">The contact person answers these.</span>}</div>
          <ul className="pp-people">
            {requests.map((person) => (
              <li key={person.id}>
                <span className="pp-person"><strong>{fullName(person)}</strong><small>{person.college} · {yearLevelLabel(person.yearLevel)} · asked {formatClosing(person.createdAt)}</small></span>
                {contactPerson ? <JoinRequestActions memberId={person.id} name={fullName(person)} /> : <span className="portal-tag is-gold">Waiting</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {candidates.length > 0 && (
        <section className="portal-card is-flush">
          <div className="pp-card-head is-padded"><h2>Candidates</h2>{asking.length > 0 && !contactPerson && <span className="portal-muted">The contact person endorses these.</span>}</div>
          <ul className="pp-people">
            {[...asking, ...answered].map((candidate) => (
              <li key={candidate.id}>
                <span className="pp-person"><strong>{fullName(candidate.account)}</strong><small>{candidate.position}, {councilOf(candidate.college)} · filed {formatClosing(candidate.createdAt)}</small></span>
                {candidate.endorsement === "waiting" && contactPerson
                  ? <EndorsementActions candidacyId={candidate.id} name={fullName(candidate.account)} />
                  : <span className={`portal-tag${candidate.endorsement === "endorsed" ? " is-ok" : candidate.endorsement === "declined" ? " is-warn" : " is-gold"}`}>{candidate.endorsement === "waiting" ? "Waiting for endorsement" : endorsementLabel[candidate.endorsement].replace(" by the party", "")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="portal-card is-flush">
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Name</th><th>College or faculty</th><th>Student number</th><th>Mobile number</th><th>Role</th></tr></thead>
            <tbody>
              {members.map((person) => (
                <tr key={person.id}>
                  <td><span className="portal-row-title">{fullName(person)}</span><small className="portal-muted">{person.email}</small></td>
                  <td>{person.college}<small className="portal-muted">{[person.program, yearLevelLabel(person.yearLevel)].filter(Boolean).join(" · ")}</small></td>
                  <td>{person.studentNumber}</td>
                  <td>{person.mobileNumber}</td>
                  <td><span className={`portal-tag${person.role === "contact" ? " is-gold" : ""}`}>{person.role === "contact" ? "Contact person" : "Member"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
