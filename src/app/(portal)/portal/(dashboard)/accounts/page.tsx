import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleDashed, Plus } from "lucide-react";
import { AccessRequestRow } from "@/components/portal/access-requests";
import { AccountsTabs } from "@/components/portal/accounts-tabs";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { unitAbbreviations } from "@/lib/applications/options";
import { listPendingAccessRequests } from "@/lib/access-requests/admin";
import { allowed, builtInUser, isLocal, withPortalUser } from "@/lib/auth/session";
import { accountStatusOf, detailsFor, listName } from "@/lib/data/accounts";
import { getAccounts } from "@/lib/data/queries";
import { accountAffiliations, accountKinds, accountPositions, type AccountSummary } from "@/lib/data/types";
import { FULL_ACCESS } from "@/lib/portal/access";
import { canDecideRequest, canManageAccount, canSeeUnit } from "@/lib/portal/account-scope";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Accounts" };

/** Pending includes access requests and accounts waiting for their first Google sign-in. */
const filters = { pending: "Pending", active: "Active", revoked: "Revoked" } as const;
type Filter = keyof typeof filters;
const isFilter = (value: unknown): value is Filter => typeof value === "string" && value in filters;

/** The two categories of account, to show one at a time. */
const categories = { personal: "Commissioner", official: "Official" } as const;
type Category = keyof typeof categories;
const isCategory = (value: unknown): value is Category => typeof value === "string" && value in categories;

const emptyText: Record<Filter, string> = {
  pending: "No pending accounts or access requests.",
  active: "No active accounts.",
  revoked: "No revoked accounts.",
};

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

/** Whether the UST email has been proved with Google: on approval of an access request, or at their first sign-in. */
function Verified({ at }: { at: string | null }) {
  return at ? (
    <span className="portal-account-check is-verified" title={`Verified with Google on ${formatDay(at)}`}><BadgeCheck size={12} aria-hidden="true" /> Verified</span>
  ) : (
    <span className="portal-account-check" title="Added by hand, and nobody has signed in with it yet. It’s verified the first time they sign in with Google."><CircleDashed size={12} aria-hidden="true" /> Not verified yet</span>
  );
}

/**
 * A name, with the "You" tag after it on your own row. The tag is tied to the name's last word, so
 * when a long name wraps, the tag never ends up on a line by itself.
 */
function RowName({ name, own }: { name: string; own: boolean }) {
  if (!own) return <>{name}</>;
  const cut = name.lastIndexOf(" ") + 1;
  return <>{name.slice(0, cut)}<span className="portal-row-keep">{name.slice(cut)}<span className="portal-tag">You</span></span></>;
}

/** The affiliation in short: CENTRAL, a Local unit's abbreviation (COS, PHARMA), or OSA for the Office for Student Affairs. */
const affiliationShort = (account: Pick<AccountSummary, "affiliation" | "college">) =>
  account.affiliation === "central" ? "CENTRAL" : account.affiliation === "local" ? (account.college ? (unitAbbreviations[account.college] ?? account.college) : "LOCAL") : "OSA";

/** What the account is: its position, or that it's a unit's official account. The role is on the account's own page. */
function Standing({ account }: { account: AccountSummary }) {
  if (account.kind === "official") return <><span className="portal-tag is-local">{accountKinds.official}</span></>;
  return <span className={`portal-tag${account.position === "executive-board" ? " is-gold" : ""}`}>{accountPositions[account.position]}</span>;
}

