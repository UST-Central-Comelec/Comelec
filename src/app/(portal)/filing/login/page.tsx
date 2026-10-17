import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, FileText, Lock, Users } from "lucide-react";
import { ScaleBackdrop } from "@/components/filing-portal/scale-backdrop";
import { GoogleMark } from "@/components/portal/login-form";
import { getFilingAccount } from "@/lib/filing-portal/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "../(app)/filing-portal.css";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  "not-ust": "Sign in with your @ust.edu.ph Google account. Personal Google accounts can’t use the filing portal.",
  "not-registered": "That UST account doesn’t have an account here yet. Register your party, or file your candidacy, on the website first.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
  unavailable: "Sign-in isn’t available right now. Please email comelec@ust.edu.ph.",
};

/** Why the last session ended: the limit that closed it, then what happened. */
const reasons: Record<string, { figure: string; unit: string; title: string; detail: string }> = {
  idle: { figure: "30", unit: "min", title: "Signed out while you were away", detail: "Sessions close after 30 minutes of inactivity. Sign in again to continue." },
  expired: { figure: "8", unit: "hrs", title: "Your session reached its limit", detail: "For security, sessions end after 8 hours. Sign in again to continue." },
};

const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

/** The filing portal's sign-in, for political parties' members and candidates: the commission portal's page, for the public. */
export default async function FilingLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getFilingAccount()) redirect("/filing");
  const { error, reason } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  const ended = !message && typeof reason === "string" ? reasons[reason] : undefined;

  return (
    <main className="portal-login is-scale">
      <section className="portal-login-aside" aria-label="About the filing portal">
        <ScaleBackdrop />
        <div className="portal-brand" data-enter style={enter(0)}>
          <Image src="/images/Logo-1.png" alt="" width={44} height={44} priority />
          <span><strong>Filing Portal</strong><small>UST Central Comelec</small></span>
        </div>
        <div className="portal-login-pitch">
          <p className="portal-login-kicker" data-enter style={enter(1)}>For political parties and candidates</p>
          <h2 className="portal-login-title">
            <span className="portal-login-wordmark" data-enter style={enter(2)}>Your</span>{" "}
            <em data-enter style={enter(3)}>filings.</em>
          </h2>
          <p className="portal-login-brief" data-enter style={enter(4)}>
            Your party’s registration and your own candidacy, in one place. Upload <strong>the forms and supporting documents</strong>, download the templates, and follow <strong>your Comelec unit’s feedback</strong> as each document is reviewed.
          </p>
        </div>
        <nav className="portal-login-links" aria-label="Quick links" data-enter style={enter(5)}>
          <p>Quick links</p>
          <div>
            <Link href="/party-registration" prefetch={false}>
              <Users size={20} strokeWidth={1.6} aria-hidden="true" />
              <strong>Political Party Registration</strong>
              <small>Register or join a party</small>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link href="/candidacy" prefetch={false}>
              <FileText size={20} strokeWidth={1.6} aria-hidden="true" />
              <strong>Filing of Candidacy</strong>
              <small>File your certificate</small>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </section>

      <section className="portal-login-panel">
        <div className="portal-login-card" data-enter style={enter(3)}>
          <p className="portal-eyebrow">{ended ? "Session ended" : "Secure sign-in"}</p>
          <h1>Sign in to <em>continue.</em></h1>
          {ended ? (
            <div className="portal-login-ended" role="status">
              <p aria-hidden="true"><em>{ended.figure}</em> {ended.unit}</p>
              <p><strong>{ended.title}</strong> {ended.detail}</p>
            </div>
          ) : (
            <p className="portal-muted portal-login-lede">Use the UST Google account you registered or filed with. One account holds both your party and your candidacy.</p>
          )}
          {message && <p className="portal-form-error portal-login-alert" role="alert">{message}</p>}
          {isSupabaseConfigured() ? (
            <div className="portal-login-form">
              {/* A plain link: starting Google sign-in sets nothing but the sign-in's own cookies. */}
              <a className="portal-button is-block is-google" href="/filing/auth/start?mode=login"><GoogleMark /> Sign in with Google</a>
            </div>
          ) : (
            <p className="portal-form-error" role="alert">Sign-in isn’t configured on this server yet.</p>
          )}
          <div className="portal-login-request">
            <p><span>Don’t have an account yet?</span></p>
            <div className="pp-login-starts">
              <Link className="portal-button is-ghost is-beam is-block" href="/party-registration" prefetch={false}><Users size={16} aria-hidden="true" /> Register a party</Link>
              <Link className="portal-button is-ghost is-beam is-block" href="/candidacy" prefetch={false}><FileText size={16} aria-hidden="true" /> File a candidacy</Link>
            </div>
          </div>
          <p className="portal-login-restricted"><Lock size={13} aria-hidden="true" /> For political parties’ members and candidates filing with the UST Central Comelec.</p>
        </div>

        <footer className="portal-login-foot">
          <span>© {new Date().getFullYear()} UST Central Comelec</span>
          <Link href="/cookies" prefetch={false}>Cookie policy</Link>
          <Link href="/privacy" prefetch={false}>Privacy statement</Link>
        </footer>
      </section>
    </main>
  );
}
