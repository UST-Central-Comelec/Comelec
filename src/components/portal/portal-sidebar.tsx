"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { logout } from "@/lib/portal/auth-actions";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";
import { PortalNav } from "./portal-nav";
import { ThemeToggle } from "./portal-theme";

/** A Local account's home tab (LOCAL_HOME in src/lib/auth/session.ts, which is server-only). */
const LOCAL_HOME = "/portal/members";

type SidebarUser = { name: string; role: string; email: string; avatarUrl: string | null; isExecutive: boolean; isLocal: boolean };

/**
 * The portal's sidebar. It can shrink to a thin strip of icons; that choice is kept in a
 * cookie so the server renders the same width on the next visit (no jump while the page loads).
 */
export function PortalSidebar({ user, initialCollapsed }: { user: SidebarUser; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Falls back to the initial if Google's picture doesn't load.
  const [avatarFailed, setAvatarFailed] = useState(false);

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
        <Link href={user.isLocal ? LOCAL_HOME : "/portal"} className="portal-brand" aria-label={collapsed ? `Mission control — ${user.isLocal ? "Directory" : "Dashboard"}` : undefined}>
          <Image src="/images/Logo-1.png" alt="" width={36} height={36} priority />
          <span><strong>Mission control</strong><small>UST Central Comelec</small></span>
        </Link>
        <button className="portal-sidebar-toggle" type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={14} strokeWidth={2.2} /> : <ChevronLeft size={14} strokeWidth={2.2} />}
        </button>
      </div>
      <PortalNav isExecutive={user.isExecutive} isLocal={user.isLocal} collapsed={collapsed} />
      <div className="portal-sidebar-foot">
        <a className="portal-site-link" href="/" target="_blank" rel="noreferrer" title={collapsed ? "View website" : undefined}>
          <span className="portal-site-link-text">View website</span> <ArrowUpRight size={14} aria-hidden="true" />
        </a>
        {/* Shown only on a phone, where this row is the header and the top bar is hidden. */}
        <ThemeToggle />
        <div className="portal-account">
          <Link href="/portal/account" className="portal-account-link" title="My account">
            {user.avatarUrl && !avatarFailed ? (
              // A plain <img>: Google serves these already sized, and they only load without a referrer.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="portal-account-initial" src={user.avatarUrl} alt="" width={34} height={34} referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
            ) : (
              <span className="portal-account-initial" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || "?"}</span>
            )}
            <span className="portal-account-text">
              <strong>{user.name}</strong>
              <small>{user.role} · {user.email}</small>
            </span>
          </Link>
          <form action={logout}>
            <button className="portal-icon-button" type="submit" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </form>
        </div>
      </div>
    </aside>
  );
}
