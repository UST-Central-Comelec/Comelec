import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { ArrowUpRight, EyeOff, Hourglass, LogIn } from "lucide-react";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { NightSky } from "@/components/night-sky";
import { COOKIE_NOTICE_KEY, COOKIE_POLICY_UPDATED } from "@/lib/cookie-notice";
import "./cookies.css";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "The cookies UST Central Comelec sets, what each one is for, and how long it lasts.",
};

const CONTACT_EMAIL = "comelec@ust.edu.ph";

/** The hero's pieces come in one after another, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

const updated = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", dateStyle: "long" }).format(new Date(`${COOKIE_POLICY_UPDATED}T00:00:00+08:00`));

type Entry = { name: string; kind: "Essential" | "Preference"; purpose: string; lasts: string };
type Group = { title: string; who: string; entries: Entry[] };

// Every cookie the site sets, grouped by what the visitor was doing when it was set. Keep this in
// step with the code that sets them, and move COOKIE_POLICY_UPDATED on when it changes:
//   • sb-…                    @supabase/ssr, through src/lib/supabase/server.ts and src/proxy.ts
//   • apply_verified          src/lib/applications/verification.ts
//   • event_…                 src/lib/events/verification.ts
//   • portal_access_…         src/lib/access-requests/verification.ts
//   • portal_activity         src/lib/security/portal-session.ts
//   • portal_sidebar          src/lib/portal/sidebar.ts
const cookieGroups: Group[] = [
  {
    title: "Signing in with Google",
    who: "Set for anyone who signs in with a UST Google account: applicants, students registering for an event, people requesting portal access, and commissioners.",
    entries: [
      { name: "sb-…-auth-token", kind: "Essential", purpose: "Your sign-in session. It’s how the portal knows it’s still you on each page. Applicants, students registering for an event and people requesting access aren’t kept signed in: theirs is removed the moment the UST account is confirmed.", lasts: "Until you sign out or your session times out. 400 days at the very most" },
      { name: "sb-…-auth-token-code-verifier", kind: "Essential", purpose: "A one-time code proving that the browser finishing a Google sign-in is the one that started it.", lasts: "Until sign-in completes" },
    ],
  },
  {
    title: "Applying to be a commissioner",
    who: "Set after you give consent on the application form and verify your UST account.",
    entries: [
      { name: "apply_verified", kind: "Essential", purpose: "A signed pass holding the name and UST email you verified and the time you gave consent, so the form can fill in your email and the commission can trust it.", lasts: "6 hours, or until you send your application" },
    ],
  },
  {
    title: "Registering for an event",
    who: "Set when you press Register, or Join the waitlist, on an event and verify your UST account.",
    entries: [
      { name: "event_verify_flow", kind: "Essential", purpose: "Marks a Google sign-in as part of an event registration, and says which event it’s for.", lasts: "10 minutes, or until Google sends you back" },
      { name: "event_verified", kind: "Essential", purpose: "A signed pass holding the name and UST email you verified and the event you’re registering for, so the form can show who it’s for and the commission can trust it.", lasts: "1 hour, or until you send your registration" },
    ],
  },
  {
    title: "Requesting portal access",
    who: "Set when a member of the commission asks for an account on the Commission Portal.",
    entries: [
      { name: "portal_access_flow", kind: "Essential", purpose: "Marks a Google sign-in as part of an access request rather than a sign-in to the portal.", lasts: "10 minutes, or until Google sends you back" },
      { name: "portal_access_pass", kind: "Essential", purpose: "A signed pass holding the name and UST email you verified before filling in the request.", lasts: "2 hours, or until you send your request" },
      { name: "portal_access_confirmed", kind: "Essential", purpose: "Shows that you signed in again with the same account at the moment you sent the request.", lasts: "5 minutes, or until you send your request" },
    ],
  },
  {
    title: "Using the Commission Portal",
    who: "Set only for commissioners signed in to the portal.",
    entries: [
      { name: "portal_activity", kind: "Essential", purpose: "Records when your session started and when you were last active, so the portal can sign you out after 30 minutes of inactivity or 8 hours in total.", lasts: "8 hours" },
      { name: "portal_sidebar", kind: "Preference", purpose: "Remembers whether you collapsed the portal’s sidebar. It’s set only when you use that button.", lasts: "1 year" },
    ],
  },
];

/** Kept in the browser's local storage rather than in cookies: it never leaves the device. */
const storageEntries: Entry[] = [
  { name: COOKIE_NOTICE_KEY, kind: "Preference", purpose: "Remembers that you dismissed the cookie notice, so it doesn’t come back on every page.", lasts: "Until you clear this site’s data, or this policy changes" },
  { name: "portal:last-activity", kind: "Essential", purpose: "The time you were last active in the portal, shared between your open tabs so that working in one keeps the others signed in.", lasts: "Until you clear this site’s data" },
];

