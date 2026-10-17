import type { Metadata } from "next";
import Link from "next/link";
import { MarkNoticesRead } from "@/components/party-portal/member-requests";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { formatClosing } from "@/lib/applications/period";
import { noticesFor } from "@/lib/filing-portal/notices";
import { requireFilingAccount } from "@/lib/filing-portal/session";

export const metadata: Metadata = { title: "Notifications" };

/** The unit's feedback and decisions, the party's news and its contact person's answers, newest first. Each also goes by email. */
export default async function FilingNotificationsPage() {
  const filing = await requireFilingAccount();
  const notices = await noticesFor(filing);
  const readAt = filing.account.noticesReadAt;
  const unread = notices.filter((item) => !readAt || item.createdAt > readAt).length;

  return (
    <main className="portal-page">
      <MarkNoticesRead unread={unread} />
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing portal</p>
          <TitleWithInfo info="Feedback and decisions from your Comelec unit, your party’s news, and answers from its contact person. Each is emailed to you too.">Notifications</TitleWithInfo>
          <p className="portal-muted">{unread ? `${unread} new` : "All caught up"}</p>
        </div>
      </header>
      <section className="portal-card is-flush">
        {notices.length ? (
          <ul className="pp-notices">
            {notices.map((item) => (
              <li key={item.id} className={!readAt || item.createdAt > readAt ? "is-new" : undefined}>
                <strong>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</strong>
                {item.body && <p>{item.body}</p>}
                <small>{[item.actor, formatClosing(item.createdAt)].filter(Boolean).join(" · ")}</small>
              </li>
            ))}
          </ul>
        ) : <p className="portal-empty">Nothing yet. When your unit reviews a document, or your party has news, it shows up here.</p>}
      </section>
    </main>
  );
}
