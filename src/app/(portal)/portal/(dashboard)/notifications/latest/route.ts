import { NextResponse } from "next/server";
import { canOpen, getPortalUser } from "@/lib/auth/session";
import { getInbox, getInboxUnreadCount } from "@/lib/notifications/inbox-store";

export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Sign in to see notifications." }, { status: 401 });
  try {
    const [messages, unreadCount] = await Promise.all([getInbox(user), getInboxUnreadCount(user)]);
    return NextResponse.json({ messages, unreadCount, inboxAvailable: canOpen(user, "apps/inbox") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Notifications are unavailable. Try again shortly." }, { status: 503 });
  }
}
