import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/portal/account-forms";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { builtInUser, requireAccess } from "@/lib/auth/session";
import { createAccount } from "@/lib/portal/account-actions";

export const metadata: Metadata = { title: "Add account" };

export default async function NewAccountPage({ searchParams }: PageProps<"/portal/accounts/new">) {
  const [me, { for: target }] = await Promise.all([requireAccess("accounts"), searchParams]);
  // Advisers and Admins read the accounts; they don't add any.
  if (me.readOnly) redirect("/portal/accounts");
  // The built-in executive's own row: its email is known, and it's always Central Executive Board.
  const builtIn = target === "built-in" && me.affiliation === "central" ? builtInUser() : null;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/accounts">← Accounts</Link>
          <TitleWithInfo info={builtIn
            ? "The built-in executive already has access. Adding its details lists it in the Directory and on the website’s About page, like any other account."
            : "They’ll sign in at this portal’s address with “Sign in with Google”, using the UST email you add here. No password to share. A commissioner with a role is listed in the Directory and on the website’s About page."}>Add account</TitleWithInfo>
        </div>
      </header>
      <section className="portal-card">
        <AccountForm
          action={createAccount}
          manager={me}
          askEmail
          email={builtIn?.email}
          fixedUnit={Boolean(builtIn)}
          initial={builtIn ? { kind: "personal", lastName: "", firstName: "", middleInitial: "", middleName: "", yearLevel: null, studentNumber: null, affiliation: "central", position: "executive-board", role: "", college: null, program: null, facebookUrl: null, photoUrl: null } : undefined}
          submitLabel="Add account"
          cancelHref="/portal/accounts"
        />
      </section>
    </main>
  );
}
