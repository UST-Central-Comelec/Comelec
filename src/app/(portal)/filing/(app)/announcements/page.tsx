import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MarkNoticesRead } from "@/components/party-portal/member-requests";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { formatClosing } from "@/lib/applications/period";
import { getNews } from "@/lib/data/queries";
import { formatEventDate } from "@/lib/events/format";
import { noticesFor } from "@/lib/filing-portal/notices";
import { requireFilingAccount } from "@/lib/filing-portal/session";

export const metadata: Metadata = { title: "Announcements" };

/** The Comelec's announcements on the website, newest first. Never takes the page down. */
async function comelecAnnouncements() {
  try {
    return (await getNews()).filter((post) => post.category === "announcement").slice(0, 30);
  } catch (error) {
    console.error("Couldn’t load the announcements:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Announcements: for you (the unit's feedback and decisions, the party's news, the answers to the
 * account's requests and petitions, newest first, each emailed too), and from the Comelec (the
 * announcements it publishes on the website).
 */
export default async function FilingAnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filing = await requireFilingAccount();
  const { show } = await searchParams;
  const view = show === "comelec" ? "comelec" : "you";
  const [notices, posts] = await Promise.all([noticesFor(filing), view === "comelec" ? comelecAnnouncements() : Promise.resolve([])]);
  const readAt = filing.account.noticesReadAt;
  const unread = notices.filter((item) => !readAt || item.createdAt > readAt).length;

  return (
    <main className="portal-page">
      <MarkNoticesRead unread={unread} />
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing portal</p>
          <TitleWithInfo info="For you: feedback and decisions from your Comelec unit, your party’s news, and answers to your requests and petitions. Each is emailed to you too. From the Comelec: the announcements it publishes on the website.">Announcements</TitleWithInfo>
          <p className="portal-muted">{unread ? `${unread} new for you` : "All caught up"}</p>
        </div>
      </header>
      <SlidingFilters label="Announcements" active={view} items={[
        { key: "you", href: "/filing/announcements", label: "For you" },
        { key: "comelec", href: "/filing/announcements?show=comelec", label: "From the Comelec" },
      ]} />

      {view === "you" ? (
        <section className="portal-card is-flush pp-feed">
          {notices.length ? (
            <ul className="pp-notices">
              {notices.map((item) => (
                <li key={item.id} id={`message-${item.id}`} className={!readAt || item.createdAt > readAt ? "is-new" : undefined}>
                  <strong>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</strong>
                  {item.body && <p>{item.body}</p>}
                  <small>{[item.actor, formatClosing(item.createdAt)].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
            </ul>
          ) : <p className="portal-empty">Nothing yet. When your unit reviews a document, answers a request, or your party has news, it shows up here.</p>}
        </section>
      ) : (
        <section className="portal-card is-flush pp-feed">
          {posts === null ? <p className="portal-empty">The Comelec’s announcements couldn’t be loaded. Reload the page to try again.</p> : posts.length ? (
            <ul className="pp-notices">
              {posts.map((post) => (
                <li key={post.id}>
                  <strong><a href={`/news/${post.id}`} target="_blank" rel="noopener noreferrer">{post.title} <ArrowUpRight size={13} aria-hidden="true" /></a></strong>
                  {post.excerpt && <p>{post.excerpt}</p>}
                  <small>UST Central Comelec · {formatEventDate(post.date)}</small>
                </li>
              ))}
            </ul>
          ) : <p className="portal-empty">The Comelec hasn’t published any announcements yet.</p>}
        </section>
      )}
    </main>
  );
}
