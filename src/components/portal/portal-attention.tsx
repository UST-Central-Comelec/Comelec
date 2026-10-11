"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { AttentionCounts } from "@/lib/portal/attention-types";

/**
 * Each check runs every queue's query on the server, so moving between tabs, focusing the window
 * and showing the tab again refresh the counts at most this often. A change made here (applicants
 * seen, a notification read) refreshes them straight away, and so does the minute timer.
 */
const MIN_INTERVAL_MS = 15_000;

/**
 * The sidebar's badge counts. `initial` is the layout's, streamed in after the page; a new one comes
 * whenever the layout renders again (after a save revalidates it), and it's taken as it arrives.
 */
export function usePortalAttention(initial: Promise<AttentionCounts>) {
  const [counts, setCounts] = useState<AttentionCounts>({});
  useEffect(() => {
    let live = true;
    initial.then((fresh) => { if (live) setCounts(fresh); }, () => { /* The minute timer tries again. */ });
    return () => { live = false; };
  }, [initial]);
  const pathname = usePathname();
  // Null until mounted. The counts the server is streaming stand in for the first check.
  const lastLoaded = useRef<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let request = 0;
    let pending = false;
    const load = async (force = false) => {
      if (document.visibilityState === "hidden") return;
      if (!force && lastLoaded.current !== null && Date.now() - lastLoaded.current < MIN_INTERVAL_MS) return;
      lastLoaded.current = Date.now();
      const current = ++request;
      pending = true;
      try {
        const response = await fetch("/portal/attention", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && current === request && data.counts && typeof data.counts === "object") {
          const valid = Object.fromEntries(Object.entries(data.counts).filter(([, value]) => typeof value === "number" && Number.isInteger(value) && value >= 0));
          setCounts(previous => ({ ...previous, ...valid }));
        }
      } catch { /* Retain the last counts while disconnected. */ }
      finally { if (current === request) pending = false; }
    };
    if (lastLoaded.current === null) lastLoaded.current = Date.now();
    else void load();
    const throttled = () => void load();
    const forced = () => void load(true);
    const timer = window.setInterval(forced, 60000);
    window.addEventListener("focus", throttled);
    window.addEventListener("portal-applicants-seen", forced);
    window.addEventListener("portal-notifications-changed", forced);
    document.addEventListener("visibilitychange", throttled);
    return () => {
      // A check cut short by leaving the page doesn't count: the next page makes its own.
      if (pending) lastLoaded.current = 0;
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", throttled);
      window.removeEventListener("portal-applicants-seen", forced);
      window.removeEventListener("portal-notifications-changed", forced);
      document.removeEventListener("visibilitychange", throttled);
    };
  }, [pathname]);
  return counts;
}
