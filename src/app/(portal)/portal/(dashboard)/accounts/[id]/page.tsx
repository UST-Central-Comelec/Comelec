import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Ban, CalendarClock, RotateCcw, Trash2 } from "lucide-react";
import { AccountForm } from "@/components/portal/account-forms";
import { ActionButton, DeleteButton } from "@/components/portal/delete-button";
import { Notice } from "@/components/portal/notice";
import { InfoTip } from "@/components/portal/info-tip";
import { ViewOnly, ViewOnlyTag } from "@/components/portal/view-only";
import { allowed, isBuiltInEmail, withPortalUser } from "@/lib/auth/session";
import { accountStatusOf, detailsFor } from "@/lib/data/accounts";
import { getAccount } from "@/lib/data/queries";
import { deleteAccount, setAccountAccess, updateAccountDetails } from "@/lib/portal/account-actions";
import { canManageAccount, canSeeUnit } from "@/lib/portal/account-scope";
import { expires, formatExpiry, timeLeft } from "@/lib/portal/expiry";
import { getExpiryDate } from "@/lib/portal/expiry-store";

export const metadata: Metadata = { title: "Manage account" };

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export default async function ManageAccountPage({ params, searchParams }: PageProps<"/portal/accounts/[id]">) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const [me, [account, expiresOn]] = await withPortalUser(Promise.all([getAccount(id), getExpiryDate()]), allowed("accounts"));
  // Your own account opens too, to correct your own details. Any other has to be in your reach;
  // an Adviser or Admin reads the accounts of the unit they see, and changes none.
  const own = id === me.id;
  const viewer = me.readOnly;
  if (!account || !(viewer ? canSeeUnit(me, account) : own || canManageAccount(me, account))) notFound();
  const builtIn = isBuiltInEmail(account.email);
  // The built-in executive is Central Executive Board whatever its row says.
  const shown = builtIn ? { ...account, affiliation: "central" as const, position: "executive-board" as const } : account;
  const status = accountStatusOf(account);
  const official = account.kind === "official";
  const needsRole = !official && detailsFor(shown.affiliation, shown.position).role;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/accounts">← Accounts</Link>
          <h1>{account.name}</h1>
          <p className="portal-muted">
            {account.email}
            {account.emailVerifiedAt && (
              <span className="portal-verified">
                <InfoTip label="Email verification" icon={<BadgeCheck size={14} aria-hidden="true" />}>
                  verified on {formatWhen(account.emailVerifiedAt)}
                </InfoTip>
              </span>
            )}
            <br />
            Last changed {formatWhen(account.updatedAt)}
            {!account.emailVerifiedAt && <><br />Email verification is pending: they haven’t signed in yet. Their first Google sign-in verifies the email.</>}
          </p>
        </div>
        <div className="portal-head-actions">
          {status !== "active" && <span className="portal-tag is-warn">{status === "pending" ? "Pending" : "Revoked"}</span>}
          {viewer && <ViewOnlyTag />}
          {/* Commissioners' access ends with the school year; the rest have no expiry. */}
          {expires(account) && !builtIn ? (
            <p className="portal-expiry" title="Set under Accounts → Expiration, for every commissioner’s account.">
              <CalendarClock size={16} strokeWidth={1.8} aria-hidden="true" />
              <span><small>{account.active ? "Access expires" : "Expiry date"}</small><strong>{formatExpiry(expiresOn)}</strong></span>
              {account.active && <em>{timeLeft(expiresOn)}</em>}
            </p>
          ) : (
            <p className="portal-expiry is-none"><CalendarClock size={16} strokeWidth={1.8} aria-hidden="true" /><span><small>Access expires</small><strong>No expiry</strong></span></p>
          )}
        </div>
      </header>
      <Notice notice={notice} />
      {!account.active && <p className="portal-form-error">This account’s access is revoked. They can’t sign in, and they’re out of the Directory, until it’s restored.</p>}
      {account.active && needsRole && !account.role && <p className="portal-form-error">This account has no role yet, so it isn’t listed in the Directory.{viewer ? "" : " Pick one below."}</p>}

      <section className="portal-card">
        <h2 className="portal-card-title">{own ? "Your details" : "Details"}</h2>
        {own && !builtIn && !viewer && <p className="portal-muted">Your affiliation, position and college are someone else’s to change. The rest is yours to correct.</p>}
        {!official && !account.lastName && !viewer && <p className="portal-muted">Added before accounts had these details. Their whole name is in First name for now: split it up, and fill in the rest.</p>}
        <ViewOnly when={viewer}>
          <AccountForm
            action={updateAccountDetails.bind(null, account.id)}
            manager={me}
            email={account.email}
            fixedUnit={own || builtIn || viewer}
            initial={{ ...shown, firstName: account.lastName || official ? account.firstName : account.name }}
            submitLabel="Save changes"
            cancelHref="/portal/accounts"
            danger={
              // Nobody revokes or deletes their own account, or the built-in executive's.
              own || builtIn || viewer ? undefined : (
                <div className="portal-account-danger">
                  {account.active ? (
                    <DeleteButton tone="quiet" icon={<Ban size={15} aria-hidden="true" />} action={setAccountAccess.bind(null, account.id, false)} label="Revoke access" prompt="Block their access to the portal?" confirmLabel="Yes, revoke" pendingLabel="Revoking…" />
                  ) : (
                    <ActionButton icon={<RotateCcw size={15} aria-hidden="true" />} action={setAccountAccess.bind(null, account.id, true)} label="Restore access" pendingLabel="Restoring…" />
                  )}
                  <DeleteButton icon={<Trash2 size={15} aria-hidden="true" />} action={deleteAccount.bind(null, account.id)} label="Delete account" prompt="Delete this account for good? This can’t be undone." />
                </div>
              )
            }
          />
        </ViewOnly>
      </section>
    </main>
  );
}
