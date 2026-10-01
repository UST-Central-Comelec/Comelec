"use client";

import { useEffect, useState } from "react";

/**
 * "28d 04h 06m 09s" to `deadline`, ticking every second, for the hero's recruitment call. Dashes
 * until mounted, so server and client markup match. Hidden from screen readers: the link around it
 * says when applications close.
 */
export function TimeLeft({ deadline, className }: { deadline: number; className?: string }) {
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

  const seconds = now === null ? null : Math.max(0, Math.floor((deadline - now) / 1000));
  const units: Array<[string, number | null]> = [
    ["d", seconds === null ? null : Math.floor(seconds / 86400)],
    ["h", seconds === null ? null : Math.floor(seconds / 3600) % 24],
    ["m", seconds === null ? null : Math.floor(seconds / 60) % 60],
    ["s", seconds === null ? null : seconds % 60],
  ];

  return (
    <span className={className} aria-hidden="true">
      {units.map(([unit, value]) => (
        <span key={unit}>{value === null ? "--" : String(value).padStart(2, "0")}<small>{unit}</small></span>
      ))}
    </span>
  );
}
