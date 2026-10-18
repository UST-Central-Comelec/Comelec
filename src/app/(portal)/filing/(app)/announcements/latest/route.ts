import { noticesFor } from "@/lib/filing-portal/notices";
import { getFilingAccount } from "@/lib/filing-portal/session";
import { countAccountNotices } from "@/lib/filing-portal/accounts";
import { countPartyNotices } from "@/lib/party-portal/store";

/** The bell's latest announcements: filing notices only, scoped to the verified account and its active party membership. */
export async function GET() {
  const filing = await getFilingAccount();
  if (!filing) return Response.json({ error: "Sign in to see notifications." }, { status: 401 });
  try {
    const { account, membership } = filing;
    const member = membership?.member.status === "active" ? membership.member : null;
    const [notices, own, party] = await Promise.all([
      noticesFor(filing, 6),
      countAccountNotices(account.id, account.noticesReadAt),
      member ? countPartyNotices(member, account.noticesReadAt) : 0,
    ]);
    const messages = notices.map((notice) => {
      const text = notice.body.replace(/\s+/g, " ").trim();
      return {
        id: notice.id,
        title: notice.title,
        senderName: notice.actor || "Filing portal",
        createdAt: notice.createdAt,
        readAt: account.noticesReadAt && notice.createdAt <= account.noticesReadAt ? account.noticesReadAt : null,
        preview: text.length > 240 ? `${text.slice(0, 239).trimEnd()}…` : text,
        href: `/filing/announcements#message-${notice.id}`,
      };
    });
    return Response.json({ messages, unreadCount: own + party, inboxAvailable: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Notifications are unavailable. Try again shortly." }, { status: 503 });
  }
}
