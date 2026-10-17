import { NextResponse, type NextRequest } from "next/server";
import { eventVerificationReply, registrationUrl } from "@/lib/events/callback";
import { isEventId, signUpMode } from "@/lib/events/options";
import { getEvent } from "@/lib/events/queries";
import { getRsvpSettings } from "@/lib/events/rsvp-store";
import { getEvaluationSettings } from "@/lib/events/evaluation-store";
import { startEventFlow } from "@/lib/events/verification";
import { endFilingFlow } from "@/lib/filing-portal/verification";
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

  const requested = request.nextUrl.searchParams.get("form");
  const target = requested === "rsvp-form" || requested === "evaluate" ? requested : "register";
  if (!isSupabaseConfigured()) return eventVerificationReply(request, id, target, "unavailable");
  if (!rateLimit(`event-verify:${clientIp(request.headers)}`, limits.eventVerify.limit, limits.eventVerify.windowMs).ok) return eventVerificationReply(request, id, target, "rate-limited");

  // No sign-in for an event that isn't taking sign-ups: its registration page says why.
  const event = await getEvent(id).catch(() => null);
  if (!event || event.published === false) return NextResponse.redirect(new URL("/events", request.nextUrl));
  if (target === "register" && !signUpMode(event)) return NextResponse.redirect(registrationUrl(request, id));
  if (target !== "register") {
    const settings = await (target === "rsvp-form" ? getRsvpSettings(id) : getEvaluationSettings(id)).catch(() => null);
    if (!settings?.enabled) return eventVerificationReply(request, id, target, "unavailable");
  }

  const { data, error } = await (await createAuthClient()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/apply/verify", request.nextUrl).toString(),
      // `hd` only pre-selects UST accounts in Google's picker; the callback enforces the domain.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) return eventVerificationReply(request, id, target, "failed");

  // An abandoned filing portal sign-in mustn't catch this one's callback.
  await endFilingFlow();
  await startEventFlow(id, target);
  return NextResponse.redirect(data.url);
}
