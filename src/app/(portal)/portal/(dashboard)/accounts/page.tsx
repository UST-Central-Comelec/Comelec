import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import { builtInUser, requireExecutive, withPortalUser } from "@/lib/auth/session";
import { getAccounts } from "@/lib/data/queries";
import { accountRoles } from "@/lib/data/types";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Accounts" };

export default async function PortalAccountsPage({ searchParams }: PageProps<"/portal/accounts">) {
  const { notice } = await searchParams;
  const builtIn = builtInUser();
  const [me, accounts] = await withPortalUser(getAccounts(builtIn && { ...builtIn, active: true, createdAt: "", updatedAt: "", updatedBy: "" }), requireExecutive);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Executive</p>
          <TitleWithInfo info="Who can sign in to the portal with their UST Google account. Commissioners manage website content; executives can also add accounts and revoke access.">Accounts</TitleWithInfo>
        </div>
        <Link className="portal-button" href="/portal/accounts/new"><Plus size={16} /> Add account</Link>
      </header>
      <Notice notice={notice} />

      <section className="portal-card is-flush">
        {accounts.length === 0 ? (
          <p className="portal-empty">No accounts yet. <Link href="/portal/accounts/new">Add the first commissioner.</Link></p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Name</th><th>Role</th><th>Access</th><th /></tr></thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      {account.builtIn ? <span className="portal-row-title">{account.name}</span> : <Link className="portal-row-title" href={`/portal/accounts/${account.id}`}>{account.name}</Link>}
                      {account.id === me.id && <span className="portal-tag">You</span>}
                      <small className="portal-muted">{account.email}</small>
                    </td>
                    <td><span className={`portal-tag${account.role === "executive" ? " is-gold" : ""}`}>{accountRoles[account.role]}</span></td>
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
