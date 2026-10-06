import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAccess } from "@/lib/auth/session";
import { canAnnounce } from "@/lib/notifications/inbox-rules";
import { getInbox } from "@/lib/notifications/inbox-store";
import { settle } from "@/lib/portal/settle";
import { InboxMessages } from "@/components/portal/inbox-messages";
import { AnnouncementConfirmation } from "@/components/portal/announcement-confirmation";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/portal/apps/inbox">) {
  const user = await requireAccess("apps/inbox");
  const params = await searchParams;
  const tab = params.tab === "read" || params.tab === "unread" ? params.tab : "all";
  const page = Math.max(0, Math.min(10000, Number.parseInt(String(params.page ?? "0"), 10) || 0));
  const result = await settle(getInbox(user, undefined, page, tab));
  return <main className="portal-page portal-inbox-page">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Apps</p><h1>Inbox</h1></div>
      {canAnnounce(user) && <Link className="portal-button" href="/portal/apps/inbox/new"><Plus size={16} aria-hidden="true" />New announcement</Link>}
    </header>
    {params.notice === "sent" && <AnnouncementConfirmation />}
    {result.error !== null ? <p className="portal-form-error" role="alert">{result.error}</p> : <InboxMessages tab={tab} messages={result.value} empty={page ? "No more messages." : tab === "read" ? "Messages you’ve marked as read will appear here." : tab === "unread" ? "You have no unread messages." : "Announcements and account activities sent to you will appear here."} />}
    <nav aria-label="Inbox pages" className="portal-inbox-pagination">{page > 0 && <Link className="portal-button is-ghost" href={`?tab=${tab}&page=${page - 1}`}>Newer</Link>}{result.value?.length === 30 && <Link className="portal-button is-ghost" href={`?tab=${tab}&page=${page + 1}`}>Older</Link>}</nav>
  </main>;
}
