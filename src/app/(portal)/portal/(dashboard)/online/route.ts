import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/auth/session";
import { checkIn } from "@/lib/portal/presence-store";
import { isSameSiteRequest } from "@/lib/portal/online-security";
import { rateLimit } from "@/lib/security/rate-limit";

const headers = { "Cache-Control": "private, no-store" };

/**
 * The online pill's check-in, about once a minute while a portal tab is open: records that the
 * signed-in person is here and answers with who else has been, so one request does both, along
 * with the channels their browser listens on for chat and following. Not counted as activity by
 * the proxy, so an open tab alone doesn't hold off the idle timeout.
 */
export async function POST(request: Request) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: "Open the portal to check in." }, { status: 403, headers });
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  if (!rateLimit(`presence:${user.email}`, 30, 60_000).ok) return NextResponse.json({ error: "Wait a moment before checking again." }, { status: 429, headers });
  try {
    return NextResponse.json(await checkIn(user), { headers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Who’s online is unavailable. Try again shortly." }, { status: 503, headers });
  }
}
