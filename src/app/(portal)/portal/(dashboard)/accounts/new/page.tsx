import type { Metadata } from "next";
import Link from "next/link";
import { NewAccountForm } from "@/components/portal/account-forms";
import { requireExecutive } from "@/lib/auth/session";
import { createAccount } from "@/lib/portal/account-actions";

export const metadata: Metadata = { title: "Add account" };

export default async function NewAccountPage() {
  await requireExecutive();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/accounts">← Accounts</Link>
          <h1>Add account</h1>
          <p className="portal-muted">They’ll sign in at this portal’s address with “Sign in with Google”, using the UST email you add here. No password to share.</p>
        </div>
      </header>
      <section className="portal-card">
        <NewAccountForm action={createAccount} />
      </section>
    </main>
  );
}
