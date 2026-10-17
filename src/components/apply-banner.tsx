"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/** What the banner shows about the application period; set in the portal (Recruitment → Settings). */
export type BannerPeriod = { accepting: boolean; closesAt: number | null; closesLabel: string | null };

/** Days, hours, minutes and seconds left until `deadline`, ticking every second. Blank until mounted so server and client markup match. */
function Countdown({ deadline, closesLabel, noun }: { deadline: number; closesLabel: string | null; noun: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const left = now === null ? null : Math.max(0, deadline - now);
  const ended = left === 0;
  // Once time runs out, reload the page's data so the form gives way to the closed message. The
  // short wait gives a server clock that's a moment behind this one time to agree.
  useEffect(() => {
    if (!ended) return;
    const timer = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(timer);
  }, [ended, router]);
  if (ended) return <div className="apply-countdown is-closed">{noun} closed</div>;

  const seconds = left === null ? null : Math.floor(left / 1000);
  const units: Array<[string, number | null]> = [
    ["days", seconds === null ? null : Math.floor(seconds / 86400)],
    ["hrs", seconds === null ? null : Math.floor(seconds / 3600) % 24],
    ["min", seconds === null ? null : Math.floor(seconds / 60) % 60],
    ["sec", seconds === null ? null : seconds % 60],
  ];
  return (
    <div className="apply-countdown" role="timer" aria-label={closesLabel ? `Closes on ${closesLabel}` : "Time left"}>
      <span className="apply-countdown-label">Closes in</span>
      <ol aria-hidden="true">
        {units.map(([unit, value]) => (
          <li key={unit}><strong>{value === null ? "--" : String(value).padStart(2, "0")}</strong><small>{unit}</small></li>
        ))}
      </ol>
    </div>
  );
}

/** The right side of the banner: closed, open, or a countdown to closing. `noun` is what opens ("Applications"). */
export function PeriodStatus({ period, noun = "Applications" }: { period: BannerPeriod; noun?: string }) {
  if (!period.accepting) return <div className="apply-countdown is-closed">{noun} closed</div>;
  if (period.closesAt === null) return <div className="apply-countdown is-closed is-open"><i aria-hidden="true" /> {noun} open</div>;
  return <Countdown deadline={period.closesAt} closesLabel={period.closesLabel} noun={noun} />;
}

/** Where the Apply form puts its session countdown (use-form-draft.ts), at the strip's right. */
export const SESSION_SLOT = "apply-session-slot";

/**
 * A title strip shared by the commissioner application, tracking page and portal preview, and by
 * Political Party Registration, which passes its own `title` (the gold word in a span).
 */
export function ApplyBanner({ title }: { title?: ReactNode }) {
  const isTracking = usePathname() === "/apply/track" && !title;
  return (
    <header className="apply-top is-commissioner">
      <div className="apply-top-inner">
        <div className="apply-top-title">
          <h1>{title ?? (isTracking ? <>Track <span>submission</span></> : <>Commissioner <span>application</span></>)}</h1>
        </div>
        {!isTracking && <div id={SESSION_SLOT} className="apply-top-session" />}
      </div>
    </header>
  );
}
