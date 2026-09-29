"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SquishTabs } from "@/components/squish-tabs";

const tabs = [
  { href: "/apply", label: "Apply now" },
  { href: "/apply/track", label: "Track application" },
];

/** What the banner shows about the application period; set in the portal (Recruitment → Settings). */
export type BannerPeriod = { accepting: boolean; closesAt: number | null; closesLabel: string | null };

/** Days, hours, minutes and seconds left until `deadline`, ticking every second. Blank until mounted so server and client markup match. */
function Countdown({ deadline, closesLabel }: { deadline: number; closesLabel: string | null }) {
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
  if (ended) return <div className="apply-countdown is-closed">Applications closed</div>;

  const seconds = left === null ? null : Math.floor(left / 1000);
  const units: Array<[string, number | null]> = [
    ["days", seconds === null ? null : Math.floor(seconds / 86400)],
    ["hrs", seconds === null ? null : Math.floor(seconds / 3600) % 24],
    ["min", seconds === null ? null : Math.floor(seconds / 60) % 60],
    ["sec", seconds === null ? null : seconds % 60],
  ];
  return (
    <div className="apply-countdown" role="timer" aria-label={closesLabel ? `Applications close on ${closesLabel}` : "Time left to apply"}>
      <span className="apply-countdown-label">Closes in</span>
      <ol aria-hidden="true">
        {units.map(([unit, value]) => (
          <li key={unit}><strong>{value === null ? "--" : String(value).padStart(2, "0")}</strong><small>{unit}</small></li>
        ))}
      </ol>
    </div>
  );
}

function PeriodStatus({ period }: { period: BannerPeriod }) {
  if (!period.accepting) return <div className="apply-countdown is-closed">Applications closed</div>;
  if (period.closesAt === null) return <div className="apply-countdown is-closed is-open"><i aria-hidden="true" /> Applications open</div>;
  return <Countdown deadline={period.closesAt} closesLabel={period.closesLabel} />;
}

/**
 * Black banner across the Apply section: title, the Apply now / Track application tabs, and the
 * countdown. View mode leaves out the tabs, since they lead off the preview.
 */
export function ApplyBanner({ period, tabs: showTabs = true }: { period: BannerPeriod; tabs?: boolean }) {
  return (
    <header className="apply-top">
      <div className="apply-top-inner">
        <div className="apply-top-title">
          <h1>Commissioner application</h1>
          {showTabs && <SquishTabs tabs={tabs} label="Application" />}
        </div>
        <PeriodStatus period={period} />
      </div>
    </header>
  );
}
