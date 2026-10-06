import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/auth/session";
import { describeAffiliation } from "@/lib/data/types";
import { canAnnounce, canBroadcast } from "@/lib/notifications/inbox-rules";
import { getInbox } from "@/lib/notifications/inbox-store";
import { settle } from "@/lib/portal/settle";
import { AnnouncementComposer } from "@/components/portal/announcement-composer";
import { InboxMessages } from "@/components/portal/inbox-messages";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/portal/apps/inbox">) {
  const user = await requireAccess("apps/inbox");
  const params = await searchParams;
  const page = Math.max(0, Math.min(10000, Number.parseInt(String(params.page ?? "0"), 10) || 0));
  const result = await settle(getInbox(user, "announcement", page));
  return <main className="portal-page">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Apps</p><h1>Inbox</h1><p className="portal-muted">Announcements from your unit and Central Comelec.</p></div></header>
    {params.notice === "sent" && <p role="status" className="portal-muted">Announcement sent.</p>}
    {canAnnounce(user) && <AnnouncementComposer broadcast={canBroadcast(user)} unit={describeAffiliation(user.affiliation, user.college)} />}
    {result.error !== null ? <p className="portal-form-error" role="alert">{result.error}</p> : <InboxMessages messages={result.value} empty={page ? "No more announcements." : "No announcements yet. Messages sent to your unit will appear here."} />}
    <nav aria-label="Inbox pages" className="portal-inbox-pagination">{page > 0 && <Link className="portal-button is-ghost" href={`?page=${page - 1}`}>Newer</Link>}{result.value?.length === 30 && <Link className="portal-button is-ghost" href={`?page=${page + 1}`}>Older</Link>}</nav>
  </main>;
}
