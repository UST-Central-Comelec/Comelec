import { NextResponse, type NextRequest } from "next/server";
import { registrationUrl } from "@/lib/events/callback";
import { isEventId, signUpMode } from "@/lib/events/options";
import { getEvent } from "@/lib/events/queries";
import { startEventFlow } from "@/lib/events/verification";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_EMAIL_DOMAIN, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

// Where an event's Register (or Join the waitlist) button leads: starts Google sign-in for a UST
// account. Google returns to the applicant callback (/apply/verify), which sees the flow cookie set
// here and sends the student on to this event's registration form. A GET only starts sign-in and
// sets short-lived cookies, so it's safe as a plain link.

export async function GET(request: NextRequest, context: RouteContext<"/events/[id]/register/start">) {
  const { id } = await context.params;
  if (!isEventId(id)) return NextResponse.redirect(new URL("/events", request.nextUrl));

  if (!isSupabaseConfigured()) return NextResponse.redirect(registrationUrl(request, id, "unavailable"));
  if (!rateLimit(`event-verify:${clientIp(request.headers)}`, limits.eventVerify.limit, limits.eventVerify.windowMs).ok) return NextResponse.redirect(registrationUrl(request, id, "rate-limited"));

  // No sign-in for an event that isn't taking sign-ups: its registration page says why.
  const event = await getEvent(id).catch(() => null);
  if (!event) return NextResponse.redirect(new URL("/events", request.nextUrl));
  if (!signUpMode(event)) return NextResponse.redirect(registrationUrl(request, id));

  const { data, error } = await (await createAuthClient()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/apply/verify", request.nextUrl).toString(),
      // `hd` only pre-selects UST accounts in Google's picker; the callback enforces the domain.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) return NextResponse.redirect(registrationUrl(request, id, "failed"));

  await startEventFlow(id);
  return NextResponse.redirect(data.url);
}
