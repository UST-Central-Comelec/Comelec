import type { Metadata } from "next";
import Link from "next/link";
import { ChamberGroup } from "@/components/portal/chamber-group";
import { CollegeFilter } from "@/components/portal/college-filter";
import { DirectoryCards, type DirectoryCard } from "@/components/portal/directory-cards";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { allowed, canOpen, isLocal, withPortalUser } from "@/lib/auth/session";
import { detailsFor } from "@/lib/data/accounts";
import { getAccounts, getDirectory } from "@/lib/data/queries";
import { directoryGroups, type DirectoryEntry } from "@/lib/data/types";
import { canManageAccount } from "@/lib/portal/account-scope";

export const metadata: Metadata = { title: "Directory" };

const line = (...parts: Array<string | null>) => parts.filter(Boolean).join(" · ");

const groupInfo: Record<keyof typeof directoryGroups, string> = {
  central: "Everyone with a Central Comelec account: the Executive Board in order of rank, then their offices, then the deputies.",
  local: "Everyone with a Local Comelec account, grouped by college, each in the same order: the Executive Board, their offices, then the deputies.",
  "en-banc": "The Central Comelec Executive Board, then each college’s Local Comelec Central Representative.",
  chamber: "Every Local Comelec Chairperson, with the chamber’s Primus (its head) and Vicar (the Primus’s associate) marked. Commissioners set those by clicking a card.",
};

export default async function PortalMembersPage({ searchParams }: PageProps<"/portal/members">) {
  const [user, [directory, accounts, { college: collegeParam }]] = await withPortalUser(Promise.all([getDirectory(), getAccounts(), searchParams]), allowed("members"));
  // A Local account sees only its own college's Local Comelec.
  const local = isLocal(user);
  // Whoever has the Accounts tab and isn't there only to read.
  const manages = canOpen(user, "accounts") && !user.readOnly;
  // Local Comelec, one block per college (alphabetical), optionally narrowed to one college.
  const localColleges = [...new Set(directory.local.map((person) => person.college ?? ""))].sort((a, b) => a.localeCompare(b));
  const college = typeof collegeParam === "string" && localColleges.includes(collegeParam) ? collegeParam : "";
  const shownColleges = local ? localColleges.filter((unit) => unit === user.college) : college ? [college] : localColleges;

  // Active accounts that aren't listed because their role hasn't been picked, for whoever can pick it.
  const unlisted = manages ? accounts.filter((account) => account.active && !account.role && account.kind === "personal" && detailsFor(account.affiliation, account.position).role && (account.id === user.id || canManageAccount(user, account))) : [];

  // Everyone listed is a commissioner, with a personal account.
  const cards = (people: DirectoryEntry[], subtitle: (person: DirectoryEntry) => string): DirectoryCard[] =>
    people.map((person) => ({ id: person.id, name: person.name, email: person.email, facebookUrl: person.facebookUrl, photoUrl: person.photoUrl, subtitle: subtitle(person), manageable: manages && (person.id === user.id || canManageAccount(user, { ...person, kind: "personal" })) }));

  const empty = (message: string) => <p className="portal-empty">{message}</p>;
  const automatic = <span className="portal-tag">From Accounts</span>;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info={local
            ? "Your college’s Local Comelec, as shown in “Meet the commission” on the website’s About page. It’s filled in from Accounts: everyone with an active account and a role is listed, in order of rank. Its Chairperson and Central Representative also appear in the Chamber of Chairpersons and En Banc."
            : "The commission, as shown in “Meet the commission” on the website’s About page. It’s filled in from Accounts: everyone with an active account and a role is listed, in order of rank. Nobody is added here by hand. To add someone, or change how they’re listed, add or edit their account."}>Directory</TitleWithInfo>
          {local && <p className="portal-muted">{user.college}</p>}
        </div>
        {manages && <Link className="portal-button is-ghost" href="/portal/accounts">Manage accounts</Link>}
      </header>

      {unlisted.length > 0 && (
        <p className="portal-muted">
          {unlisted.length === 1 ? "One active account isn’t listed yet, because it has no role: " : `${unlisted.length} active accounts aren’t listed yet, because they have no role: `}
          {unlisted.map((account, index) => <span key={account.id}>{index > 0 && ", "}<Link href={`/portal/accounts/${account.id}`}>{account.name}</Link></span>)}.
        </p>
      )}

      {!local && (
        <>
          <section className="portal-card">
            <div className="portal-card-head">
              <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo.central}>{directoryGroups.central}</TitleWithInfo>
              {automatic}
            </div>
            {directory.central.length ? <DirectoryCards people={cards(directory.central, (person) => person.role)} /> : empty("Nobody yet. This group is hidden on the website until a Central Comelec account has a role.")}
          </section>

          <section className="portal-card">
            <div className="portal-card-head">
              <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo["en-banc"]}>{directoryGroups["en-banc"]}</TitleWithInfo>
              {automatic}
            </div>
            {directory["en-banc"].length
              ? <DirectoryCards people={cards(directory["en-banc"], (person) => (person.affiliation === "central" ? person.role : line(person.role, person.college)))} />
              : empty("Nobody yet. It fills in from the Central Executive Board and each college’s Central Representative.")}
          </section>

          <section className="portal-card">
            <div className="portal-card-head">
              <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo.chamber}>{directoryGroups.chamber}</TitleWithInfo>
              {automatic}
            </div>
            {directory.chamber.length
              ? <ChamberGroup members={directory.chamber.map((person) => ({ id: person.id, name: person.name, college: person.college ?? "", photoUrl: person.photoUrl, role: person.chamberRole }))} editable={!user.readOnly} manageable={manages} />
              : empty("Nobody yet. It fills in from each college’s Local Comelec Chairperson.")}
          </section>
        </>
      )}

      <section className="portal-card" id="local-comelec">
        <div className="portal-card-head">
          <TitleWithInfo as="h2" className="portal-card-title" info={groupInfo.local}>{directoryGroups.local}</TitleWithInfo>
          <div className="directory-head-actions">
            {!local && localColleges.length > 1 && <CollegeFilter colleges={localColleges} value={college} />}
            {automatic}
          </div>
        </div>
        {shownColleges.length === 0
          ? empty(local ? "Nobody yet. Your Local Comelec fills in as its accounts are given a role." : "Nobody yet. This group is hidden on the website until a Local Comelec account has a role.")
          : shownColleges.map((unit) => (
              <div className="directory-college" key={unit}>
                <div className="directory-college-head">
                  <h3>{unit}</h3>
                </div>
                <DirectoryCards people={cards(directory.local.filter((person) => (person.college ?? "") === unit), (person) => person.role)} />
              </div>
            ))}
      </section>
    </main>
  );
}
