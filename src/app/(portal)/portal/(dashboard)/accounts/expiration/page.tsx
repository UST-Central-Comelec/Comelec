import type { Metadata } from "next";
import { AccountsTabs } from "@/components/portal/accounts-tabs";
import { ExpiryForm } from "@/components/portal/expiry-form";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { formatClosing } from "@/lib/applications/period";
import { builtInUser, requireFullAccess, withPortalUser } from "@/lib/auth/session";
import { getAccounts } from "@/lib/data/queries";
import { DEFAULT_EXPIRY, expires, formatExpiry, hasExpired, timeLeft } from "@/lib/portal/expiry";
import { updateAccountExpiry } from "@/lib/portal/expiry-actions";
import { getAccountExpiry } from "@/lib/portal/expiry-store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Account expiration" };

export default async function AccountExpirationPage({ searchParams }: PageProps<"/portal/accounts/expiration">) {
  const builtIn = builtInUser();
  const [, [{ value: expiry, error: loadError }, accounts, { notice }]] = await withPortalUser(Promise.all([settle(getAccountExpiry()), getAccounts(builtIn?.email), searchParams]), requireFullAccess);
  const expiresOn = expiry?.expiresOn ?? DEFAULT_EXPIRY;
  const passed = hasExpired(expiresOn);
  // Who the date applies to: active commissioners, the built-in executive aside.
  const affected = accounts.filter((account) => account.active && !account.builtIn && expires(account)).length;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const updated = expiry?.updatedAt && expiry.updatedBy && expiry.updatedBy !== "system" ? `Last changed by ${expiry.updatedBy} · ${formatClosing(expiry.updatedAt)}` : null;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Administrative</p>
          <TitleWithInfo info="The end-of-school-year clean-up. After the expiry date, every commissioner’s access is revoked at once: Executive Board, Executive Associates and Deputies, Central and Local. They’re blocked from the portal and leave the Directory. Official accounts, advisers and admins have no expiry. A revoked account can be restored under Accounts, and then lasts until the next date you set.">Accounts</TitleWithInfo>
        </div>
      </header>
      <AccountsTabs current="expiration" showBoardTabs />
      <Notice notice={notice} />

      {loadError && (
        <p className="portal-form-error" role="alert">
          Couldn’t load the saved date, so this shows the default. Run <code>supabase/migrations/0023_account_expiry.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}

      <section className={`period-overview ${passed ? "is-closed" : "is-open"}`} aria-label="Expiry status">
        <div className="period-overview-main">
          <span className="period-overview-state"><i aria-hidden="true" />{passed ? "Expired" : "Running"}</span>
          <h2>{passed ? `Expired on ${formatExpiry(expiresOn)}` : `Expires ${formatExpiry(expiresOn)}`}</h2>
          <p>
            {passed
              ? "Commissioners’ access was revoked. Set a new date for the accounts you restore or add."
              : `${affected === 1 ? "1 commissioner’s account" : `${affected} commissioners’ accounts`} will be revoked at the end of that day, ${timeLeft(expiresOn)}. Official accounts, advisers and admins aren’t affected.`}
          </p>
        </div>
        {updated && <p className="period-overview-meta">{updated}</p>}
      </section>

      <section className="portal-card portal-settings" aria-labelledby="expiry-title">
        <header className="portal-settings-head">
          <TitleWithInfo as="h2" className="portal-card-title" id="expiry-title" info="One date for every commissioner’s account. Each account’s page shows it too.">Access expiry</TitleWithInfo>
        </header>
        <ExpiryForm key={expiresOn} action={updateAccountExpiry} expiresOn={passed ? "" : expiresOn} today={today} />
      </section>
    </main>
  );
}
