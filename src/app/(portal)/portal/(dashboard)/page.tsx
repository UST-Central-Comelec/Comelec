import { newsContentText } from "@/lib/data/news-content";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, FileText, Newspaper, Plus, Star, Users } from "lucide-react";
import { GlowingGrid } from "@/components/portal/glowing-grid";
import { HeroReadings, type Reading } from "@/components/portal/hero-readings";
import { listPendingAccessRequests } from "@/lib/access-requests/admin";
import { listApplications } from "@/lib/applications/admin";
import { closingTime, isAccepting, isClosingSoon, type ApplicationPeriod } from "@/lib/applications/period";
import { canOpen, isLocal, requireAccess } from "@/lib/auth/session";
import { approverRoleOf } from "@/lib/codes/options";
import { listRevisions } from "@/lib/codes/store";
import { properName } from "@/lib/data/accounts";
import { getDirectory, getDocuments, getPosts } from "@/lib/data/queries";
import { documentKinds, formatDate, newsCategories } from "@/lib/data/types";
import { comelecUnit } from "@/lib/events/options";
import { getEvents } from "@/lib/events/queries";
import { unitOfAccount } from "@/lib/events/access";
import { getUnitPeriod } from "@/lib/periods/store";
import { tabHref, type TabKey } from "@/lib/portal/access";
import { canDecideRequest } from "@/lib/portal/account-scope";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Dashboard" };

const zone = "Asia/Manila";
const dayMonth = new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric" });
const updated = new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric", year: "numeric" });

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const sectionIcons: Record<string, typeof Newspaper> = { News: Newspaper, Documents: FileText, Directory: Users, Events: CalendarDays };

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

/**
 * The dashboard shows only what the account's tabs cover: a reading, a count or a shortcut is left
 * out when its tab isn't open to them, and a Local account's figures are its own college's.
 */
