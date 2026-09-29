import { NextResponse } from "next/server";

// Keep-alive for the session timeout. The portal pings this while someone is working on a page
// without navigating (e.g. writing a long news post); src/proxy.ts has already checked the session
// and recorded the activity by the time this runs. A timed-out session never gets here: the proxy
// redirects it to the login page instead, which the client treats as signed out.

export function POST() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
