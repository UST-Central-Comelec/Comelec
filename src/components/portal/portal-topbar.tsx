"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye } from "lucide-react";
import { useNow } from "./period-overview";
import { trail } from "./portal-nav";

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

/**
 * The bar across the top of every portal page: where you are and the time.
 * `home` is where "Portal" leads. `viewOnly` says so beside the time, for an Adviser or Admin: it
 * holds on every page, so it's said once here rather than on each.
 */
export function PortalTopbar({ home, viewOnly }: { home: string; viewOnly?: boolean }) {
  const crumbs = trail(usePathname(), viewOnly);

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
        {viewOnly && <span className="portal-topbar-mode" title="Your account reads the portal and changes nothing."><Eye size={13} aria-hidden="true" /> View only</span>}
        <ManilaClock />
      </div>
    </div>
  );
}
