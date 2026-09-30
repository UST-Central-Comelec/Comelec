import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ClipboardList, FileText, Lock, Newspaper, Users } from "lucide-react";
import { LoginForm } from "@/components/portal/login-form";
import { LoginPanel } from "@/components/portal/login-panel";
import { readAccessPass } from "@/lib/access-requests/verification";
import { getPortalUser, isLoginConfigured } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  "not-ust": "Sign in with your @ust.edu.ph Google account. Personal Google accounts can’t access the portal.",
  "not-registered": "That UST account doesn’t have portal access yet. Use Request access below, and an executive will review it.",
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

/** What the portal manages, shown on the brand panel. */
const features = [
  { icon: Newspaper, title: "News", text: "Publish announcements and election updates." },
  { icon: FileText, title: "Documents", text: "Issue resolutions, memoranda and bulletins." },
  { icon: Users, title: "Directory", text: "Keep the commission’s member directory up to date." },
  { icon: ClipboardList, title: "Recruitment", text: "Review applications and schedule interviews." },
];

export default async function PortalLoginPage({ searchParams }: PageProps<"/portal/login">) {
  // Read the env and session at request time, not at build time.
  await connection();
  if (await getPortalUser()) redirect("/portal");
  const { error, reason, access } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  const info = typeof reason === "string" ? reasons[reason] : undefined;
  const configured = isLoginConfigured();
  // A UST account already verified for Request access, so the form doesn't ask again.
  const pass = configured ? await readAccessPass() : null;

  return (
    <main className="portal-login">
      <section className="portal-login-aside" aria-label="About the Commission Portal">
        <div className="portal-brand">
          <Image src="/images/Logo-1.png" alt="" width={44} height={44} priority />
          <span><strong>Commission Portal</strong><small>UST Central Comelec</small></span>
        </div>
        <div className="portal-login-pitch">
          <p className="portal-eyebrow">For commissioners</p>
          <h2>Run the Commission’s website from one place.</h2>
          <p>Everything the public sees on the UST Central Comelec site, from news and official documents to the directory and recruitment, is managed here.</p>
        </div>
        <ul className="portal-login-features">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="portal-login-feature-icon"><Icon size={17} strokeWidth={2} aria-hidden="true" /></span>
              <span><strong>{title}</strong><small>{text}</small></span>
            </li>
          ))}
        </ul>
        <p className="portal-login-restricted"><Lock size={13} aria-hidden="true" /> Restricted to authorized members of the UST Central Comelec.</p>
      </section>

      <section className="portal-login-panel">
        <LoginPanel
          brand={
            <div className="portal-brand portal-login-mobile-brand">
              <Image src="/images/Logo-1.png" alt="" width={40} height={40} />
              <span><strong>Commission Portal</strong><small>UST Central Comelec</small></span>
            </div>
          }
          signIn={
            <>
              <p className="portal-eyebrow">Commission Portal</p>
              <h1>Sign in to continue</h1>
              <p className="portal-muted portal-login-lede">Use the Google account the University issued you. Only accounts approved by an executive can sign in.</p>

              {message && <p className="portal-form-error portal-login-alert" role="alert">{message}</p>}
              {!message && info && <p className="portal-notice portal-login-alert" role="status">{info}</p>}

              {configured ? (
                <LoginForm />
              ) : (
                <p className="portal-form-error" role="alert">
                  Sign-in isn’t configured on this server. Set the Supabase keys and <code>PORTAL_EXECUTIVE_EMAIL</code> in <code>.env.local</code>, then restart.
                </p>
              )}
            </>
          }
          canRequest={configured}
          verified={pass && { email: pass.email, firstName: pass.firstName, lastName: pass.lastName }}
          accessStatus={typeof access === "string" ? access : undefined}
        />

        <footer className="portal-login-foot">
          <Link href="/"><ArrowLeft size={14} aria-hidden="true" /> Back to the website</Link>
          <span>© {new Date().getFullYear()} UST Central Comelec</span>
        </footer>
      </section>
    </main>
  );
}
