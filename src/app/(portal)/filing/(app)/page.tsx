import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Toast } from "@/components/portal/toast";
import { formatClosing } from "@/lib/applications/period";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { listCandidacyDocuments } from "@/lib/candidacy/store";
import { candidacyStatusLabel, candidacyStatusTone, councilOf, endorsementLabel } from "@/lib/candidacy/types";
import { noticesFor } from "@/lib/filing-portal/notices";
import { isContactPerson, requireFilingAccount } from "@/lib/filing-portal/session";
import { fullName } from "@/lib/filing-portal/types";
import { requirements } from "@/lib/polpar/content";
import { getMember, listMembers, listSubmissions } from "@/lib/party-portal/store";
import { partyStanding, unitName } from "@/lib/party-portal/types";

export const metadata: Metadata = { title: "Dashboard" };

const notices: Record<string, string> = {
  requested: "You’ve asked to join. The party’s contact person will review your request.",
  withdrawn: "Your candidacy is withdrawn. Give your Comelec unit your sworn declaration of withdrawal too. You can file again while filing is open.",
};

/** The account's applications at a glance: its party's registration and its own candidacy, with the latest news of both. */
export default async function FilingDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filing = await requireFilingAccount();
  const { account, membership, candidacy } = filing;
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? notices[notice] : undefined;
  const active = membership?.member.status === "active" ? membership : null;

  const [partyDocuments, members, contact, candidacyDocuments, latest] = await Promise.all([
    active ? listSubmissions(active.party.id) : Promise.resolve([]),
    active ? listMembers(active.party.id) : Promise.resolve([]),
    membership?.party.contactMemberId ? getMember(membership.party.contactMemberId) : Promise.resolve(null),
    candidacy ? listCandidacyDocuments(candidacy.id) : Promise.resolve([]),
    noticesFor(filing, 5),
  ]);
  const approved = (list: Array<{ status: string }>) => list.filter((item) => item.status === "approved").length;
  const waiting = (list: Array<{ status: string }>) => list.filter((item) => item.status === "submitted").length;
  const changes = (list: Array<{ status: string }>) => list.filter((item) => item.status === "changes").length;
  const requests = members.filter((item) => item.status === "requested").length;
  const contactPerson = active ? isContactPerson(active) : false;
  const first = account.firstName.split(" ")[0] ?? "";
  const hello = first ? first.charAt(0) + first.slice(1).toLowerCase() : "there";

  return (
    <main className="portal-page">
      {message && <Toast message={message} param="notice" />}
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing portal</p>
          <TitleWithInfo info="Your political party’s registration and your own candidacy, each its own application, filed with your Comelec unit. Sign in here with the same UST Google account for both.">Hi, <em>{hello}</em></TitleWithInfo>
          <p className="portal-muted">{account.email}</p>
        </div>
      </header>

      <div className="pp-dash-grid is-even">
        <section className="portal-card pp-application">
          <div className="pp-card-head"><h2>Political party</h2>{active && <span className={`portal-tag ${partyStanding(active.party).tone}`}>{partyStanding(active.party).label}</span>}</div>
          {active ? (
            <>
              <p className="pp-application-name">{active.party.name}</p>
              <dl className="portal-details">
                <div><dt>Party ID</dt><dd>{active.party.reference}</dd></div>
                <div><dt>Registering with</dt><dd>{unitName(active.party.college)}</dd></div>
                <div><dt>Documents</dt><dd>{approved(partyDocuments)} of {requirements.length} approved{waiting(partyDocuments) ? ` · ${waiting(partyDocuments)} waiting for review` : ""}{changes(partyDocuments) ? ` · ${changes(partyDocuments)} with changes asked` : ""}</dd></div>
                <div><dt>Members</dt><dd>{members.filter((item) => item.status === "active").length}{requests > 0 && contactPerson ? <> · <Link href="/filing/party/members">{requests} asking to join</Link></> : null}</dd></div>
                <div><dt>Your role</dt><dd>{contactPerson ? "Contact person" : "Member"}</dd></div>
              </dl>
              <Link className="portal-button" href="/filing/party">Open Political Party <ArrowRight size={15} aria-hidden="true" /></Link>
            </>
          ) : membership ? (
            <div className="pp-waiting">
              <Clock size={20} aria-hidden="true" />
              <p className="portal-muted">You asked to join <strong>{membership.party.name}</strong> on {formatClosing(membership.member.createdAt)}. {contact ? `${fullName(contact)}, its contact person,` : "Its contact person"} approves who joins. Once they do, you’ll see the party’s documents here, and we’ll email you.</p>
            </div>
          ) : (
            <>
              <p className="portal-muted">You aren’t in a political party here. Ask to join one that’s registering, or register a new one, under Political Party.</p>
              <Link className="portal-button is-ghost" href="/filing/party">Join or register a party <ArrowRight size={15} aria-hidden="true" /></Link>
            </>
          )}
        </section>

        <section className="portal-card pp-application">
          <div className="pp-card-head"><h2>Candidacy</h2>{candidacy && <span className={`portal-tag ${candidacyStatusTone[candidacy.status]}`}>{candidacyStatusLabel[candidacy.status]}</span>}</div>
          {candidacy ? (
            <>
              <p className="pp-application-name">{candidacy.position}</p>
              <dl className="portal-details">
                <div><dt>Filing ID</dt><dd>{candidacy.reference}</dd></div>
                <div><dt>Council</dt><dd>{councilOf(candidacy.college)}</dd></div>
                <div><dt>Running</dt><dd>{candidacy.partyName ? `Under ${candidacy.partyName}` : "As an independent"}</dd></div>
                {candidacy.partyId && <div><dt>Endorsement</dt><dd>{endorsementLabel[candidacy.endorsement]}</dd></div>}
                <div><dt>Documents</dt><dd>{approved(candidacyDocuments)} of {candidacyRequirements.length} approved{waiting(candidacyDocuments) ? ` · ${waiting(candidacyDocuments)} waiting for review` : ""}{changes(candidacyDocuments) ? ` · ${changes(candidacyDocuments)} with changes asked` : ""}</dd></div>
              </dl>
              <Link className="portal-button is-ghost" href="/filing/candidacy">Open Candidacy <ArrowRight size={15} aria-hidden="true" /></Link>
            </>
          ) : (
            <>
              <p className="portal-muted">You haven’t filed a candidacy. File one on the Filing of Candidacy page while your unit is taking filings.</p>
              <a className="portal-button is-ghost" href="/candidacy">Filing of Candidacy <ArrowRight size={15} aria-hidden="true" /></a>
            </>
          )}
        </section>
      </div>

      <section className="portal-card">
        <div className="pp-card-head"><h2>Latest announcements</h2><Link href="/filing/announcements">All announcements</Link></div>
        {latest.length ? (
          <ul className="pp-notices is-compact">
            {latest.map((item) => (
              <li key={item.id}>
                <strong>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</strong>
                {item.body && <p>{item.body}</p>}
                <small>{[item.actor, formatClosing(item.createdAt)].filter(Boolean).join(" · ")}</small>
              </li>
            ))}
          </ul>
        ) : <p className="portal-empty">Nothing yet. Your unit’s feedback, decisions and answers to your requests show up here.</p>}
      </section>
    </main>
  );
}
