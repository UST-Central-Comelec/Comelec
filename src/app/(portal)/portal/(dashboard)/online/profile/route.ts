import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/auth/session";
import { presenceProfile } from "@/lib/portal/presence-store";
import { rateLimit } from "@/lib/security/rate-limit";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function GET(request: Request) {
  const user = await getPortalUser();
  if (!user) return fail("Sign in first.", 401);
  if (!rateLimit(`presence-profile:${user.email}`, 60, 60_000).ok) return fail("Please wait before opening another profile.", 429);
  const accountId = new URL(request.url).searchParams.get("accountId");
  if (!accountId || accountId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(accountId)) return fail("That profile is unavailable.", 400);
  try {
    const profile = await presenceProfile(user, accountId);
    if (!profile) return fail("This profile is unavailable or outside your college access.", 404);
    return NextResponse.json(profile, { headers });
  } catch (error) {
    console.error(error);
    return fail("Couldn’t load this profile. Try again shortly.", 503);
  }
}
