import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccountDetailsForm } from "@/components/portal/account-forms";
import { DeleteButton } from "@/components/portal/delete-button";
import { Notice } from "@/components/portal/notice";
import { requireExecutive, withPortalUser } from "@/lib/auth/session";
import { getAccount } from "@/lib/data/queries";
import { accountRoles } from "@/lib/data/types";
import { setAccountAccess, updateAccountDetails } from "@/lib/portal/account-actions";

export const metadata: Metadata = { title: "Manage account" };

export default async function ManageAccountPage({ params, searchParams }: PageProps<"/portal/accounts/[id]">) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const [me, account] = await withPortalUser(getAccount(id), requireExecutive);
  if (id === me.id) redirect("/portal/account");
  if (!account) notFound();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/accounts">← Accounts</Link>
          <h1>{account.name}</h1>
          <p className="portal-muted">
            {account.email} · {accountRoles[account.role]} · {account.active ? "Active" : "Access revoked"}. Last changed {new Date(account.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by {account.updatedBy}.
          </p>
        </div>
        {account.active ? (
          <DeleteButton action={setAccountAccess.bind(null, account.id, false)} label="Revoke access" prompt="Block their access to the portal?" confirmLabel="Yes, revoke" pendingLabel="Revoking…" />
        ) : (
          <form action={setAccountAccess.bind(null, account.id, true)}>
            <button className="portal-button" type="submit">Restore access</button>
          </form>
        )}
      </header>
      <Notice notice={notice} />
      {!account.active && <p className="portal-form-error">This account’s access is revoked. They can’t sign in until you restore it.</p>}

      <section className="portal-card">
        <h2 className="portal-card-title">Details and role</h2>
        <AccountDetailsForm action={updateAccountDetails.bind(null, account.id)} initial={account} cancelHref="/portal/accounts" />
      </section>
    </main>
  );
}