export default async function PortalDashboardPage() {
  const user = await requireAccess("dashboard");
  const can = (tab: TabKey) => canOpen(user, tab);
  const local = isLocal(user);
  /** The first of these tabs that's open to them, to link a reading to. */
  const firstOpen = (...tabs: TabKey[]) => tabs.find(can);

  // Every unit opens and closes its own Recruitment, Political Party Registration and Filing of
  // Candidacy: the readings are the account's own unit's.
  const unit = unitOfAccount(user);
  const recruitmentTab = firstOpen("recruitment/settings", "recruitment/applications");
  const candidacyTab = firstOpen("candidacy/settings", "candidacy/filings");
  const partiesTab = firstOpen("polpar/settings", "polpar/registrations");

  // Loads for a tab that isn't open to them are skipped (null). The readings never take the
  // dashboard down: one that can't be loaded just says so.
  const [news, documents, directory, events, applications, candidacy, parties, pending, requests, revisions] = await Promise.all([
    can("news") ? getPosts() : [],
    can("documents") ? getDocuments() : [],
    can("members") ? getDirectory() : null,
    can("events") ? settle(getEvents()) : null,
    recruitmentTab && unit ? settle(getUnitPeriod("recruitment", unit)) : null,
    candidacyTab && unit ? settle(getUnitPeriod("candidacy", unit)) : null,
    partiesTab && unit ? settle(getUnitPeriod("party-registration", unit)) : null,
    can("recruitment/applications") ? settle(listApplications(local ? { status: "pending", college: user.college ?? "" } : { status: "pending" })) : null,
    can("accounts") ? settle(listPendingAccessRequests()) : null,
    can("apps/approvals") ? settle(listRevisions({ status: "pending" })) : null,
  ]);

  // Their own unit's: the Central Comelec's for a Central account, their college's for a Local one.
  const ownEvents = (events?.value ?? []).filter((event) => (local ? event.organizer === "local" && event.college === user.college : event.organizer === "central"));
  const people = directory ? (local ? directory.local.filter((person) => person.college === user.college) : [...directory.central, ...directory.local]) : [];
  const waiting = requests?.value ? requests.value.filter((request) => canDecideRequest(user, request)).length : null;
  // Revisions of the Constitution and the Elections Code sent for approval: for one of the three who sign, those still missing their approval.
  const office = user.readOnly ? null : approverRoleOf(user);
  const toApprove = revisions?.value ? revisions.value.filter((revision) => !office || !revision.approvals[office]).length : null;

  const readings = [
    ...(recruitmentTab && applications ? [periodReading("Recruitment", tabHref(recruitmentTab), applications.value, "Closed")] : []),
    ...(candidacyTab && candidacy ? [periodReading("Candidacy", tabHref(candidacyTab), candidacy.value, "Not open")] : []),
    ...(partiesTab && parties ? [periodReading("Parties", tabHref(partiesTab), parties.value, "Not open")] : []),
    ...(pending ? [queueReading("To review", `/portal/recruitment/applications?status=pending${local ? "" : "&body=all"}`, pending.value?.length ?? null, "application")] : []),
    ...(requests ? [queueReading("Access requests", "/portal/accounts?status=pending", waiting, "request")] : []),
    ...(revisions ? [queueReading(office ? "To approve" : "Approvals", tabHref("apps/approvals"), toApprove, "revision")] : []),
  ];

  const recent = [
    ...news.map((item) => ({ key: `news-${item.id}`, title: item.title, type: newsCategories[item.category], href: `/portal/news/${item.id}`, updatedAt: item.updatedAt })),
    ...documents.map((item) => ({ key: `doc-${item.id}`, title: item.title, type: documentKinds[item.kind], href: `/portal/documents/${item.id}`, updatedAt: item.updatedAt })),
    ...ownEvents.map((item) => ({ key: `event-${item.id}`, title: item.name, type: "Event", href: `/portal/events/${item.id}`, updatedAt: item.updatedAt })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  // Up to three counts. The Directory has nothing to add: it's filled in from Accounts. Nor has an
  // Adviser or Admin, who only reads.
  const adds = !user.readOnly;
  const stats = [
    ...(can("news") ? [{ section: "News", label: "News posts", count: news.length, href: "/portal/news", newHref: adds ? "/portal/news/new" : null }] : []),
    ...(can("documents") ? [{ section: "Documents", label: "Official documents", count: documents.length, href: "/portal/documents", newHref: adds ? "/portal/documents/new" : null }] : []),
    ...(can("members") ? [{ section: "Directory", label: local ? "In your Local Comelec" : "Commission members", count: people.length, href: "/portal/members", newHref: null }] : []),
    ...(can("events") ? [{ section: "Events", label: local ? "Your unit’s events" : "Central Comelec events", count: ownEvents.length, href: "/portal/events", newHref: adds ? "/portal/events/new" : null }] : []),
  ].slice(0, 3);

  // Shortcuts to what they can add; the first is the main button.
  const actions = adds
    ? [
        ...(can("news") ? [{ href: "/portal/news/new", label: "New post" }] : []),
        ...(can("documents") ? [{ href: "/portal/documents/new", label: "Add document" }] : []),
        ...(can("events") ? [{ href: "/portal/events/new", label: "Add event" }] : []),
      ]
    : [];
  const publishes = actions.length > 0;

  // The post set apart at the top of the News page.
  const lead = news.find((post) => post.featured && post.category !== "explainer");
  const showLead = can("news");
  // Nothing to list for an account with none of the tabs it draws from.
  const showRecent = can("news") || can("documents") || can("events");
  // Who to greet. Names are kept in capitals; a greeting isn't shouted. An official account is greeted
  // as its unit. An account with no name parts yet: what comes before the middle initial
  // ("JUAN MIGUEL D. DELA CRUZ"), or, with no initial to go by, everything but the last word.
  const words = user.name.trim().split(/\s+/);
  const initial = words.findIndex((word, index) => index > 0 && /^[A-Za-zÑñ]\.$/.test(word));
  const firstNames =
    user.kind === "official"
      ? comelecUnit(local ? "local" : "central", user.college).replace(/ Unit$/, "")
      : properName(user.firstName || words.slice(0, initial > 0 ? initial : Math.max(1, words.length - 1)).join(" "));

  return (
    <main className="portal-page portal-dashboard" key={user.id}>
      <GlowingGrid className="dashboard-hero-glow">
        <section className="portal-hero" data-glow aria-labelledby="dashboard-title">
          <span className="dashboard-hero-inset" aria-hidden="true" />
          <div className="portal-hero-top">
            <div className="portal-hero-copy">
              <h1 id="dashboard-title"><small>Welcome back,</small> <em>{firstNames}.</em></h1>
              <p className="portal-hero-lede">{publishes ? "Everything you publish here appears on the website as soon as you save." : user.readOnly ? "Here’s where things stand. Your account is view only: you can read every tab open to you, and change nothing." : "Here’s where things stand in the tabs open to you."}</p>
              {publishes && (
                <div className="portal-hero-actions">
                  {actions.map(({ href, label }, index) => (
                    <Link key={href} className={index === 0 ? "portal-button" : "portal-button is-ghost"} href={href}>{index === 0 && <Plus size={16} aria-hidden="true" />} {label}</Link>
                  ))}
                </div>
              )}
            </div>
            <div className="portal-orbit" aria-hidden="true">
              <i /><i />
              <Image src="/images/Logo-1.png" alt="" width={84} height={84} />
            </div>
          </div>
          <HeroReadings readings={readings} />
        </section>
      </GlowingGrid>

      <GlowingGrid className={`portal-bento has-${stats.length}`}>
        {stats.map(({ section, label, count, href, newHref }) => {
          const Icon = sectionIcons[section];
          return (
            <article className="portal-card portal-stat" data-glow key={section}>
              <header className="portal-stat-head">
                <span className="dashboard-card-label"><span className="dashboard-card-icon"><Icon size={18} strokeWidth={1.6} aria-hidden="true" /></span><span className="portal-index">{section}</span></span>
                {newHref ? <Link className="portal-button is-small is-ghost" href={newHref}><Plus size={14} aria-hidden="true" /> Add</Link> : section === "Directory" && <span className="portal-tag">From Accounts</span>}
              </header>
              <strong>{count}</strong>
              <Link className="portal-stat-link portal-stretch" href={href}>{label} <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </article>
          );
        })}

        {showRecent && <section className={`portal-card portal-recent${showLead ? "" : " is-full"}`} data-glow aria-labelledby="recent-title">
          <header className="portal-card-head">
            <div className="dashboard-card-label"><span className="dashboard-card-icon"><Clock3 size={18} strokeWidth={1.6} aria-hidden="true" /></span><h2 className="portal-card-title" id="recent-title">Recently updated</h2></div>
            <span className="portal-index">{local ? "In your unit" : "Across the website"}</span>
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
        </section>}

        {showLead && <section className="portal-card portal-lead" data-glow aria-labelledby="lead-title">
          <header className="portal-card-head">
            <span className="dashboard-card-label"><span className="dashboard-card-icon"><Star size={18} strokeWidth={1.6} aria-hidden="true" /></span><span className="portal-index">Featured post</span></span>
            {lead && <span className="portal-tag is-gold"><Star size={11} aria-hidden="true" /> Featured</span>}
          </header>
          <div className="portal-lead-body">
            {lead ? (
              <>
                <p className="portal-lead-meta"><span>{newsCategories[lead.category]}</span><time dateTime={lead.date}>{formatDate(lead.date)}</time></p>
                <h2 className="portal-lead-title" id="lead-title"><Link className="portal-stretch" href={`/portal/news/${lead.id}`}>{lead.title}</Link></h2>
                <p className="portal-lead-copy">{newsContentText(lead.excerpt)}</p>
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
        </section>}
      </GlowingGrid>
    </main>
  );
}
