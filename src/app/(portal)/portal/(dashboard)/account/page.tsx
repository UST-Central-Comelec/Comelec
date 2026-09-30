import type { Metadata } from "next";
import { requirePortalUser } from "@/lib/auth/session";
import { accountRoles, describeAffiliation } from "@/lib/data/types";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "My account" };

export default async function MyAccountPage() {
  const me = await requirePortalUser();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">My account</p>
          <h1>{me.name}</h1>
          <p className="portal-muted">{me.email} · {accountRoles[me.role]} · {describeAffiliation(me.affiliation, me.college)}</p>
        </div>
      </header>

      <section className="portal-card">
        <TitleWithInfo as="h2" className="portal-card-title" info={
          <>
            You sign in with your UST Google account, so there’s no portal password to manage.
            {me.builtIn
              ? " This is the built-in executive account, set on the server as PORTAL_EXECUTIVE_EMAIL; it can’t be revoked from the portal."
              : " Your name, role, affiliation and college are managed by an executive under Accounts."}
          </>
        }>Sign-in</TitleWithInfo>
        <p className="portal-account-signin">Google account <strong>{me.email}</strong>{me.builtIn && <span className="portal-tag is-gold">Built-in executive</span>}</p>
      </section>
    </main>
  );
}
