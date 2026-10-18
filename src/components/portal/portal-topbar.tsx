"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewIcon as Eye } from "@/components/action-icons";
import { ManilaClock } from "./manila-clock";
import { trail } from "./portal-nav";
import { NotificationBell } from "./notification-bell";
import { OnlinePill } from "./online-pill";

/**
 * The bar across the top of every portal page: where you are, who's online, and the time.
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
        <OnlinePill />
        <NotificationBell />
        {viewOnly && <span className="portal-topbar-mode" title="Your account reads the portal and changes nothing."><Eye size={13} aria-hidden="true" /> View only</span>}
        <ManilaClock />
      </div>
    </div>
  );
}