const cookieCount = cookieGroups.reduce((count, group) => count + group.entries.length, 0);

const summary = [
  { icon: LogIn, title: "Nothing until you sign in", text: "Reading the news, the archive or any other public page stores no cookies at all. They appear only once you sign in with your UST Google account." },
  { icon: EyeOff, title: "No tracking, no ads", text: "We run no analytics, advertising or social media trackers, and we don’t build a profile of what you read." },
  { icon: Hourglass, title: "Short-lived by design", text: "Most expire on their own within hours, and you can clear all of them from your browser whenever you like." },
];

const sections = [
  { id: "summary", label: "The short version" },
  { id: "cookies", label: "Cookies we set" },
  { id: "storage", label: "Other storage" },
  { id: "services", label: "Other services" },
  { id: "choices", label: "Your choices" },
  { id: "contact", label: "Changes and contact" },
];

const serial = (index: number) => String(index + 1).padStart(2, "0");

function Ledger({ caption, note, entries }: { caption: string; note?: string; entries: Entry[] }) {
  return (
    <div className="ck-ledger" data-reveal>
      <table>
        <caption>
          <strong>{caption}</strong>
          {note && <span>{note}</span>}
        </caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">What it’s for</th><th scope="col">Lasts</th></tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.name}>
              <th scope="row"><code>{entry.name}</code><span className={`ck-kind${entry.kind === "Preference" ? " is-preference" : ""}`}>{entry.kind}</span></th>
              <td>{entry.purpose}</td>
              <td data-label="Lasts">{entry.lasts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiePolicyPage() {
  return (
    <main className="ck">
      <RevealOnScroll />

      <header className="ck-hero" data-hero>
        <NightSky seed={2026} count={96} />
        <div className="ck-wrap ck-hero-inner">
          <div>
            <p className="ck-eyebrow" data-enter style={enter(0)}>Cookie policy</p>
            <h1 className="ck-title" data-enter style={enter(1)}>Only the <em>essentials.</em></h1>
            <p className="ck-lede" data-enter style={enter(2)}>This site uses a handful of cookies, and every one does a job you asked for: confirming your UST account, and keeping a session secure. Here is each of them, what it’s for, and how long it stays.</p>
            <p className="ck-meta" data-enter style={enter(3)}><span>Updated <time dateTime={COOKIE_POLICY_UPDATED}>{updated}</time></span><span>Data Privacy Act of 2012 · R.A. 10173</span></p>
          </div>
          {/* A reading of the site, in the home page's telemetry: what a scan for cookies turns up. */}
          <div className="ck-scan" data-enter style={enter(4)}>
            <p className="ck-scan-label"><span className="ck-dot" aria-hidden="true" />Reading · this site</p>
            <dl>
              <div><dt>Analytics trackers</dt><dd>0</dd></div>
              <div><dt>Advertising cookies</dt><dd>0</dd></div>
              <div><dt>Cookies before sign-in</dt><dd>0</dd></div>
              <div className="is-total"><dt>Cookies in all, listed below</dt><dd>{cookieCount}</dd></div>
            </dl>
          </div>
        </div>
      </header>

      <div className="ck-wrap ck-layout">
        <nav className="ck-toc" aria-label="On this page">
          <p className="ck-eyebrow">On this page</p>
          <ol>
            {sections.map((section, index) => (
              <li key={section.id}><a href={`#${section.id}`}><span>{serial(index)}</span>{section.label}</a></li>
            ))}
          </ol>
        </nav>

        <div className="ck-body">
          <section id="summary" className="ck-section" aria-labelledby="ck-summary-title">
            <p className="ck-serial">{serial(0)}</p>
            <h2 id="ck-summary-title">The short <em>version</em></h2>
            <p>A cookie is a small text file a website asks your browser to keep, so the site can recognise that browser again. We keep ours to the minimum the site needs to work.</p>
            <ul className="ck-cards">
              {summary.map(({ icon: Icon, title, text }, index) => (
                <li key={title} data-reveal style={{ "--reveal-delay": `${index * 0.08}s` } as CSSProperties}>
                  <span className="ck-card-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.7} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section id="cookies" className="ck-section" aria-labelledby="ck-cookies-title">
            <p className="ck-serial">{serial(1)}</p>
            <h2 id="ck-cookies-title">Cookies we <em>set</em></h2>
            <p>All {cookieCount} are our own, set by this site and readable only by it. Which of them you get depends on what you do here; most visitors never get any. The passes are signed, so they can’t be altered, and they can’t be read by scripts on the page.</p>
            {cookieGroups.map((group) => <Ledger key={group.title} caption={group.title} note={group.who} entries={group.entries} />)}
            <p className="ck-fine">The “…” in the first two names is the ID of our sign-in provider’s project. A long session may be split across cookies ending in .0, .1 and so on. A timed-out session’s cookie is removed on your next visit, and if you abandon a sign-in halfway, its one-time code stays until you next sign in or clear it.</p>
          </section>

          <section id="storage" className="ck-section" aria-labelledby="ck-storage-title">
            <p className="ck-serial">{serial(2)}</p>
            <h2 id="ck-storage-title">Other storage on <em>your device</em></h2>
            <p>Two small notes are kept in your browser’s local storage instead of in a cookie. Unlike cookies, they are never sent to us: they stay on your device.</p>
            <Ledger caption="Local storage" entries={storageEntries} />
          </section>

          <section id="services" className="ck-section" aria-labelledby="ck-services-title">
            <p className="ck-serial">{serial(3)}</p>
            <h2 id="ck-services-title">Other <em>services</em></h2>
            <p>Nothing on this site loads another company’s trackers. Its fonts and icons are served from the site itself. Two services are involved when you sign in, and some links lead elsewhere:</p>
            <dl className="ck-list">
              <div data-reveal><dt>Google</dt><dd>Signing in takes you to Google’s own sign-in page, where Google uses its own cookies under <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noreferrer">its cookie policy</a>. Google shares your basic account details with us, such as your name and UST email.</dd></div>
              <div data-reveal><dt>Supabase</dt><dd>Supabase runs the site’s sign-in and database on our behalf. The sign-in cookies above come from its software, but they’re set by this site, under this site’s address. On the way to Google and back, your browser passes briefly through Supabase’s own address, which may set a short-lived security cookie of its own.</dd></div>
              <div data-reveal><dt>Linked sites</dt><dd>Documents in the archive open on Google Drive, and some pages link to other sites, such as the University’s voting system. Those sites set their own cookies under their own policies once you’re there.</dd></div>
            </dl>
          </section>

          <section id="choices" className="ck-section" aria-labelledby="ck-choices-title">
            <p className="ck-serial">{serial(4)}</p>
            <h2 id="ck-choices-title">Your <em>choices</em></h2>
            <p><strong>Why there’s no “Accept” or “Decline”.</strong> A consent prompt is for cookies a site could do without, such as analytics or advertising. We set none of those, so there’s nothing to decline: each cookie here is needed for something you’ve asked the site to do. If that ever changes, we’ll ask first, and “no” will be as easy to choose as “yes”.</p>
            <p><strong>Clearing or blocking them.</strong> You can delete this site’s cookies and storage, or block them, from your browser’s privacy settings. The public pages work the same without them. Signing in doesn’t: with cookies blocked, you won’t be able to verify your UST account to apply, register for an event, request portal access, or use the portal.</p>
            <p><strong>Your personal information.</strong> The cookies above hold, at most, your name and UST email. What the commission collects through its forms, and how to ask to access, correct or delete it, is set out in the privacy statement shown before you apply or register, in line with the Data Privacy Act of 2012.</p>
          </section>

          <section id="contact" className="ck-section" aria-labelledby="ck-contact-title">
            <p className="ck-serial">{serial(5)}</p>
            <h2 id="ck-contact-title">Changes and <em>contact</em></h2>
            <p>When we add, remove or repurpose a cookie, we’ll update this page and its date, and show the cookie notice again so you know to look.</p>
            <div className="ck-contact" data-reveal>
              <div>
                <p className="ck-eyebrow">Questions about this policy</p>
                <p>Write to the UST Central Commission on Elections. We’re at Room 4F, UST Tan Yan Kee Student Center.</p>
              </div>
              <a className="ck-button" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}<ArrowUpRight size={15} aria-hidden="true" /></a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
