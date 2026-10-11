import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/auth/session";
import { getPortalAttention } from "@/lib/portal/attention";

export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ counts: await getPortalAttention(user) }, { headers: { "Cache-Control": "private, no-store" } });
}
