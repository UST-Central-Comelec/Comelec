"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight } from "lucide-react";
import { COOKIE_NOTICE_KEY } from "@/lib/cookie-notice";

// The site only sets cookies it can't work without (see the policy at /cookies), so this is a
// notice, not a consent prompt: there's nothing to accept or decline, it never blocks the page, and
// it's shown once. Dismissing it is remembered in localStorage rather than in one more cookie.

/** How long the card takes to leave (cn-leave in cookie-notice.css). */
const LEAVE_MS = 420;

/** Dismissing it in another tab dismisses it here too. */
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/** Whether this browser has dismissed this `version` of the notice (cookieNoticeVersion in lib/cookie-notice.ts). */
const readDismissed = (version: string) => {
  try {
    return localStorage.getItem(COOKIE_NOTICE_KEY) === version;
  } catch {
    // Storage blocked: show it, and it stays dismissed for this visit only.
    return false;
  }
};

export function CookieNotice({ version }: { version: string }) {
  const pathname = usePathname();
  // The server can't know, so it renders nothing; the browser adds the notice if it's still due.
  const remembered = useSyncExternalStore(subscribe, () => readDismissed(version), () => true);
  const [phase, setPhase] = useState<"open" | "leaving" | "gone">("open");
  const leaveTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // The policy page says all of this at length, so the notice stays out of its way.
  if (remembered || phase === "gone" || pathname === "/cookies") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, version);
    } catch {
      // Storage blocked: nothing to remember it in.
    }
    setPhase("leaving");
    leaveTimer.current = window.setTimeout(() => setPhase("gone"), LEAVE_MS);
  };

  return (
    <section className={`cn${phase === "leaving" ? " is-leaving" : ""}`} aria-labelledby="cn-title">
      <p className="cn-label"><span className="cn-dot" aria-hidden="true" />Cookie notice</p>
      <h2 id="cn-title" className="cn-title">Only the <em>essentials.</em></h2>
      <p className="cn-text">Cookies are set only when you sign in with your UST Google account, to verify you and keep your session secure. No tracking, no ads.</p>
      <div className="cn-actions">
        <button type="button" className="cn-button is-primary" onClick={dismiss}>Got it</button>
        <Link href="/cookies" className="cn-button is-ghost">Cookie policy<ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
