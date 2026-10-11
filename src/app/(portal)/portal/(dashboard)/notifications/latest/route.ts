import { NextResponse } from "next/server";
import { canOpen, getPortalUser } from "@/lib/auth/session";
import { documentBodyText, parseDocumentBody } from "@/lib/data/document-body";
import { getInbox, getInboxUnreadCount } from "@/lib/notifications/inbox-store";
import type { InboxPreview } from "@/lib/notifications/inbox-rules";

/** How many the bell lists, and how much of each body it shows. */
const SHOWN = 6;
const PREVIEW_LENGTH = 240;

/**
 * The bell's latest notifications, polled every minute. Bodies are turned into a short line here,
 * so the browser gets a few hundred characters per message instead of whole announcements, and the
 * portal's every page doesn't carry the document-body parser.
 */
export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Sign in to see notifications." }, { status: 401 });
  try {
    const [inbox, unreadCount] = await Promise.all([getInbox(user), getInboxUnreadCount(user)]);
    const messages: InboxPreview[] = inbox.slice(0, SHOWN).map(({ body, ...message }) => {
      const text = documentBodyText(parseDocumentBody(body)).replace(/\s+/g, " ").trim();
      return { ...message, preview: text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : text };
    });
    return NextResponse.json({ messages, unreadCount, inboxAvailable: canOpen(user, "apps/inbox") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Notifications are unavailable. Try again shortly." }, { status: 503 });
  }
}