export default async function PortalAccountsPage({ searchParams }: PageProps<"/portal/accounts">) {
  const { notice, status: statusParam, kind: kindParam } = await searchParams;
  const status = isFilter(statusParam) ? statusParam : undefined;
  const category = isCategory(kindParam) ? kindParam : undefined;
  const builtIn = builtInUser();
  const [me, [everyAccount, { value: everyRequest, error: requestsError }]] = await withPortalUser(Promise.all([getAccounts(builtIn?.email), settle(listPendingAccessRequests())]), allowed("accounts"));

  // A Local account sees its own college's Local Comelec; anyone else, everybody. An Adviser or
  // Admin reads the list; nothing on it is theirs to change.
  const local = isLocal(me);
  const viewer = me.readOnly;
  const inUnit = everyAccount.filter((account) => canSeeUnit(me, account));
  const pending = (everyRequest ?? []).filter((request) => (viewer ? canSeeUnit(me, request) : canDecideRequest(me, request)));
  // The built-in executive has access without a row; until it has one, it's listed on its own.
  const bare = !local && builtIn && !everyAccount.some((account) => account.builtIn) ? builtIn : null;

  // Requests are for personal accounts, and come first under All, so they're seen before anything else.
  const requests = (!status || status === "pending") && category !== "official" ? pending : [];
  // The Central Comelec's own account leads the list.
  const leads = (account: AccountSummary) => Number(account.kind === "official" && account.affiliation === "central");
  const accounts = [...inUnit].sort((a, b) => leads(b) - leads(a)).filter((account) => (!status || accountStatusOf(account) === status) && (!category || account.kind === category));
  const pendingCount = (category === "official" ? 0 : pending.length) + inUnit.filter((account) => accountStatusOf(account) === "pending" && (!category || account.kind === category)).length;
  const showBare = bare && status !== "pending" && status !== "revoked" && category !== "official";
  const empty = requests.length === 0 && accounts.length === 0 && !showBare;
  const href = (next: { status?: Filter; kind?: Category }) => {
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value) as [string, string][]).toString();
    return query ? `/portal/accounts?${query}` : "/portal/accounts";
  };

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Administrative</p>
          <TitleWithInfo info={local
            ? `${me.college ?? "Your college"}’s Local Comelec: who can sign in to the portal with their UST Google account, and who they are in the commission. The Directory is filled in from the commissioners’ accounts. People without an account can ask for one with Request access on the sign-in page; requests for your Local Comelec show here as Pending, to approve or decline. They’re emailed either way. Manually added accounts stay Pending until their first Google sign-in verifies the email.`
            : "Who can sign in to the portal with their UST Google account, and who they are. Commissioner accounts are people’s own: commissioners, advisers and admins. Official accounts are the units’ shared mailboxes. The Directory and the website’s About page are filled in from the commissioners’ accounts. An account’s affiliation and position decide which tabs it opens; a Local account only sees its own college’s records, and advisers and admins only read. People without an account can ask for one with Request access on the sign-in page; their requests show here as Pending, to approve or decline. They’re emailed either way. Manually added accounts stay Pending until their first Google sign-in verifies the email."}>Accounts</TitleWithInfo>
          {local && <p className="portal-muted">{me.college}</p>}
        </div>
        {viewer ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/accounts/new"><Plus size={16} /> Add account</Link>}
      </header>
      <AccountsTabs current="accounts" showBoardTabs={me.level === FULL_ACCESS} />
      <Notice notice={notice} />

      <div className="portal-filter-rows is-inline">
        <SlidingFilters
          label="Filter by category"
          active={category ?? "all"}
          items={[
            { key: "all", href: href({ status }), label: "All accounts" },
            ...(Object.keys(categories) as Category[]).map((value) => ({ key: value, href: href({ status, kind: value }), label: <>{categories[value]}<small>{inUnit.filter((account) => account.kind === value).length}</small></> })),
          ]}
        />
        <SlidingFilters
          label="Filter by status"
          active={status ?? "all"}
          items={[
            { key: "all", href: href({ kind: category }), label: "All" },
            ...(Object.keys(filters) as Filter[]).map((value) => ({ key: value, href: href({ status: value, kind: category }), label: `${filters[value]}${value === "pending" && pendingCount ? ` (${pendingCount})` : ""}` })),
          ]}
        />
      </div>

      {requestsError && (
        <p className="portal-form-error" role="alert">
          Couldn’t load pending access requests. Run <code>supabase/migrations/0016_access_requests.sql</code> in the Supabase SQL Editor, then reload. ({requestsError})
        </p>
      )}

      <section className="portal-card is-flush">
        {empty ? (
          <p className="portal-empty">{status ? emptyText[status] : category === "official" ? "No official accounts." : viewer ? "No accounts yet." : <>No accounts yet. <Link href="/portal/accounts/new">Add the first one.</Link></>}</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table portal-accounts">
              <thead><tr><th>Name</th><th>Student ID</th><th>Affiliation</th><th>Position</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody key={`${status ?? "all"}-${category ?? "all"}`}>
                {requests.map((request) => <AccessRequestRow key={request.id} request={request} manager={viewer ? null : { kind: me.kind, affiliation: me.affiliation, position: me.position, college: me.college }} />)}
                {showBare && (
                  <tr>
                    <td>
                      <span className="portal-row-title"><RowName name={bare.name} own={bare.id === me.id} /></span>
                      <small className="portal-muted">{bare.email}</small>
                    </td>
                    <td className="portal-muted">Not set</td>
                    <td>CENTRAL</td>
                    <td>
                      <span className="portal-tag is-gold">{accountPositions["executive-board"]}</span>
                      <small className="portal-muted">Not in the Directory yet</small>
                    </td>
                    <td><span className="portal-tag">Built-in</span></td>
                    <td className="portal-row-actions">{!viewer && <Link href="/portal/accounts/new?for=built-in">Add details</Link>}</td>
                  </tr>
                )}
                {accounts.map((account) => {
                  const own = account.id === me.id;
                  const accountStatus = accountStatusOf(account);
                  const manageable = !viewer && (own || canManageAccount(me, account));
                  const student = account.kind === "personal" && detailsFor(account.affiliation, account.position).studentNumber;
                  return (
                    <tr key={account.id}>
                      <td>
                        {manageable || viewer ? <Link className="portal-row-title" href={`/portal/accounts/${account.id}`}><RowName name={listName(account)} own={own} /></Link> : <span className="portal-row-title"><RowName name={listName(account)} own={own} /></span>}
                        {/* A unit's account is known by its email; a person's email, program and role are on their own page. */}
                        {account.kind === "official" && <small className="portal-muted portal-account-email">{account.email} <Verified at={account.emailVerifiedAt} /></small>}
                      </td>
                      <td>
                        {student ? (
                          <>
                            {account.studentNumber ?? <span className="portal-muted">Not set</span>}
                          </>
                        ) : (
                          // A unit's account has no student ID; its unit, in short, stands there instead.
                          account.kind === "official" ? <span title={account.affiliation === "local" ? (account.college ?? undefined) : accountAffiliations[account.affiliation]}>{affiliationShort(account)}</span> : <span className="portal-muted">Not a student</span>
                        )}
                      </td>
                      <td>
                        {account.kind === "official" ? (account.affiliation === "local" ? "Local" : "Central") : <span title={account.affiliation === "local" ? (account.college ?? undefined) : accountAffiliations[account.affiliation]}>{affiliationShort(account)}</span>}
                      </td>
                      <td><Standing account={account} /></td>
                      <td>
                        <span className={`portal-tag${accountStatus === "active" ? " is-ok" : " is-warn"}`} title={accountStatus === "pending" ? "Awaiting their first Google sign-in to verify the email." : undefined}>{filters[accountStatus]}</span>
                        {account.builtIn && <span className="portal-tag">Built-in</span>}
                      </td>
                      <td className="portal-row-actions">{manageable ? <Link href={`/portal/accounts/${account.id}`}>{own ? "Edit" : "Manage"}</Link> : viewer && <Link href={`/portal/accounts/${account.id}`}>View</Link>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
