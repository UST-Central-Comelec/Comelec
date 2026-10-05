"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SquishTabs } from "@/components/squish-tabs";

const tabs = [
  { href: "/apply", label: "Become a Commissioner" },
  { href: "/apply/track", label: "Track application" },
];

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

/**
 * Black banner across the Apply section: title, the Become a Commissioner / Track application tabs, and the
 * countdown on the commissioner form. Tracking uses its own title without recruitment status.
 * View mode leaves out the tabs, since they lead off the preview.
 */
export function ApplyBanner({ period, tabs: showTabs = true }: { period: BannerPeriod; tabs?: boolean }) {
  const isTracking = usePathname() === "/apply/track";
  return (
    <header className="apply-top">
      <div className="apply-top-inner">
        <div className="apply-top-title">
          <h1>{isTracking ? "Track submission" : "Commissioner application"}</h1>
          {showTabs && <SquishTabs tabs={tabs} label="Application" />}
        </div>
        {!isTracking && <PeriodStatus period={period} />}
      </div>
    </header>
  );
}
