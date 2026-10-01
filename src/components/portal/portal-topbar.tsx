"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNow } from "./period-overview";
import { trail } from "./portal-nav";
import { ThemeToggle } from "./portal-theme";

const zone = "Asia/Manila";
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/**
 * The date and time in Manila, ticking: every closing time in the portal is set in Manila time.
 * Dashes until mounted, so server and browser markup match. Hidden from screen readers, which
 * would otherwise announce each second.
 */
function ManilaClock() {
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

/** The bar across the top of every portal page: where you are, the time, and the theme switch. `home` is where "Portal" leads. */
export function PortalTopbar({ home }: { home: string }) {
  const crumbs = trail(usePathname());

  return (
    <div className="portal-topbar">
      <nav aria-label="Breadcrumb">
        <ol className="portal-crumbs">
          <li><Link href={home}>Portal</Link></li>
          {crumbs.map((crumb, index) => (
            <li key={crumb.label}>
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="portal-topbar-tools">
        <ManilaClock />
        <ThemeToggle />
      </div>
    </div>
  );
}
