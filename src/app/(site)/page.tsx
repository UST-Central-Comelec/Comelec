import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Flag, Vote } from "lucide-react";
import { PeriodStatus } from "@/components/apply-banner";
import { CometSky } from "@/components/home/comet-sky";
import { LitStatement } from "@/components/home/lit-statement";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { SpotlightGrid } from "@/components/home/spotlight-grid";
import { TimeLeft } from "@/components/home/time-left";
import { NightSky } from "@/components/night-sky";
import { getPeriodForApplyPage } from "@/lib/applications/apply-cache";
import { closingTime, formatClosing, isAccepting, type ApplicationPeriod } from "@/lib/applications/period";
import { cometPillars, principles } from "@/lib/content";
import { countDirectory, getDocuments, getNews } from "@/lib/data/queries";
import { documentKinds, formatDate, newsCategories } from "@/lib/data/types";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { combinePeriods } from "@/lib/periods/summary";
import { serif } from "./fonts";
import "./landing.css";

// Rebuilt at most once a minute, so the page follows the application and filing periods, the newsroom,
// the archive and the directory (saving any of them in the portal also rebuilds it straight away).
export const revalidate = 60;

const signals = ["Engagement", "Transparency", "Technology", "Every Thomasian voice", "On the record", "93rd Central Elections"];

const dayMonth = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Whether a period is open and when it closes ("Oct 29"), for the HUD and the status cards. */
function periodInfo(period: ApplicationPeriod) {
  const closesAt = closingTime(period);
  return { open: isAccepting(period), closesAt, closes: closesAt === null ? null : dayMonth.format(closesAt) };
}

/** A period as the HUD reads it: "Open until Oct 29", "Open", or `closed`. */
const reading = ({ open, closes }: ReturnType<typeof periodInfo>, closed: string) => (open ? (closes ? `Open until ${closes}` : "Open") : closed);

/** A newsroom or archive hiccup shouldn't take the home page down; that part just shows nothing. */
async function orNothing<T>(load: Promise<T[]>): Promise<T[]> {
  try {
    return await load;
  } catch (error) {
    console.error(error);
    return [];
  }
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The hero's pieces come in one after another, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

function Dot({ open }: { open: boolean }) {
  return <i className={`lp-dot${open ? " is-open" : ""}`} aria-hidden="true" />;
}

function Status({ open, closed = "Closed" }: { open: boolean; closed?: string }) {
  return <span className={`lp-status${open ? " is-open" : ""}`}><Dot open={open} />{open ? "Open now" : closed}</span>;
}

/** Blips on the recruitment card's radar, in % of its width and height. */
const blips = [{ x: 68, y: 30 }, { x: 31, y: 41 }, { x: 58, y: 71 }, { x: 80, y: 57 }, { x: 43, y: 22 }];

function Radar() {
  return (
    <div className="lp-radar" aria-hidden="true">
      {blips.map(({ x, y }) => {
        // How far round from twelve o'clock, so each blip flares just as the sweep passes it.
        const turn = (Math.atan2(x - 50, 50 - y) / (2 * Math.PI) + 1) % 1;
        return <i key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, "--turn": turn.toFixed(3) } as CSSProperties} />;
      })}
    </div>
  );
}

/** The directory card's constellation: the commission as stars, joined up. */
const constellation = [[8, 64], [36, 34], [66, 50], [94, 20], [126, 42], [150, 74], [178, 38], [196, 58]];

function Constellation() {
  return (
    <svg className="lp-constellation" viewBox="0 0 204 90" aria-hidden="true">
      <polyline points={constellation.map(([x, y]) => `${x},${y}`).join(" ")} />
      {constellation.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 2.4 : 1.6} style={{ "--twinkle": index } as CSSProperties} />)}
    </svg>
  );
}

