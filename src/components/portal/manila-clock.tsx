"use client";

import { useNow } from "./period-overview";

const zone = "Asia/Manila";
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/**
 * The date and time in Manila, ticking: every closing time in the portal is set in Manila time.
 * Dashes until mounted, so server and browser markup match. Hidden from screen readers, which
 * would otherwise announce each second.
 */
export function ManilaClock() {
  const now = useNow();
  return (
    <span className="portal-clock" aria-hidden="true">
      <span>{now === null ? "--- --- --" : dayFormat.format(now)}</span>
      <i />
      <b>{now === null ? "--:--:--" : timeFormat.format(now)}</b>
      <span>PHT</span>
    </span>
  );
}

