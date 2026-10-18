import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { PartyHead } from "@/components/filing-portal/page-heads";
import { CancelJoinRequest, PartyJoin } from "@/components/filing-portal/party-join";
import { DocumentBar } from "@/components/portal/filing-review/progress";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Toast } from "@/components/portal/toast";
import { formatClosing } from "@/lib/applications/period";
import { listPartyCandidates } from "@/lib/candidacy/store";
import { comelecUnit } from "@/lib/events/options";
import { candidacyStatusLabel, candidacyStatusTone, councilOf, endorsementLabel, type Candidacy } from "@/lib/candidacy/types";
import { isContactPerson, requireFilingAccount } from "@/lib/filing-portal/session";
import { documentProgress, fullName } from "@/lib/filing-portal/types";
import { getMember, listJoinableParties, listMembers, listSubmissions } from "@/lib/party-portal/store";
import { isRegistering, partyRequirementGroups, partyRequirements, unitName } from "@/lib/party-portal/types";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { openUnits } from "@/lib/periods/summary";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Political Party" };

const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "");
const notices: Record<string, string> = {
  created: "Your party is registered, and you’re its contact person. Start with its documents.",
  requested: "You’ve asked to join. The party’s contact person will review your request, and we’ll email you.",
};

/**
 * Beside joining or registering: the account's own candidacy, so someone running as an independent
 * (or under another party) sees what joining means for it before they decide.
 */
function CandidacyStanding({ candidacy }: { candidacy: Candidacy | null }) {
  return (
    <section className="portal-card pp-application">
      <div className="pp-card-head"><h2>Your candidacy</h2>{candidacy && <span className={`portal-tag ${candidacyStatusTone[candidacy.status]}`}>{candidacyStatusLabel[candidacy.status]}</span>}</div>
      {candidacy ? (
        <>
          <p className="pp-application-name">{candidacy.position}</p>
          <dl className="portal-details">
            <div><dt>Filing ID</dt><dd>{candidacy.reference}</dd></div>
            <div><dt>Council</dt><dd>{councilOf(candidacy.college)}</dd></div>
            <div><dt>Running</dt><dd>{candidacy.partyName ? `Under ${candidacy.partyName} · ${endorsementLabel[candidacy.endorsement]}` : "As an independent"}</dd></div>
            <div><dt>Filed</dt><dd>{formatClosing(candidacy.createdAt)}</dd></div>
          </dl>
          <p className="pp-feedback pp-remarks"><span><strong>{candidacy.partyName ? "Joining another party doesn’t move this filing" : "You filed as an independent"}</strong>{candidacy.partyName
            ? `It stays under ${candidacy.partyName}. To run under a different party, withdraw it and file again under that party once it’s accredited.`
            : "Joining or registering a party doesn’t change this filing: you stay an independent. To run under the party, withdraw this filing and file again under it once it’s accredited, before the period closes."}</span></p>
          <Link className="portal-button is-ghost" href="/filing/candidacy">Open Candidacy <ArrowRight size={15} aria-hidden="true" /></Link>
        </>
      ) : (
        <>
          <p className="portal-muted">You haven’t filed a candidacy. You can run as an independent, or under a party once it’s accredited and its contact person endorses you.</p>
          <a className="portal-button is-ghost" href="/candidacy">Filing of Candidacy <ArrowRight size={15} aria-hidden="true" /></a>
        </>
      )}
    </section>
  );
}

/**
 * Political Party: the party's information, with its requirements and members under the subtabs.
 * Without a party, joining one or registering a new one; while a request waits, where it stands.
 */
