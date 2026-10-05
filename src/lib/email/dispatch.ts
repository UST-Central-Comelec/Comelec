import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { deliver, dueEmailIds } from "./outbox";

// What gets a scheduled email out at its time. Three things call dispatchDueEmails, and an email
// is claimed before it's sent (deliver, in ./outbox.ts), so however many of them run, each email
// goes once:
//   • the clock below: once a minute, on a server that keeps running (`next dev`, `next start`,
//     a VPS or container). src/instrumentation.ts starts it.
//   • GET /api/email/dispatch: for hosting that only runs while answering a request (Vercel and the
//     like), where the clock doesn't tick. A cron job calls it every minute with CRON_SECRET.
//   • the Email Sender's own pages, whenever one is opened, as a last resort.

let running = false;

/** Sends every scheduled email whose time has come. Returns how many it started. */
export async function dispatchDueEmails() {
  if (running || !isSupabaseConfigured()) return 0;
  running = true;
  try {
    const ids = await dueEmailIds();
    for (const id of ids) await deliver(id);
    return ids.length;
  } finally {
    running = false;
  }
}

const TICK_MS = 60_000;
const clock = globalThis as typeof globalThis & { comelecOutboxClock?: ReturnType<typeof setInterval> };

/** Starts the once-a-minute check, once per server. */
export function startOutboxClock() {
  if (clock.comelecOutboxClock) return;
  let lastProblem = "";
  clock.comelecOutboxClock = setInterval(() => {
    dispatchDueEmails().then(
      () => (lastProblem = ""),
      (error: unknown) => {
        // Said once, not every minute: before supabase/migrations/0024 is run there's no outbox to check.
        const problem = error instanceof Error ? error.message : String(error);
        if (problem !== lastProblem) console.error("Couldn’t check for scheduled emails:", problem);
        lastProblem = problem;
      },
    );
  }, TICK_MS);
  // Never the reason the server stays up.
  clock.comelecOutboxClock.unref?.();
}
