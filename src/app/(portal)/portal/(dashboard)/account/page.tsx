import type { Metadata } from "next";
import { requirePortalUser } from "@/lib/auth/session";
import { accountRoles } from "@/lib/data/types";

export const metadata: Metadata = { title: "My account" };

export default async function MyAccountPage() {
  const me = await requirePortalUser();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">My account</p>
          <h1>{me.name}</h1>
          <p className="portal-muted">{me.email} · {accountRoles[me.role]}</p>
        </div>
      </header>

      <section className="portal-card">
        <h2 className="portal-card-title">Sign-in</h2>
        <p className="portal-muted portal-card-intro">
          You sign in with your UST Google account, so there’s no portal password to manage.
          {me.builtIn
            ? " This is the built-in executive account, set on the server as PORTAL_EXECUTIVE_EMAIL; it can’t be revoked from the portal."
            : " Your name and role are managed by an executive under Accounts."}
        </p>
      </section>
    </main>
  );
}
