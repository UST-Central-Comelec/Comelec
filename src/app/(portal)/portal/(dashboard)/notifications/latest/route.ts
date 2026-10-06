import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/auth/session";
import { getInbox } from "@/lib/notifications/inbox-store";

export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Sign in to see notifications." }, { status: 401 });
  try {
    const messages = await getInbox(user);
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Notifications are unavailable. Try again shortly." }, { status: 503 });
  }
}
