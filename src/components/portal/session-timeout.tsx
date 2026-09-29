"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ABSOLUTE_TIMEOUT_MS, IDLE_TIMEOUT_MS, IDLE_WARNING_MS, type TimeoutReason } from "@/lib/security/portal-session";
import { logout, logoutAfterTimeout } from "@/lib/portal/auth-actions";

// The browser half of the session timeout (the server half is in src/proxy.ts). It tracks real
// activity, tells the server about it every few minutes so typing in a long form doesn't count as
// idle, warns 2 minutes before an idle sign-out, and signs out when time runs out. Activity is
// shared through localStorage, so working in one tab keeps every portal tab signed in.

const STORAGE_KEY = "portal:last-activity";
/** Tell the server about activity at most this often. */
const PING_INTERVAL_MS = 5 * 60_000;
/** Warn this long before the 8-hour limit, which can't be extended. */
const ABSOLUTE_WARNING_MS = 5 * 60_000;

const readShared = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeShared = (time: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(time));
  } catch {
    // Storage blocked: this tab still tracks its own activity.
  }
};

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function SessionTimeout({ startedAt }: { startedAt: number | null }) {
  const router = useRouter();
  const lastActivity = useRef(0);
  const lastPing = useRef(0);
  const ending = useRef(false);
  /** While the idle warning is up, only "Stay signed in" counts; wandering mouse moves don't. */
  const idleWarningShown = useRef(false);
  const absoluteDismissed = useRef(false);
  const [warning, setWarning] = useState<{ reason: TimeoutReason; left: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const stayButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const now = Date.now();
    lastActivity.current = Math.max(now, readShared());
    lastPing.current = now;
    writeShared(lastActivity.current);

    const end = (reason: TimeoutReason) => {
      if (ending.current) return;
      ending.current = true;
      startTransition(() => logoutAfterTimeout(reason));
    };

    const ping = async () => {
      lastPing.current = Date.now();
      try {
        const response = await fetch("/portal/session", { method: "POST", cache: "no-store", redirect: "follow" });
        // The proxy sends a timed-out session to the login page instead of answering.
        if (response.redirected || response.status === 401) router.replace("/portal/login?reason=idle");
      } catch {
        // Offline for now; the next activity tries again, and the server still enforces the limit.
      }
    };

    const onActivity = () => {
      if (ending.current || idleWarningShown.current) return;
      const time = Date.now();
      if (time - lastActivity.current < 5_000) return;
      lastActivity.current = time;
      writeShared(time);
      if (time - lastPing.current >= PING_INTERVAL_MS) void ping();
    };

    const tick = () => {
      if (ending.current) return;
      const time = Date.now();
      lastActivity.current = Math.max(lastActivity.current, readShared());
      const idleLeft = lastActivity.current + IDLE_TIMEOUT_MS - time;
      const absoluteLeft = startedAt ? startedAt + ABSOLUTE_TIMEOUT_MS - time : Infinity;

      if (absoluteLeft <= 0) return end("expired");
      if (idleLeft <= 0) return end("idle");
      idleWarningShown.current = false;
      if (absoluteLeft <= ABSOLUTE_WARNING_MS && absoluteLeft < idleLeft && !absoluteDismissed.current) setWarning({ reason: "expired", left: absoluteLeft });
      else if (idleLeft <= IDLE_WARNING_MS) {
        idleWarningShown.current = true;
        setWarning({ reason: "idle", left: idleLeft });
      } else setWarning(null);
    };

    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const event of events) window.addEventListener(event, onActivity, { passive: true, capture: true });
    // Another tab's activity keeps this one alive too.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) tick();
    };
    window.addEventListener("storage", onStorage);
    const timer = setInterval(tick, 1000);

    return () => {
      for (const event of events) window.removeEventListener(event, onActivity, { capture: true });
      window.removeEventListener("storage", onStorage);
      clearInterval(timer);
    };
  }, [startedAt, router]);

  const shown = Boolean(warning);
  useEffect(() => {
    if (shown) stayButton.current?.focus();
  }, [shown]);

  if (!warning) return null;

  const stay = () => {
    const time = Date.now();
    lastActivity.current = time;
    writeShared(time);
    lastPing.current = time;
    idleWarningShown.current = false;
    setWarning(null);
    void fetch("/portal/session", { method: "POST", cache: "no-store" }).then((response) => {
      if (response.redirected) router.replace("/portal/login?reason=idle");
    }).catch(() => {});
  };

  return (
    <div className="session-warning" role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title" aria-describedby="session-warning-text">
      <div className="session-warning-card">
        <h2 id="session-warning-title">{warning.reason === "idle" ? "Still there?" : "Your session is ending"}</h2>
        <p id="session-warning-text">
          {warning.reason === "idle"
            ? <>For security, you’ll be signed out in <strong>{clock(warning.left)}</strong> because you’ve been inactive.</>
            : <>For security, sessions last 8 hours. You’ll be signed out in <strong>{clock(warning.left)}</strong>. Save your work, then sign in again.</>}
        </p>
        <div className="session-warning-actions">
          <form action={logout}><button className="portal-button is-ghost" type="submit" disabled={pending}>Sign out now</button></form>
          {warning.reason === "idle"
            ? <button ref={stayButton} className="portal-button" type="button" onClick={stay} disabled={pending}>Stay signed in</button>
            : <button ref={stayButton} className="portal-button" type="button" onClick={() => { absoluteDismissed.current = true; setWarning(null); }}>OK</button>}
        </div>
      </div>
    </div>
  );
}
