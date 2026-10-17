"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, DoorOpen, Ellipsis, House } from "lucide-react";
import { FileText, FolderOpen, LayoutDashboard, MailCheck, NavSymbol, Users, type PortalIcon } from "@/components/portal/portal-nav-icons";
import { ThemeToggle } from "@/components/portal/portal-theme";
import { signOutOfFiling } from "@/lib/filing-portal/actions";
import { FILING_SIDEBAR_COOKIE } from "@/lib/filing-portal/types";

// The filing portal's frame, in the commission portal's look (portal.css): a sidebar that shrinks
// to icons and becomes the header on a phone, and the bar across the top of each page. The sidebar
// shows the account's applications: its party's (once a member) and its candidacy (once filed).

/** Opening Notifications marks them read; this tells the sidebar, so its count goes without a reload. */
export const NOTICES_READ_EVENT = "filing-notices-read";

type NavTab = { href: string; label: string; icon: PortalIcon };

const isActive = (href: string, pathname: string) => (href === "/filing" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`) && !(href === "/filing/party" && pathname.startsWith("/filing/party/members")));

export type SidebarAccount = { name: string; email: string; role: string; summary: string; party: boolean; candidacy: boolean };

function NavLink({ tab, active, count = 0 }: { tab: NavTab; active: boolean; count?: number }) {
  const [engaged, setEngaged] = useState(false);
  return (
    <Link href={tab.href} title={tab.label} className={`portal-nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} aria-label={count > 0 ? `${tab.label}, ${count} unread` : undefined}
      onMouseEnter={() => setEngaged(true)} onMouseLeave={() => setEngaged(false)} onFocus={() => setEngaged(true)} onBlur={() => setEngaged(false)}>
      {active && <span className="portal-nav-highlight" aria-hidden="true" />}
      <NavSymbol icon={tab.icon} active={active} engaged={engaged} />
      <span className="portal-nav-label">{tab.label}</span>
      {count > 0 && <span className="portal-nav-unread" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

/** The profile menu at the sidebar's foot: who's signed in, the theme, the website, and Log out. */
function ProfileMenu({ account }: { account: SidebarAccount }) {
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});

  const place = () => {
    if (!trigger.current || panel.current?.matches(":popover-open")) return;
    const box = trigger.current.getBoundingClientRect();
    const gap = 10;
    const width = Math.min(320, window.innerWidth - gap * 2);
    const above = box.top - gap * 2;
    const below = window.innerHeight - box.bottom - gap * 2;
    const upwards = above >= below;
    setPosition({ width, left: Math.max(gap, Math.min(box.left, window.innerWidth - width - gap)), maxHeight: Math.max(100, upwards ? above : below), ...(upwards ? { bottom: window.innerHeight - box.top + gap } : { top: box.bottom + gap }) });
  };

  return (
    <>
      <button ref={trigger} className="portal-account portal-profile-trigger" type="button" popoverTarget="filing-profile-menu" onClick={place} aria-haspopup="dialog" aria-expanded={open} aria-controls="filing-profile-menu" title="Open profile menu">
        <span className="portal-account-link">
          <span className="portal-account-initial" aria-hidden="true">{account.name.trim().charAt(0).toUpperCase() || "?"}</span>
          <span className="portal-account-text"><strong>{account.name}</strong><small>{account.role}</small></span>
        </span>
        <span className="portal-profile-more" aria-hidden="true"><Ellipsis size={17} /></span>
      </button>
      <div ref={panel} id="filing-profile-menu" popover="auto" role="dialog" aria-label="Profile menu" className="portal-profile-menu" style={position} onToggle={(event) => setOpen(event.newState === "open")}>
        <div className="portal-profile-header">
          <div><strong>{account.name}</strong><span>{account.email}</span>{account.summary && <small>{account.summary}</small>}</div>
        </div>
        <div className="portal-profile-actions">
          <div className="portal-profile-theme"><span>Theme</span><ThemeToggle /></div>
          <a href="/" target="_blank" rel="noreferrer" onClick={() => panel.current?.hidePopover()}><span>Website</span><House size={17} aria-hidden="true" /></a>
          <form action={signOutOfFiling}><button type="submit"><span>Log out</span><DoorOpen size={17} aria-hidden="true" /></button></form>
        </div>
      </div>
    </>
  );
}

export function FilingSidebar({ account, unread, initialCollapsed }: { account: SidebarAccount; unread: number; initialCollapsed: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Read on the Notifications page: the count goes now, and stays gone until there's something new.
  const [readAt, setReadAt] = useState<number | null>(null);
  const [unreadAt, setUnreadAt] = useState(unread);
  if (unread !== unreadAt) { setUnreadAt(unread); setReadAt(null); }
  useEffect(() => {
    const read = () => setReadAt(Date.now());
    window.addEventListener(NOTICES_READ_EVENT, read);
    return () => window.removeEventListener(NOTICES_READ_EVENT, read);
  }, []);
  const count = readAt === null ? unread : 0;
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${FILING_SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/filing; max-age=31536000; samesite=lax`;
  };
  const tabs: NavTab[] = [
    { href: "/filing", label: "Dashboard", icon: LayoutDashboard },
    ...(account.party ? [{ href: "/filing/party", label: "Party documents", icon: FolderOpen }, { href: "/filing/party/members", label: "Party members", icon: Users }] : []),
    ...(account.candidacy ? [{ href: "/filing/candidacy", label: "My candidacy", icon: FileText }] : []),
    { href: "/filing/notifications", label: "Notifications", icon: MailCheck },
  ];

  return (
    <aside className={`portal-sidebar${collapsed ? " is-collapsed" : ""}`}>
      <div className="portal-sidebar-edge" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-hidden="true" />
      <div className="portal-sidebar-head">
        <Link href="/filing" className="portal-brand" aria-label={collapsed ? "Filing portal — home" : undefined}>
          <Image src="/images/Logo-1.png" alt="" width={36} height={36} priority />
          <span><strong>Filing portal</strong><small>UST Central Comelec</small></span>
        </Link>
        <button className="portal-sidebar-toggle" type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={14} strokeWidth={2.2} /> : <ChevronLeft size={14} strokeWidth={2.2} />}
        </button>
      </div>
      <nav className="portal-nav" aria-label="Filing portal">
        <div className="portal-nav-scroll">
          <div className="portal-nav-panel">
            {tabs.map((tab) => <NavLink key={tab.href} tab={tab} active={isActive(tab.href, pathname)} count={tab.href === "/filing/notifications" ? count : 0} />)}
          </div>
        </div>
      </nav>
      <div className="portal-sidebar-foot">
        <ProfileMenu account={account} />
      </div>
    </aside>
  );
}

const pageNames: Record<string, string[]> = {
  "/filing/party": ["Party documents"],
  "/filing/party/members": ["Party members"],
  "/filing/candidacy": ["My candidacy"],
  "/filing/notifications": ["Notifications"],
};

/** The bar across the top of each page: where you are, and the theme switch. */
export function FilingTopbar() {
  const pathname = usePathname();
  const page = pageNames[pathname];
  return (
    <div className="portal-topbar">
      <nav aria-label="Breadcrumb">
        <ol className="portal-crumbs">
          <li>{page ? <Link href="/filing">Filing portal</Link> : <span aria-current="page">Filing portal</span>}</li>
          {page?.map((label) => <li key={label}><span aria-current="page">{label}</span></li>)}
        </ol>
      </nav>
      <div className="portal-topbar-tools"><ThemeToggle /></div>
    </div>
  );
}
