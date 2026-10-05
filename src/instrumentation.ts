// Runs once when the server starts. It starts the clock that sends the Email Sender's scheduled
// emails at their time (src/lib/email/dispatch.ts). Only where there's a Node.js server to keep
// ticking; hosting that runs per request uses the cron address described there instead.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startOutboxClock } = await import("@/lib/email/dispatch");
  startOutboxClock();
}
