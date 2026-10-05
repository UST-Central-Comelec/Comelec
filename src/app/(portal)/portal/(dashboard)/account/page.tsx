import type { Metadata } from "next";
import Link from "next/link";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { BUILT_IN_ID, canOpen, requirePortalUser } from "@/lib/auth/session";
import { describeRole, detailsFor } from "@/lib/data/accounts";
import { getAccount } from "@/lib/data/queries";
import { accountAffiliations, accountKinds, accountPositions, describeAffiliation } from "@/lib/data/types";
import { yearLevels } from "@/lib/applications/options";
import { accessLevels, tabGroups } from "@/lib/portal/access";

export const metadata: Metadata = { title: "My account" };

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" });

export default async function MyAccountPage() {
  const me = await requirePortalUser();
  // The built-in executive has no row until it adds its details.
  const account = me.id === BUILT_IN_ID ? null : await getAccount(me.id);
  const manages = canOpen(me, "accounts") && !me.readOnly;
  const official = me.kind === "official";
  const needs = detailsFor(me.affiliation, me.position);
  // What's open to them, main tab by main tab, as the sidebar shows it.
  const open = tabGroups
    .map((group) => ({ name: group.label ?? group.tabs[0].label, tabs: group.tabs.filter((tab) => me.tabs.includes(tab.key)), whole: group.tabs.every((tab) => me.tabs.includes(tab.key)), single: group.label === null }))
    .filter((group) => group.tabs.length > 0);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">My account</p>
          <h1>{me.name}</h1>
          <p className="portal-muted">{me.email} · {describeAffiliation(me.affiliation, me.college)} · {describeRole(me)}</p>
        </div>
        {manages && account && <Link className="portal-button is-ghost" href={`/portal/accounts/${account.id}`}>Edit my details</Link>}
        {manages && !account && me.builtIn && <Link className="portal-button is-ghost" href="/portal/accounts/new?for=built-in">Add my details</Link>}
      </header>

      <section className="portal-card">
        <TitleWithInfo as="h2" className="portal-card-title" info={
          <>
            You sign in with your UST Google account, so there’s no portal password to manage.
            {me.builtIn
              ? " This is the built-in executive account, set on the server as PORTAL_EXECUTIVE_EMAIL; it can’t be revoked from the portal."
              : " Your affiliation, position and access are managed under Accounts by the Executive Board."}
          </>
        }>Sign-in</TitleWithInfo>
        <p className="portal-account-signin">Google account <strong>{me.email}</strong>{me.builtIn && <span className="portal-tag is-gold">Built-in executive</span>}{account?.emailVerifiedAt && <span className="portal-tag is-ok">Verified {formatDay(account.emailVerifiedAt)}</span>}</p>
      </section>

      <section className="portal-card">
        <TitleWithInfo as="h2" className="portal-card-title" info={manages ? "Your account’s details. Edit them under Accounts." : "Your account’s details. To correct something, ask whoever manages your unit’s accounts: your Executive Board."}>Details</TitleWithInfo>
        {account && official ? (
          <dl className="portal-details">
            <div><dt>Category</dt><dd>{accountKinds.official}</dd></div>
            <div><dt>Name</dt><dd>{account.name}</dd></div>
            <div><dt>UST email</dt><dd>{account.email}</dd></div>
            <div><dt>Unit</dt><dd>{describeAffiliation(me.affiliation, me.college)}</dd></div>
          </dl>
        ) : account ? (
          <dl className="portal-details">
            <div><dt>Last name</dt><dd>{account.lastName || <span className="portal-muted">Not set</span>}</dd></div>
            <div><dt>First name</dt><dd>{account.firstName || account.name}</dd></div>
            <div><dt>Middle name</dt><dd>{account.middleName || account.middleInitial || <span className="portal-muted">None</span>}</dd></div>
            <div><dt>UST email</dt><dd>{account.email}</dd></div>
            {needs.studentNumber && <div><dt>Student ID</dt><dd>{account.studentNumber ?? <span className="portal-muted">Not set</span>}</dd></div>}
            <div><dt>Affiliation</dt><dd>{accountAffiliations[me.affiliation]}</dd></div>
            <div><dt>Position</dt><dd>{accountPositions[me.position]}</dd></div>
            {needs.role && <div><dt>Role</dt><dd>{account.role || <span className="portal-muted">Not set, so you aren’t in the Directory yet</span>}</dd></div>}
            {needs.college !== "none" && <div><dt>College or faculty</dt><dd>{account.college ?? <span className="portal-muted">Not set</span>}</dd></div>}
            {needs.program && <div><dt>Program</dt><dd>{account.program ?? <span className="portal-muted">Not set</span>}</dd></div>}
            {needs.program && <div><dt>Year level</dt><dd>{yearLevels[account.yearLevel as keyof typeof yearLevels] ?? <span className="portal-muted">Not set</span>}</dd></div>}
            <div><dt>Facebook link</dt><dd>{account.facebookUrl ? <a href={account.facebookUrl} target="_blank" rel="noreferrer">{account.facebookUrl.replace(/^https?:\/\/(www\.)?/, "")}</a> : <span className="portal-muted">None</span>}</dd></div>
          </dl>
        ) : (
          <p className="portal-muted">The built-in executive has access without an account of its own, so it isn’t in the Directory. Add your details to be listed there.</p>
        )}
      </section>

      <section className="portal-card">
        <TitleWithInfo as="h2" className="portal-card-title" info={`What the portal opens to you as ${accessLevels[me.level]}. The Central Executive Board sets this for each level under Accounts → Access Control.${me.affiliation === "local" ? " As a Local account you see only your own college’s records in each." : ""}${me.readOnly ? " Your account is view only: you can read these, and change nothing." : ""}`}>Access</TitleWithInfo>
        {open.length ? (
          <dl className="portal-details">
            {open.map((group) => (
              <div key={group.name}><dt>{group.name}</dt><dd>{group.single ? "Open" : group.whole ? "All subtabs" : group.tabs.map((tab) => tab.label).join(", ")}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="portal-muted">No tabs are open to your level right now. Ask the Central Executive Board.</p>
        )}
      </section>
    </main>
  );
}
