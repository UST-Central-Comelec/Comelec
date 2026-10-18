import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban } from "lucide-react";
import { programLocked } from "@/lib/applications/options";
import { formatClosing } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { candidacyStatusLabel, candidacyStatusTone, councilOf, endorsementLabel } from "@/lib/candidacy/types";
import { getAccountDetail, listFilingAccounts, touchesUnit, type AccountListRow } from "@/lib/filing-portal/commission";
import type { AccountsArea } from "@/lib/filing-portal/commission-actions";
import { fullName } from "@/lib/filing-portal/types";
import { partyStanding, unitName, yearLevelLabel } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import { TitleWithInfo } from "../info-tip";
import { ViewOnly, ViewOnlyTag } from "../view-only";
import { AccountActions } from "./account-actions";
import { AccountsTable, type AccountRow } from "./accounts-table";
import { CandidacyApplicantsTabs, PartyApplicantsTabs } from "./tabs";
import { Timeline } from "./timeline";
import "../filing-review.css";
import "@/components/filing-portal/documents.css";

// The filing portal's accounts, from either Applicants tab: the list, and one account's page. The
// same accounts show under both, since one account holds a student's party and candidacy alike; a
// Local unit sees the ones tied to its own college's parties and filings.

const areas = {
  polpar: { tab: "polpar/registrations", base: "/portal/polpar/registrations", section: "Political Party" },
  candidacy: { tab: "candidacy/filings", base: "/portal/candidacy/filings", section: "Filing of Candidacy" },
} as const;

const surnameFirst = (person: { lastName: string; firstName: string; middleName: string }) => [person.lastName, person.firstName, person.middleName].filter(Boolean).join(" ");
const facebookHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

function partyCell(row: AccountListRow): AccountRow["party"] {
  const membership = row.membership;
  if (!membership) return null;
  const role = membership.status === "requested" ? "Asking to join" : membership.role === "contact" ? "Contact person" : "Member";
  const standing = partyStanding({ status: membership.partyStatus, sanction: membership.partySanction });
  return { name: membership.partyName, detail: `${role} · ${standing.label}`, tone: membership.status === "requested" ? "is-gold" : standing.tone };
}

function candidacyCell(row: AccountListRow): AccountRow["candidacy"] {
  const candidacy = row.candidacy;
  if (!candidacy) return null;
  if (candidacy.endorsement === "waiting" || candidacy.endorsement === "declined") return { position: candidacy.position, detail: endorsementLabel[candidacy.endorsement].replace("’s endorsement", ""), tone: candidacy.endorsement === "declined" ? "is-warn" : "" };
  return { position: candidacy.position, detail: candidacyStatusLabel[candidacy.status], tone: candidacyStatusTone[candidacy.status] };
}

/** Applicants → Accounts: everyone who has signed up to the filing portal, with their party, candidacy and access. */
export async function FilingAccountsPage({ area }: { area: AccountsArea }) {
  const { tab, base, section } = areas[area];
  const user = await requireAccess(tab);
  const local = user.affiliation === "local";
  const { value: accounts, error } = await settle(local && !user.college ? Promise.resolve([]) : listFilingAccounts(local ? user.college : null));
  const rows: AccountRow[] = (accounts ?? []).map((row) => ({
    id: row.id, name: fullName(row), sortName: surnameFirst(row), email: row.email, studentNumber: row.studentNumber, mobileNumber: row.mobileNumber, college: row.college,
    party: partyCell(row), candidacy: candidacyCell(row), suspended: row.suspendedAt !== null, createdAt: row.createdAt,
  }));

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">{section}</p>
          <TitleWithInfo info="Each student has one filing portal account, made the first time they register a party or file a candidacy with their UST Google account. It holds both. Open an account to correct its details, see its party and candidacy, sign it out everywhere, or suspend it.">Accounts</TitleWithInfo>
          <p className="portal-muted">{local ? `Tied to the ${unitName(user.college ?? "")}’s parties and filings` : "Everyone who has signed up to the filing portal"}</p>
        </div>
      </header>
      {area === "polpar" ? <PartyApplicantsTabs current="accounts" /> : <CandidacyApplicantsTabs current="accounts" />}
      {error ? <p className="portal-form-error" role="alert">Couldn’t load the accounts. Reload the page; if it keeps happening, check that migration 20261018120000_filing_portal_management.sql has been applied. ({error})</p> : (
        <>
          <dl className="portal-kpis fr-kpis">
            <div className="is-lead"><dt>Accounts</dt><dd>{rows.length}</dd></div>
            <div><dt>In a party</dt><dd>{rows.filter((row) => row.party).length}</dd></div>
            <div><dt>Candidates</dt><dd>{rows.filter((row) => row.candidacy).length}</dd></div>
            <div><dt>Suspended</dt><dd>{rows.filter((row) => row.suspended).length}</dd></div>
          </dl>
          <section className="portal-card is-flush"><AccountsTable rows={rows} base={base} /></section>
        </>
      )}
    </main>
  );
}

