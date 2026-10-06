import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalUser } from "@/lib/auth/session";
import { getInbox } from "@/lib/notifications/inbox-store";
import { settle } from "@/lib/portal/settle";
import { InboxMessages } from "@/components/portal/inbox-messages";

export const metadata: Metadata = { title: "Notifications" };
export default async function NotificationsPage({ searchParams }: PageProps<"/portal/notifications">) {
  const user = await requirePortalUser();
  const params = await searchParams;
  const page = Math.max(0, Math.min(10000, Number.parseInt(String(params.page ?? "0"), 10) || 0));
  const result = await settle(getInbox(user, undefined, page));
  return <main className="portal-page">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Portal</p><h1>Notifications</h1><p className="portal-muted">Catch up on announcements and account activities you missed.</p></div></header>
    {result.error !== null ? <p className="portal-form-error" role="alert">{result.error}</p> : <InboxMessages messages={result.value} empty={page ? "No more notifications." : "You’re all caught up. New announcements and activities will appear here."} />}
    <nav aria-label="Notification pages" className="portal-inbox-pagination">{page > 0 && <Link className="portal-button is-ghost" href={`?page=${page - 1}`}>Newer</Link>}{result.value?.length === 30 && <Link className="portal-button is-ghost" href={`?page=${page + 1}`}>Older</Link>}</nav>
  </main>;
}
