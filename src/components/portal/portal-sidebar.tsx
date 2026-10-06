"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { homeOf, type TabKey } from "@/lib/portal/access";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";
import { PortalNav } from "./portal-nav";
import { ProfileMenu, type PortalMembership } from "./profile-menu";
import { NotificationBell } from "./notification-bell";

/** `role` is the line under their name; `tabs` are the tabs open to them. */
type SidebarUser = { id: string; name: string; role: string; email: string; avatarUrl: string | null; tabs: readonly TabKey[] };

/**
 * The portal's sidebar. It can shrink to a thin strip of icons; that choice is kept in a
 * cookie so the server renders the same width on the next visit (no jump while the page loads).
 */
export function PortalSidebar({ user, memberships, initialCollapsed }: { user: SidebarUser; memberships: PortalMembership[]; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/portal; max-age=31536000; samesite=lax`;
  };

  return (
    <aside className={`portal-sidebar${collapsed ? " is-collapsed" : ""}`}>
      {/* The right border also toggles on click. Mouse only; the button below covers the keyboard. */}
      <div className="portal-sidebar-edge" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-hidden="true" />
      <div className="portal-sidebar-head">
        <Link href={homeOf(user.tabs)} className="portal-brand" aria-label={collapsed ? "Mission control — home" : undefined}>
          <Image src="/images/Logo-1.png" alt="" width={36} height={36} priority />
          <span><strong>Mission control</strong><small>UST Central Comelec</small></span>
        </Link>
        <button className="portal-sidebar-toggle" type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={14} strokeWidth={2.2} /> : <ChevronLeft size={14} strokeWidth={2.2} />}
        </button>
      </div>
      <PortalNav tabs={user.tabs} collapsed={collapsed} />
      <div className="portal-sidebar-foot">
        <div className="portal-mobile-notifications"><NotificationBell mobile /></div>
        <ProfileMenu user={user} memberships={memberships} />
      </div>
    </aside>
  );
}
