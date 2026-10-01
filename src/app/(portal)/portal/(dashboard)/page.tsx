import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus, Star } from "lucide-react";
import { SpotlightGrid } from "@/components/home/spotlight-grid";
import { listPendingAccessRequests } from "@/lib/access-requests/admin";
import { listApplications } from "@/lib/applications/admin";
import { closingTime, isAccepting, isClosingSoon, type ApplicationPeriod } from "@/lib/applications/period";
import { getApplicationPeriod } from "@/lib/applications/period-store";
import { requireCentral, withPortalUser } from "@/lib/auth/session";
import { getDocuments, getMembers, getPosts } from "@/lib/data/queries";
import { documentKinds, formatDate, memberBodies, newsCategories } from "@/lib/data/types";
import { getFilingPeriod } from "@/lib/filings/period-store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Dashboard" };

const zone = "Asia/Manila";
const dayMonth = new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric" });
const updated = new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric", year: "numeric" });

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** One of the hero's live readings. `tone` colours its text: gold while open, amber while closing, quiet when closed or nothing's waiting. */
type Reading = { label: string; href: string; tone: "open" | "closing" | "waiting" | "off"; text: string };

/** A period as the hero reads it: "Open until Oct 29", "Open", "Closing soon" or `closed`. Null is one that couldn't be loaded. */
function periodReading(label: string, href: string, period: ApplicationPeriod | null, closed: string): Reading {
  if (!period) return { label, href, tone: "off", text: "Unavailable" };
  if (isClosingSoon(period)) return { label, href, tone: "closing", text: "Closing soon" };
  if (!isAccepting(period)) return { label, href, tone: "off", text: closed };
  const closes = closingTime(period);
  return { label, href, tone: "open", text: closes === null ? "Open" : `Open until ${dayMonth.format(closes)}` };
}

/** Something waiting on the commission, as a count. Null is a count that couldn't be loaded. */
function queueReading(label: string, href: string, count: number | null, noun: string): Reading {
  if (count === null) return { label, href, tone: "off", text: "Unavailable" };
  return { label, href, tone: count ? "waiting" : "off", text: count ? plural(count, noun) : "None waiting" };
}

