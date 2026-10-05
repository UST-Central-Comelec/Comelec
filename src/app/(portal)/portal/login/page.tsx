import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowUpRight, Globe, Lock, Vote } from "lucide-react";
import { CometSky } from "@/components/home/comet-sky";
import { LoginForm } from "@/components/portal/login-form";
import { LoginPanel } from "@/components/portal/login-panel";
import { readAccessPass } from "@/lib/access-requests/verification";
import { getPortalUser, isLoginConfigured } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  "not-ust": "Sign in with your @ust.edu.ph Google account. Personal Google accounts can’t access the portal.",
  "not-registered": "That UST account doesn’t have portal access yet. Use Request access below, and the Executive Board will review it.",
  revoked: "Your portal access has been revoked. Contact your Executive Board if you think this is a mistake.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "not-configured": "Sign-in isn’t configured on this server yet.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
};

/** Why the last session ended, when it wasn't the person signing out: the limit that closed it, then what happened. */
const reasons: Record<string, { figure: string; unit: string; title: string; detail: string }> = {
  idle: { figure: "30", unit: "min", title: "Signed out while you were away", detail: "Sessions close after 30 minutes of inactivity. Sign in again to continue." },
  expired: { figure: "8", unit: "hrs", title: "Your session reached its limit", detail: "For security, sessions end after 8 hours. Sign in again to continue." },
};

// Where the voting system and Facebook quick links lead.
const EVOSYS_URL = "https://botongtomasino.ust.edu.ph/";
const FACEBOOK_URL = "https://www.facebook.com/";

/** The page's pieces come in one after another, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

export default async function PortalLoginPage({ searchParams }: PageProps<"/portal/login">) {
  // Read the env and session at request time, not at build time.
  await connection();
  if (await getPortalUser()) redirect("/portal");
  const { error, reason, access } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  const ended = !message && typeof reason === "string" ? reasons[reason] : undefined;
  const configured = isLoginConfigured();
  // A UST account already verified for Request access, so the form doesn't ask again.
  const pass = configured ? await readAccessPass() : null;

  return (
    <main className="portal-login">
      <section className="portal-login-aside" aria-label="About the Commission Portal">
        {/* The home page's comet, resting beside the wordmark; its tails run on behind the sign-in card. */}
        <CometSky anchor=".portal-login-wordmark" />
        <div className="portal-brand" data-enter style={enter(0)}>
          <Image src="/images/Logo-1.png" alt="" width={44} height={44} priority />
          <span><strong>Commission Portal</strong><small>UST Central Comelec</small></span>
        </div>
        <div className="portal-login-pitch">
          <p className="portal-login-kicker" data-enter style={enter(1)}>For commissioners</p>
          <h2 className="portal-login-title">
            <span className="portal-login-wordmark" data-enter style={enter(2)}>Mission</span>{" "}
            <em data-enter style={enter(3)}>control.</em>
          </h2>
          <p className="portal-login-brief" data-enter style={enter(4)}>
            Run the Commission’s website from one place. Everything the public sees on the UST Central Comelec site, from <strong>news and official documents</strong> to <strong>the directory and recruitment</strong>, is managed here.
          </p>
        </div>
        <nav className="portal-login-links" aria-label="Quick links" data-enter style={enter(5)}>
          <p>Quick links</p>
          <div>
            {/* The website has its own root layout, so going there is a full page load: nothing to gain from fetching it ahead. */}
            <Link href="/" prefetch={false}>
              <Globe size={20} strokeWidth={1.6} aria-hidden="true" />
              <strong>Main Website</strong>
              <small>UST Central Comelec</small>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <a href={EVOSYS_URL} target="_blank" rel="noreferrer">
              <Vote size={20} strokeWidth={1.6} aria-hidden="true" />
              <strong>UST Electronic Voting System</strong>
              <small>EvoSys</small>
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              <strong>Facebook</strong>
              <small>Central Comelec page</small>
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </nav>
      </section>

      <section className="portal-login-panel">
        <LoginPanel
          signIn={
            <>
              <p className="portal-eyebrow">{ended ? "Session ended" : "Secure sign-in"}</p>
              <h1>Sign in to <em>continue.</em></h1>
              {/* A session that timed out says so in place of the usual introduction. */}
              {ended ? (
                <div className="portal-login-ended" role="status">
                  <p aria-hidden="true"><em>{ended.figure}</em> {ended.unit}</p>
                  <p><strong>{ended.title}</strong> {ended.detail}</p>
                </div>
              ) : (
                <p className="portal-muted portal-login-lede">Use the Google account the University issued you. Only accounts approved by the Executive Board can sign in.</p>
              )}

              {message && <p className="portal-form-error portal-login-alert" role="alert">{message}</p>}

              {configured ? (
                <LoginForm />
              ) : (
                <p className="portal-form-error" role="alert">
                  Sign-in isn’t configured on this server. Set the Supabase keys and <code>PORTAL_EXECUTIVE_EMAIL</code> in <code>.env.local</code>, then restart.
                </p>
              )}
            </>
          }
          note={<p className="portal-login-restricted"><Lock size={13} aria-hidden="true" /> Restricted to authorized members of the UST Central Comelec.</p>}
          canRequest={configured}
          verified={pass && { email: pass.email, firstName: pass.firstName, lastName: pass.lastName }}
          accessStatus={typeof access === "string" ? access : undefined}
        />

        <footer className="portal-login-foot">
          <span>© {new Date().getFullYear()} UST Central Comelec</span>
          {/* Signing in is what sets cookies. The policy is on the website, which has its own root layout. */}
          <Link href="/cookies" prefetch={false}>Cookie policy</Link>
        </footer>
      </section>
    </main>
  );
}
