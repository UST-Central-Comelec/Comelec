import { NextResponse } from "next/server";
import { canOpen, getPortalUser } from "@/lib/auth/session";
import { getUnseenApplicantCount } from "@/lib/applications/views";

export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!canOpen(user, "recruitment/applications")) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  try {
    return NextResponse.json({ count: await getUnseenApplicantCount(user) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unread applicants unavailable." }, { status: 503 });
  }
}