export default async function PartyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { membership, candidacy } = await requireFilingAccount();
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? notices[notice] : undefined;

  if (!membership) {
    const [parties, periods] = await Promise.all([listJoinableParties("pending").catch(() => []), listUnitPeriodsForSite("party-registration").catch(() => [])]);
    const units = openUnits(periods).map((open) => ({ value: open.unit.college ?? "central", label: comelecUnit(open.unit.organizer, open.unit.college) }));
    return (
      <main className="portal-page">
        {message && <Toast message={message} param="notice" />}
        <header className="portal-page-head">
          <div>
            <p className="portal-eyebrow">Political Party</p>
            <TitleWithInfo info="Ask to join a party that’s registering, and its contact person approves you; or register a new party and be its contact person. Then the party’s members upload its documents here.">Political <em>Party</em></TitleWithInfo>
            <p className="portal-muted">You aren’t in a political party yet.</p>
          </div>
        </header>
        <div className="pp-dash-grid pp-join-row">
          <PartyJoin parties={parties} units={units} />
          <CandidacyStanding candidacy={candidacy} />
        </div>
      </main>
    );
  }

  const { party, member } = membership;
  if (member.status !== "active") {
    const contact = party.contactMemberId ? await getMember(party.contactMemberId) : null;
    return (
      <main className="portal-page">
        {message && <Toast message={message} param="notice" />}
        <header className="portal-page-head">
          <div>
            <p className="portal-eyebrow">Political Party</p>
            <TitleWithInfo info="The party’s contact person approves who joins. Until they do, you can take your request back and join or register another party.">{party.name}</TitleWithInfo>
            <p className="portal-muted">{party.reference} · <span className="portal-tag is-gold">Asking to join</span> · {unitName(party.college)}</p>
          </div>
        </header>
        <div className="pp-dash-grid pp-join-row">
          <section className="portal-card pp-waiting">
            <Clock size={22} aria-hidden="true" />
            <div>
              <h2>Waiting for the contact person</h2>
              <p className="portal-muted">You asked to join <strong>{party.name}</strong> on {formatClosing(member.createdAt)}. {contact ? `${fullName(contact)}, its contact person,` : "Its contact person"} approves who joins. Once they do, you’ll see the party’s information, documents and members here, and we’ll email you.</p>
              <p className="pp-waiting-actions"><CancelJoinRequest /></p>
            </div>
          </section>
          <CandidacyStanding candidacy={candidacy} />
        </div>
      </main>
    );
  }

  const [documents, members, candidates] = await Promise.all([listSubmissions(party.id), listMembers(party.id), listPartyCandidates(party.id)]);
  const progress = documentProgress(partyRequirements, documents);
  const contact = members.find((item) => item.id === party.contactMemberId);
  const active = members.filter((item) => item.status === "active");
  const requests = members.length - active.length;
  const contactPerson = isContactPerson(membership);
  const open = isRegistering(party);
  const groupProgress = partyRequirementGroups.map((group) => ({ ...group, ...documentProgress(partyRequirements.filter((item) => (group.ids as readonly string[]).includes(item.id)), documents) }));

  return (
    <main className="portal-page">
      {message && <Toast message={message} param="notice" />}
      <PartyHead party={party} documents={documents} current="information" />

      {party.sanction && <p className="pp-feedback is-changes pp-remarks"><span><strong>The party is {party.sanction}</strong>{party.sanctionReason}</span></p>}
      {party.decisionRemarks && <p className="pp-feedback pp-remarks"><span><strong>The unit wrote</strong>{party.decisionRemarks}</span></p>}

      <div className="pp-dash-grid">
        <section className="portal-card">
          <h2>Party information</h2>
          <dl className="portal-details">
            <div><dt>Party ID</dt><dd>{party.reference}</dd></div>
            <div><dt>Registering with</dt><dd>{unitName(party.college)}</dd></div>
            <div><dt>Established</dt><dd>{formatDate(party.establishedAt)}</dd></div>
            <div><dt>Headquarters</dt><dd>{party.headquarters || "Not given"}</dd></div>
            <div><dt>Contact person</dt><dd>{contact ? <>{fullName(contact)}<br /><small className="portal-muted">{contact.mobileNumber} · {contact.email}</small></> : "Not named"}</dd></div>
            <div><dt>Your role</dt><dd>{contactPerson ? "Contact person" : "Member"}</dd></div>
            <div><dt>Members</dt><dd>{active.length}{requests > 0 ? ` · ${requests} asking to join` : ""}</dd></div>
            <div><dt>Candidates</dt><dd>{candidates.length ? `${candidates.length} · ${candidates.filter((item) => item.endorsement === "endorsed").length} endorsed` : "None"}</dd></div>
            <div><dt>Registered</dt><dd>{formatClosing(party.createdAt)}</dd></div>
          </dl>
        </section>
        <section className="portal-card pp-progress">
          <h2>Requirements</h2>
          <DocumentBar progress={progress} large />
          <ul className="pp-groups">
            {groupProgress.map((group) => (
              <li key={group.key}>
                <Link href={`/filing/party/documents/${group.key}`}>
                  <span><strong>{group.label}</strong><small>{group.approved} of {group.total} approved{group.waiting ? ` · ${group.waiting} waiting for review` : ""}{group.changes ? ` · ${group.changes} to revise` : ""}</small></span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {!open && <p className="portal-muted">{party.sanction ? `The party is ${party.sanction}, so its documents can’t change now.` : "The party’s registration has been decided, so its documents can’t change now."}</p>}
        </section>
      </div>
    </main>
  );
}
