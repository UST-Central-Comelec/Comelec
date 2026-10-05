import { timingSafeEqual } from "node:crypto";
import { dispatchDueEmails } from "@/lib/email/dispatch";

// Sends the Email Sender's scheduled emails that are due. For hosting where the server only runs
// while answering a request, so its own once-a-minute clock (src/lib/email/dispatch.ts) doesn't
// tick: have a cron job call this every minute with `Authorization: Bearer <CRON_SECRET>`.
// Vercel Cron sends that header by itself once CRON_SECRET is set. Without CRON_SECRET this
// address doesn't exist.

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Not found.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  try {
    return Response.json({ started: await dispatchDueEmails() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Couldn’t send the scheduled emails:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn’t check the outbox." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
