import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/components/portal/login-form";
import { getPortalUser, isLoginConfigured } from "@/lib/auth/session";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  "not-ust": "Sign in with your @ust.edu.ph Google account. Personal Google accounts can’t access the portal.",
  "not-registered": "That UST account hasn’t been added to the portal. Ask an executive to add you under Accounts.",
  revoked: "Your portal access has been revoked. Contact an executive if you think this is a mistake.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "not-configured": "Sign-in isn’t configured on this server yet.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
};

/** Why the last session ended, when it wasn't the person signing out. */
const reasons: Record<string, string> = {
  idle: "You were signed out after 30 minutes of inactivity. Sign in again to continue.",
  expired: "For security, sessions end after 8 hours. Sign in again to continue.",
};

export default async function PortalLoginPage({ searchParams }: PageProps<"/portal/login">) {
  // Read the env and session at request time, not at build time.
  await connection();
  if (await getPortalUser()) redirect("/portal");
  const { error, reason } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  const info = typeof reason === "string" ? reasons[reason] : undefined;

  return (
    <main className="portal-login">
      <div className="portal-login-card">
        <div className="portal-brand">
          <Image src="/images/Logo-1.png" alt="" width={44} height={44} priority />
          <span><strong>Commission Portal</strong><small>UST Central Comelec</small></span>
        </div>
        <TitleWithInfo info="For commissioners managing the website’s news, documents, members and recruitment. Use your @ust.edu.ph account; only accounts added by an executive can sign in.">Sign in</TitleWithInfo>
        {message && <p className="portal-form-error portal-login-error" role="alert">{message}</p>}
        {!message && info && <p className="portal-notice portal-login-error" role="status">{info}</p>}
        {isLoginConfigured() ? (
          <LoginForm />
        ) : (
          <p className="portal-form-error" role="alert">
            Sign-in isn’t configured on this server. Set the Supabase keys and <code>PORTAL_EXECUTIVE_EMAIL</code> in <code>.env.local</code>, then restart.
          </p>
        )}
      </div>
    </main>
  );
}
