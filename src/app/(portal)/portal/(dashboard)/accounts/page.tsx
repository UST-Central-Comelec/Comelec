import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AccessRequestRow } from "@/components/portal/access-requests";
import { Notice } from "@/components/portal/notice";
import { listPendingAccessRequests } from "@/lib/access-requests/admin";
import { settle } from "@/lib/portal/settle";
import { builtInUser, requireExecutive, withPortalUser } from "@/lib/auth/session";
import { getAccounts } from "@/lib/data/queries";
import { accountRoles, affiliations } from "@/lib/data/types";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Accounts" };

/** The filters shown above the table. Pending is access requests from the sign-in page, not accounts yet. */
const filters = { pending: "Pending", active: "Active", revoked: "Revoked" } as const;
type Filter = keyof typeof filters;
const isFilter = (value: unknown): value is Filter => typeof value === "string" && value in filters;

const emptyText: Record<Filter, string> = {
  pending: "No pending requests. People without an account can ask for one with Request access on the sign-in page.",
  active: "No active accounts.",
  revoked: "No revoked accounts.",
};

export default async function PortalAccountsPage({ searchParams }: PageProps<"/portal/accounts">) {
  const { notice, status: statusParam } = await searchParams;
  const status = isFilter(statusParam) ? statusParam : undefined;
  const builtIn = builtInUser();
  const [me, [allAccounts, { value: pending, error: requestsError }]] = await withPortalUser(
    Promise.all([getAccounts(builtIn && { ...builtIn, active: true, createdAt: "", updatedAt: "", updatedBy: "" }), settle(listPendingAccessRequests())]),
    requireExecutive,
  );

  // Pending requests come first under All, so they're seen before anything else.
  const requests = !status || status === "pending" ? (pending ?? []) : [];
  const accounts = status === "pending" ? [] : status ? allAccounts.filter((account) => account.active === (status === "active")) : allAccounts;
  const empty = requests.length === 0 && accounts.length === 0;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Executive</p>
          <TitleWithInfo info="Who can sign in to the portal with their UST Google account. Commissioners manage website content; executives can also add accounts and revoke access. Central accounts see the whole portal; Local accounts see only the Directory, Recruitment applications, PolPaR and Filing of Candidacy, for their own college. People without an account can ask for one with Request access on the sign-in page; their requests show here as Pending, to approve (as the role you pick) or decline. They’re emailed either way.">Accounts</TitleWithInfo>
        </div>
        <Link className="portal-button" href="/portal/accounts/new"><Plus size={16} /> Add account</Link>
      </header>
      <Notice notice={notice} />

      <nav className="portal-filters" aria-label="Filter accounts">
        <Link href="/portal/accounts" className={!status ? "is-active" : undefined}>All</Link>
        {(Object.keys(filters) as Filter[]).map((value) => (
          <Link key={value} href={`/portal/accounts?status=${value}`} className={status === value ? "is-active" : undefined}>
            {filters[value]}{value === "pending" && pending?.length ? ` (${pending.length})` : ""}
          </Link>
        ))}
      </nav>

      {requestsError && (
        <p className="portal-form-error" role="alert">
          Couldn’t load pending access requests. Run <code>supabase/migrations/0016_access_requests.sql</code> in the Supabase SQL Editor, then reload. ({requestsError})
        </p>
      )}

      <section className="portal-card is-flush">
        {empty ? (
          <p className="portal-empty">{status ? emptyText[status] : <>No accounts yet. <Link href="/portal/accounts/new">Add the first commissioner.</Link></>}</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Name</th><th>Role</th><th>Affiliation</th><th>Access</th><th /></tr></thead>
              <tbody>
                {requests.map((request) => <AccessRequestRow key={request.id} request={request} />)}
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      {account.builtIn ? <span className="portal-row-title">{account.name}</span> : <Link className="portal-row-title" href={`/portal/accounts/${account.id}`}>{account.name}</Link>}
                      {account.id === me.id && <span className="portal-tag">You</span>}
                      <small className="portal-muted">{account.email}</small>
                    </td>
                    <td><span className={`portal-tag${account.role === "executive" ? " is-gold" : ""}`}>{accountRoles[account.role]}</span></td>
                    <td>
                      {affiliations[account.affiliation]}
                      <small className="portal-muted">{account.college ?? (account.builtIn ? "Built-in executive" : "No college set")}</small>
                    </td>
                    <td>{account.builtIn ? <span className="portal-tag">Built-in</span> : account.active ? <span className="portal-tag is-ok">Active</span> : <span className="portal-tag is-warn">Revoked</span>}</td>
                    <td className="portal-row-actions">{!account.builtIn && account.id !== me.id && <Link href={`/portal/accounts/${account.id}`}>Manage</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