/** One account: who they are, every party and candidacy under it, what they've been told, and the unit's controls. */
export async function FilingAccountPage({ area, id }: { area: AccountsArea; id: string }) {
  const { tab, base, section } = areas[area];
  const user = await requireAccess(tab);
  const local = user.affiliation === "local";
  const detail = await getAccountDetail(id);
  if (!detail || (local && !user.college) || !touchesUnit(detail.units, local ? user.college : null)) notFound();
  const { account, memberships, candidacies, notices } = detail;
  const name = fullName(account);

  return (
    <main className="portal-page fr-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href={`${base}/accounts`}>← {section} accounts</Link>
          <TitleWithInfo info="The account’s details are what the student typed when they signed up. Correct them here if they’re wrong; the party roster takes the change too. Sign out everywhere ends the sessions open now. A suspended account can’t sign in or file until it’s restored.">{name}</TitleWithInfo>
          <p className="portal-muted">{account.email}</p>
        </div>
        {user.readOnly ? <ViewOnlyTag /> : <AccountActions area={area} id={account.id} seen={account.updatedAt} name={name} suspended={account.suspendedAt !== null} profile={account} />}
      </header>

      {account.suspendedAt && (
        <div className="fr-banner" role="status">
          <Ban size={17} aria-hidden="true" />
          <div><strong>Suspended {formatClosing(account.suspendedAt)}{account.suspendedBy ? ` by ${account.suspendedBy}` : ""}</strong>{account.suspensionReason && <p>{account.suspensionReason}</p>}</div>
        </div>
      )}

      <ViewOnly when={user.readOnly}>
        <div className="fr-summary">
          <section className="portal-card">
            <h2 className="fr-card-title">Profile</h2>
            <dl className="portal-details">
              <div><dt>Name</dt><dd>{[account.lastName, [account.firstName, account.middleName].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</dd></div>
              <div><dt>Student number</dt><dd>{account.studentNumber}</dd></div>
              <div><dt>College or faculty</dt><dd>{account.college}{!programLocked(account.college) && account.program ? <><br /><small className="portal-muted">{account.program}</small></> : null}</dd></div>
              <div><dt>Year level</dt><dd>{yearLevelLabel(account.yearLevel)}</dd></div>
              <div><dt>Mobile number</dt><dd>{account.mobileNumber}</dd></div>
              <div><dt>UST email</dt><dd><a href={`mailto:${account.email}`}>{account.email}</a></dd></div>
              <div><dt>Facebook</dt><dd><a href={facebookHref(account.facebookUrl)} target="_blank" rel="noopener noreferrer">Profile</a></dd></div>
              <div><dt>Signed up</dt><dd>{formatClosing(account.createdAt)}</dd></div>
            </dl>
          </section>
          <section className="portal-card">
            <h2 className="fr-card-title">Access</h2>
            <dl className="portal-details">
              <div><dt>Sign-in</dt><dd><span className={`portal-tag${account.suspendedAt ? " is-danger" : " is-ok"}`}>{account.suspendedAt ? "Suspended" : "Can sign in"}</span></dd></div>
              <div><dt>Signed out everywhere</dt><dd>{account.sessionsRevokedAt ? formatClosing(account.sessionsRevokedAt) : "Never"}</dd></div>
              <div><dt>Notifications read</dt><dd>{account.noticesReadAt ? formatClosing(account.noticesReadAt) : "Not yet"}</dd></div>
            </dl>
          </section>
        </div>
      </ViewOnly>

      <section className="portal-card is-flush">
        <div className="pp-card-head is-padded"><h2>Political parties</h2>{!memberships.length && <span className="portal-muted">Never in a party</span>}</div>
        {memberships.length > 0 && (
          <div className="portal-table-wrap">
            <table className="portal-table fr-table">
              <thead><tr><th>Political party</th><th>Unit</th><th>Their place</th><th>Party</th><th>Since</th></tr></thead>
              <tbody>
                {memberships.map((item) => {
                  const current = item.status === "active" || item.status === "requested";
                  const place = item.status === "requested" ? "Asking to join" : item.status === "declined" ? "Request declined" : item.status === "removed" ? "Removed" : item.role === "contact" ? "Contact person" : "Member";
                  return (
                    <tr key={item.id} className={current ? undefined : "fr-muted-row"}>
                      <td><Link className="portal-row-title" href={`/portal/polpar/registrations/parties/${item.party.id}`}>{item.party.name}</Link><small>{item.party.reference}</small></td>
                      <td>{unitName(item.party.college)}</td>
                      <td>{place}{item.status === "removed" && item.removalReason && <small>{item.removalReason}</small>}</td>
                      <td><span className={`portal-tag ${partyStanding(item.party).tone}`}>{partyStanding(item.party).label}</span></td>
                      <td><time dateTime={item.createdAt}>{formatClosing(item.createdAt)}</time></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-card is-flush">
        <div className="pp-card-head is-padded"><h2>Candidacies</h2>{!candidacies.length && <span className="portal-muted">Never filed</span>}</div>
        {candidacies.length > 0 && (
          <div className="portal-table-wrap">
            <table className="portal-table fr-table">
              <thead><tr><th>Running for</th><th>Party</th><th>Status</th><th>Filed</th></tr></thead>
              <tbody>
                {candidacies.map((item) => (
                  <tr key={item.id} className={item.status === "withdrawn" ? "fr-muted-row" : undefined}>
                    <td><Link className="portal-row-title" href={`/portal/candidacy/filings/${item.id}`}>{item.position}</Link><small>{item.reference} · {councilOf(item.college)}</small></td>
                    <td>{item.partyName ?? "Independent"}{item.partyName && <small>{endorsementLabel[item.endorsement]}</small>}</td>
                    <td><span className={`portal-tag ${candidacyStatusTone[item.status]}`}>{candidacyStatusLabel[item.status]}</span>{item.withdrawalReason && <small>{item.withdrawalReason}</small>}</td>
                    <td><time dateTime={item.createdAt}>{formatClosing(item.createdAt)}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-card">
        <h2 className="fr-card-title">What they’ve been told</h2>
        <Timeline notices={notices} empty="Nothing yet. Notices about their candidacy, and the unit’s changes to their account, show here." />
      </section>
    </main>
  );
}
