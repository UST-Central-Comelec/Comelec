import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/auth/session";
import { isPortalPath, MESSAGE_MAX, presenceUnit, relayKinds, type RelayEvent, type RelayKind } from "@/lib/portal/presence";
import { findOnline, inboxTopic, senderOf, unitRecipients } from "@/lib/portal/presence-store";
import { broadcast } from "@/lib/portal/realtime-relay";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameSiteRequest } from "@/lib/portal/online-security";

const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

/**
 * Passes a chat message or a follow signal to someone online. The server says who it's from, so no
 * one can send as someone else, and keeps nothing: it's gone once delivered. A chat message also
 * goes to the sender's own inbox, so their other tabs show it.
 */
export async function POST(request: Request) {
  if (!isSameSiteRequest(request)) return fail("Open the portal to send messages.", 403);
  const user = await getPortalUser();
  if (!user) return fail("Sign in first.", 401);
  const body = await request.json().catch(() => null) as { kind?: unknown; to?: unknown; text?: unknown; path?: unknown; messageId?: unknown } | null;
  const kind = body?.kind as RelayKind;
  if (!relayKinds.includes(kind) || typeof body?.to !== "string") return fail("That isn’t something that can be sent.", 400);
  if (kind === "unit-chat") {
    if (body.to !== presenceUnit(user).key) return fail("This group belongs to another unit.", 403);
  } else if (body.to.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(body.to)) return fail("That isn’t something that can be sent.", 400);

  const from = await senderOf(user);
  if (!rateLimit(`relay:${from.email}`, 120, 60_000).ok) return fail("You’re sending too fast. Wait a moment.", 429);
  if (body.to === from.accountId) return fail("That’s you.", 400);

  const event: RelayEvent = { kind, from, to: body.to, at: new Date().toISOString() };
  if (kind === "chat" || kind === "unit-chat") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > MESSAGE_MAX) return fail(`A message is 1 to ${MESSAGE_MAX} characters.`, 400);
    if (typeof body.messageId !== "string" || !/^[\w-]{8,64}$/.test(body.messageId)) return fail("That message has no id.", 400);
    event.text = text;
    event.messageId = body.messageId;
  }
  if (kind === "path" || kind === "follow-accept") {
    if (!isPortalPath(body.path)) return fail("That isn’t a portal page.", 400);
    event.path = body.path;
  }

  try {
    if (kind === "unit-chat") {
      const topics = await Promise.all((await unitRecipients(user)).map(inboxTopic));
      // Realtime accepts small batches; each inbox receives this same message id once.
      for (let index = 0; index < topics.length; index += 50) await broadcast(topics.slice(index, index + 50), event);
      return NextResponse.json({ ok: true, at: event.at }, { headers });
    }
    const recipient = await findOnline(event.to);
    if (!recipient) return fail("They’ve left the portal.", 410);
    const topics = [await inboxTopic(recipient.account_id)];
    if (kind === "chat") topics.push(await inboxTopic(from.accountId));
    await broadcast(topics, event);
    return NextResponse.json({ ok: true, at: event.at }, { headers });
  } catch (error) {
    console.error(error);
    return fail("Couldn’t send. Try again shortly.", 503);
  }
}