export default async function Home() {
  const [applicationPeriod, filings, news, documents, members] = await Promise.all([
    getPeriodForApplyPage(),
    // Every unit opens and closes its own; each reads as open while any unit has it open.
    listUnitPeriodsForSite(),
    orNothing(getNews()),
    orNothing(getDocuments()),
    // Everyone the Directory lists: the portal accounts with a role.
    countDirectory().catch(() => 0),
  ]);
  const candidacyPeriod = combinePeriods(filings.filter((period) => period.kind === "candidacy"));
  const partyPeriod = combinePeriods(filings.filter((period) => period.kind === "party-registration"));
  const applications = periodInfo(applicationPeriod);
  const closingLabel = applications.closesAt === null ? null : formatClosing(new Date(applications.closesAt).toISOString());
  const candidacy = periodInfo(candidacyPeriod);
  const parties = periodInfo(partyPeriod);
  const latest = news[0];

  return (
    <main className={`lp ${serif.variable}`}>
      <RevealOnScroll />

      <section className="lp-hero" data-hero aria-labelledby="lp-title">
        <CometSky anchor=".lp-wordmark" />
        <div className="lp-hero-inner">
          {applications.open && (
            <Link href="/apply" className="lp-call" data-enter style={enter(0)} aria-label={`Now recruiting: commissioner applications are open${closingLabel ? ` until ${closingLabel}` : ""}. Apply now.`}>
              <span className="lp-call-signal" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="lp-call-label">Now recruiting</span>
              <span className="lp-call-text">
                {applications.closesAt === null ? "Commissioner applications are open" : "Commissioner applications close in"}
                {applications.closesAt !== null && <TimeLeft deadline={applications.closesAt} className="lp-call-clock" />}
              </span>
              <ArrowUpRight className="lp-call-arrow" size={15} aria-hidden="true" />
            </Link>
          )}
          <p className="lp-kicker" data-enter style={enter(1)}>UST Central Comelec presents</p>
          <h1 id="lp-title" className="lp-hero-title">
            <span className="lp-wordmark" data-enter style={enter(2)}>COMET</span>
            <span className="visually-hidden">: </span>
            <span className="lp-tagline" data-enter style={enter(3)}>Elections, <em>illuminated.</em></span>
          </h1>
          <p className="lp-lede" data-enter style={enter(4)}>
            The <strong>COMELEC Engagement and Transparency Technology</strong> initiative serves as a centralized digital platform for UST Central COMELEC—connecting elections, official records, archives, news, applications, public engagements, and transparency initiatives in one accessible space.
          </p>
          <div className="lp-actions" data-enter style={enter(5)}>
            <a href="#comet" className="lp-button is-primary is-down">Explore the initiative <ArrowDown size={16} aria-hidden="true" /></a>
            <Link href="/news" className="lp-button is-ghost">Latest from the commission <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
        <dl className="lp-hud">
          <div data-enter style={enter(6)}>
            <dt>Now tracking</dt>
            <dd>93rd Central Elections</dd>
          </div>
          <div data-enter style={enter(7)}>
            <dt>Commissioner applications</dt>
            <dd><Dot open={applications.open} />{reading(applications, "Closed")}</dd>
          </div>
          <div data-enter style={enter(8)}>
            <dt>Filing of candidacy</dt>
            <dd><Dot open={candidacy.open} />{reading(candidacy, "Not open")}</dd>
          </div>
          <div data-enter style={enter(9)}>
            <dt>Party registration</dt>
            <dd><Dot open={parties.open} />{reading(parties, "Not open")}</dd>
          </div>
        </dl>
      </section>

      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[0, 1].map((copy) => (
            <div className="lp-marquee-row" key={copy}>
              {signals.map((signal, index) => <span key={signal} className={`is-${index % 3}`}>{signal}</span>)}
            </div>
          ))}
        </div>
      </div>

      <section className="lp-section" id="comet" aria-labelledby="lp-comet-title">
        <div className="lp-wrap">
          <header className="lp-head" data-reveal>
            <p className="lp-eyebrow">The initiative</p>
            <h2 id="lp-comet-title" className="lp-title">Five letters.<br /><em>Three commitments.</em></h2>
            <p className="lp-intro"><b>COM</b>ELEC <b>E</b>ngagement and <b>T</b>ransparency Technology: how the commission uses technology to reach every Thomasian voter and keep every step of the process open to scrutiny.</p>
          </header>
          <ol className="lp-pillars">
            {cometPillars.map((pillar, index) => (
              <li className="lp-pillar" key={pillar.letters} data-reveal>
                {/* The whole word each time, with this row's letters lit: COMet, comEt, comeT. */}
                <span className="lp-pillar-glyph" aria-hidden="true">
                  {[..."COMET"].map((letter, place) => {
                    const from = "COMET".indexOf(pillar.letters);
                    return <span key={place} className={place >= from && place < from + pillar.letters.length ? "is-lit" : undefined}>{letter}</span>;
                  })}
                </span>
                <div>
                  <p className="lp-pillar-index"><span>{String(index + 1).padStart(2, "0")}</span>{pillar.stands}</p>
                  <h3>{pillar.title} <em>{pillar.accent}</em></h3>
                  <p className="lp-pillar-copy">{pillar.copy}</p>
                  <ul className="lp-chips">
                    {pillar.links.map((link) => (
                      <li key={link.href}><Link href={link.href}>{link.label}<ArrowUpRight size={13} aria-hidden="true" /></Link></li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section lp-live" aria-labelledby="lp-live-title">
        <div className="lp-wrap">
          <header className="lp-head is-split" data-reveal>
            <div>
              <p className="lp-eyebrow is-live">Live from the commission</p>
              <h2 id="lp-live-title" className="lp-title">Mission control for<br /><em>student elections.</em></h2>
            </div>
            <p className="lp-intro">What’s open, what’s new and what’s on the record, straight from the commission as it happens.</p>
          </header>

          <SpotlightGrid className="lp-bento">
            <article className="lp-card is-apply" data-spotlight data-reveal>
              <Radar />
              <header className="lp-card-head"><span className="lp-card-index">01 · Recruitment</span><Status open={applications.open} /></header>
              <h3 className="lp-card-title">Become a<br /><em>commissioner.</em></h3>
              <p className="lp-card-copy">
                {applications.open
                  ? "Serve the Thomasian community on the commission that runs its elections. Apply online, verified with your UST Google account."
                  : "Applications to the commission are closed for now. Watch the newsroom for the next call."}
              </p>
              {applications.open && (
                <div className="lp-countdown">
                  <PeriodStatus period={{ accepting: true, closesAt: applications.closesAt, closesLabel: closingLabel }} />
                </div>
              )}
              <div className="lp-card-actions">
                {applications.open && <Link href="/apply" className="lp-button is-primary is-small">Apply now <ArrowUpRight size={15} aria-hidden="true" /></Link>}
                <Link href="/apply/track" className="lp-button is-ghost is-small">Track an application <ArrowUpRight size={15} aria-hidden="true" /></Link>
              </div>
            </article>

            <article className="lp-card is-news" data-spotlight data-reveal>
              <header className="lp-card-head">
                <span className="lp-card-index">02 · Newsroom</span>
                <span className="lp-signal" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ "--bar": index } as CSSProperties} />)}</span>
              </header>
              {latest ? (
                <>
                  <p className="lp-card-meta"><span>{newsCategories[latest.category]}</span><time dateTime={latest.date}>{formatDate(latest.date)}</time></p>
                  <h3 className="lp-card-title is-small"><Link href={`/news/${latest.id}`} className="lp-stretch">{latest.title}</Link></h3>
                  <p className="lp-card-copy is-clamped">{latest.excerpt}</p>
                  <span className="lp-card-foot">Read the story <ArrowUpRight size={14} aria-hidden="true" /></span>
                </>
              ) : (
                <>
                  <h3 className="lp-card-title is-small"><Link href="/news" className="lp-stretch">The newsroom</Link></h3>
                  <p className="lp-card-copy">Official updates from the commission, as they’re posted.</p>
                  <span className="lp-card-foot">Visit the newsroom <ArrowUpRight size={14} aria-hidden="true" /></span>
                </>
              )}
            </article>

            <article className="lp-card is-record" data-spotlight data-reveal>
              <header className="lp-card-head"><span className="lp-card-index">03 · Public record</span><span className="lp-card-count">{plural(documents.length, "document")}</span></header>
              <h3 className="lp-card-title is-small">On the record, <em>for everyone.</em></h3>
              {documents.length > 0 ? (
                <ul className="lp-ledger">
                  {documents.slice(0, 3).map((doc) => (
                    <li key={doc.id}>
                      <Link href={`/archive/${doc.id}`}>
                        <span>{doc.reference || documentKinds[doc.kind]}</span>
                        <strong>{doc.title}</strong>
                        <time dateTime={doc.date}>{doc.date.replace(/-/g, ".")}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lp-card-copy">Executive orders, memorandums and resolutions appear here as the commission issues them.</p>
              )}
              <Link href="/archive" className="lp-card-foot">Browse the archive <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </article>

            <article className="lp-card is-filing" data-spotlight data-reveal>
              <Vote className="lp-card-mark" strokeWidth={1} aria-hidden="true" />
              <header className="lp-card-head"><span className="lp-card-index">04 · Candidacy</span><Status open={candidacy.open} closed="Not open" /></header>
              <h3 className="lp-card-title is-small"><Link href="/candidacy" className="lp-stretch">Filing of candidacy</Link></h3>
              <p className="lp-card-copy">
                {candidacy.open
                  ? `Certificates of candidacy are being accepted${candidacy.closes ? ` until ${candidacy.closes}` : ""}.`
                  : "Running for office? Watch this space for the filing period, requirements and schedule."}
              </p>
              <span className="lp-card-foot">{candidacy.open ? "File your candidacy" : "Learn more"} <ArrowUpRight size={14} aria-hidden="true" /></span>
            </article>

            <article className="lp-card is-filing" data-spotlight data-reveal>
              <Flag className="lp-card-mark" strokeWidth={1} aria-hidden="true" />
              <header className="lp-card-head"><span className="lp-card-index">05 · Parties</span><Status open={parties.open} closed="Not open" /></header>
              <h3 className="lp-card-title is-small"><Link href="/party-registration" className="lp-stretch">Political party registration</Link></h3>
              <p className="lp-card-copy">
                {parties.open
                  ? `Parties can register with the commission${parties.closes ? ` until ${parties.closes}` : ""}.`
                  : "Forming a party? Watch this space for the next registration period."}
              </p>
              <span className="lp-card-foot">{parties.open ? "Register a party" : "Learn more"} <ArrowUpRight size={14} aria-hidden="true" /></span>
            </article>

            <article className="lp-card is-people" data-spotlight data-reveal>
              <Constellation />
              <header className="lp-card-head"><span className="lp-card-index">06 · Directory</span></header>
              <h3 className="lp-card-title is-small"><Link href="/about" className="lp-stretch">The people behind the process</Link></h3>
              <p className="lp-card-copy">
                {members > 0
                  ? `${plural(members, "member")} of the Central and Local Comelec, named and accountable.`
                  : "The students entrusted with running fair, credible elections for the Thomasian community."}
              </p>
              <span className="lp-card-foot">Meet the commission <ArrowUpRight size={14} aria-hidden="true" /></span>
            </article>
          </SpotlightGrid>
        </div>
      </section>

      <section className="lp-section lp-creed" aria-labelledby="lp-creed-title">
        <div className="lp-wrap">
          <h2 id="lp-creed-title" className="lp-eyebrow">Why we do this</h2>
          <LitStatement className="lp-statement" text="Democracy is a *practice,* not a *promise.* Our work is in the details: a clear ballot, a fair count, and a process that *earns* trust." />
          <ol className="lp-principles">
            {principles.map(([number, title, copy], index) => (
              <li key={number} data-reveal style={{ "--reveal-delay": `${index * 0.12}s` } as CSSProperties}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-finale" aria-labelledby="lp-finale-title">
        <NightSky />
        <div className="lp-wrap lp-finale-inner">
          <div className="lp-finale-mark" data-reveal>
            <i className="lp-orbit" aria-hidden="true" />
            <Image src="/images/Logo-1.png" alt="" width={88} height={88} />
          </div>
          <h2 id="lp-finale-title" className="lp-title" data-reveal>Your voice<br /><em>moves UST.</em></h2>
          <p className="lp-intro" data-reveal>Stay informed, take part, and ask questions. The 93rd Central Elections start with you.</p>
          <div className="lp-actions" data-reveal>
            {applications.open
              ? <Link href="/apply" className="lp-button is-primary">Become a commissioner <ArrowUpRight size={16} aria-hidden="true" /></Link>
              : <Link href="/news" className="lp-button is-primary">Read the latest updates <ArrowUpRight size={16} aria-hidden="true" /></Link>}
            <a href="mailto:comelec@ust.edu.ph" className="lp-button is-ghost">comelec@ust.edu.ph</a>
          </div>
        </div>
        <div className="lp-planet" aria-hidden="true" />
      </section>
    </main>
  );
}