export default async function PortalDashboardPage() {
  // The readings never take the dashboard down: one that can't be loaded just says so.
  const [user, [news, documents, members, applications, candidacy, parties, pending]] = await withPortalUser(
    Promise.all([
      getPosts(),
      getDocuments(),
      getMembers(),
      settle(getApplicationPeriod()),
      settle(getFilingPeriod("candidacy")),
      settle(getFilingPeriod("party-registration")),
      settle(listApplications({ status: "pending" })),
    ]),
    requireCentral,
  );
  // Access requests are an executive's to decide, so only an executive's dashboard asks for them.
  const requests = user.role === "executive" ? await settle(listPendingAccessRequests()) : null;

  const readings = [
    periodReading("Recruitment", "/portal/recruitment/settings", applications.value, "Closed"),
    periodReading("Candidacy", "/portal/candidacy/settings", candidacy.value, "Not open"),
    periodReading("Parties", "/portal/polpar/settings", parties.value, "Not open"),
    queueReading("To review", "/portal/recruitment/applications?status=pending&body=all", pending.value?.length ?? null, "application"),
    ...(requests ? [queueReading("Access requests", "/portal/accounts?status=pending", requests.value?.length ?? null, "request")] : []),
  ];

  const recent = [
    ...news.map((item) => ({ key: `news-${item.id}`, title: item.title, type: newsCategories[item.category], href: `/portal/news/${item.id}`, updatedAt: item.updatedAt })),
    ...documents.map((item) => ({ key: `doc-${item.id}`, title: item.title, type: documentKinds[item.kind], href: `/portal/documents/${item.id}`, updatedAt: item.updatedAt })),
    ...members.map((item) => ({ key: `member-${item.id}`, title: `${item.name} — ${item.position}`, type: memberBodies[item.body], href: `/portal/members/${item.id}`, updatedAt: item.updatedAt })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  const stats = [
    { section: "News", label: "News posts", count: news.length, href: "/portal/news", newHref: "/portal/news/new" },
    { section: "Documents", label: "Official documents", count: documents.length, href: "/portal/documents", newHref: "/portal/documents/new" },
    { section: "Directory", label: "Commission members", count: members.length, href: "/portal/members", newHref: "/portal/members/new" },
  ];

  // The post set apart at the top of the News page.
  const lead = news.find((post) => post.featured && post.category !== "explainer");
  // Every first name: what comes before the middle initial ("Juan Miguel D. Dela Cruz"), or, with no
  // initial to go by, everything but the last word.
  const words = user.name.trim().split(/\s+/);
  const initial = words.findIndex((word, index) => index > 0 && /^[A-Za-zÑñ]\.$/.test(word));
  const firstNames = words.slice(0, initial > 0 ? initial : Math.max(1, words.length - 1)).join(" ");

  return (
    <main className="portal-page">
      <section className="portal-hero" aria-labelledby="dashboard-title">
        <div className="portal-hero-top">
          <div className="portal-hero-copy">
            <h1 id="dashboard-title"><small>Welcome back,</small> <em>{firstNames}.</em></h1>
            <p className="portal-hero-lede">Everything you publish here appears on the website as soon as you save.</p>
            <div className="portal-hero-actions">
              <Link className="portal-button" href="/portal/news/new"><Plus size={16} aria-hidden="true" /> New post</Link>
              <Link className="portal-button is-ghost" href="/portal/documents/new">Add document</Link>
              <Link className="portal-button is-ghost" href="/portal/members/new">Add member</Link>
            </div>
          </div>
          <div className="portal-orbit" aria-hidden="true">
            <i /><i />
            <Image src="/images/Logo-1.png" alt="" width={84} height={84} />
          </div>
        </div>
        <dl className="portal-hud">
          {readings.map(({ label, href, tone, text }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <Link href={href} className={`is-${tone}`}>{text}</Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <SpotlightGrid className="portal-bento">
        {stats.map(({ section, label, count, href, newHref }) => (
          <article className="portal-card portal-stat" data-spotlight key={section}>
            <header className="portal-stat-head">
              <span className="portal-index">{section}</span>
              <Link className="portal-button is-small is-ghost" href={newHref}><Plus size={14} aria-hidden="true" /> Add</Link>
            </header>
            <strong>{count}</strong>
            <Link className="portal-stat-link portal-stretch" href={href}>{label} <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </article>
        ))}

        <section className="portal-card portal-recent" aria-labelledby="recent-title">
          <header className="portal-card-head">
            <h2 className="portal-card-title" id="recent-title">Recently updated</h2>
            <span className="portal-index">Across the website</span>
          </header>
          {recent.length === 0 ? (
            <p className="portal-empty">Nothing here yet.</p>
          ) : (
            <ul className="portal-list">
              {recent.map((item) => (
                <li key={item.key}>
                  <Link href={item.href}>
                    <span className="portal-list-kind">{item.type}</span>
                    <span className="portal-list-title">{item.title}</span>
                    <time dateTime={item.updatedAt}>{updated.format(new Date(item.updatedAt))}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="portal-card portal-lead" data-spotlight aria-labelledby="lead-title">
          <header className="portal-card-head">
            <span className="portal-index">Featured post</span>
            {lead && <span className="portal-tag is-gold"><Star size={11} aria-hidden="true" /> Featured</span>}
          </header>
          <div className="portal-lead-body">
            {lead ? (
              <>
                <p className="portal-lead-meta"><span>{newsCategories[lead.category]}</span><time dateTime={lead.date}>{formatDate(lead.date)}</time></p>
                <h2 className="portal-lead-title" id="lead-title"><Link className="portal-stretch" href={`/portal/news/${lead.id}`}>{lead.title}</Link></h2>
                <p className="portal-lead-copy">{lead.excerpt}</p>
                <span className="portal-lead-foot">Edit the featured post <ArrowUpRight size={14} aria-hidden="true" /></span>
              </>
            ) : (
              <>
                <h2 className="portal-lead-title" id="lead-title"><Link className="portal-stretch" href="/portal/news">No featured post yet</Link></h2>
                <p className="portal-lead-copy">Feature a post to set it apart at the top of the News page.</p>
                <span className="portal-lead-foot">Choose a post <ArrowUpRight size={14} aria-hidden="true" /></span>
              </>
            )}
          </div>
        </section>
      </SpotlightGrid>
    </main>
  );
}
