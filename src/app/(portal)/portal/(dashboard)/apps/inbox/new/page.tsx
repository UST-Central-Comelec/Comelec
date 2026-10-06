import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { describeAffiliation } from "@/lib/data/types";
import { canAnnounce, canBroadcast } from "@/lib/notifications/inbox-rules";
import { AnnouncementComposer } from "@/components/portal/announcement-composer";

export const metadata: Metadata = { title: "New announcement" };

export default async function NewAnnouncementPage() {
  const user = await requireEditor("apps/inbox");
  if (!canAnnounce(user)) redirect("/portal/apps/inbox");
  return <main className="portal-page portal-announcement-page">
    <header className="portal-page-head"><div><Link className="portal-back" href="/portal/apps/inbox">← Inbox</Link><h1>New announcement</h1><p className="portal-muted">Share an update with your commissioners.</p></div></header>
    <AnnouncementComposer broadcast={canBroadcast(user)} unit={describeAffiliation(user.affiliation, user.college)} />
  </main>;
}
