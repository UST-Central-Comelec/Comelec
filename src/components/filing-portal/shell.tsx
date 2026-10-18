"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, DoorOpen, Ellipsis, House } from "lucide-react";
import { BookOpenText, Calendar, CalendarCheck, CalendarDays, FileCheck2, FileText, Flag, FolderOpen, FolderPlus, GalleryHorizontalEnd, Gavel, Grip, LayoutDashboard, NavSymbol, Radio, ScanText, ShieldCheck, Stamp, Ticket, UserRoundPlus, Users, type PortalIcon } from "@/components/portal/portal-nav-icons";
import { ManilaClock } from "@/components/portal/manila-clock";
import { NotificationBell } from "@/components/portal/notification-bell";
import { ThemeToggle } from "@/components/portal/portal-theme";
import { signOutOfFiling } from "@/lib/filing-portal/actions";
import { FILING_SIDEBAR_COOKIE } from "@/lib/filing-portal/types";
import { partyRequirementGroups } from "@/lib/party-portal/types";

// The filing portal's frame, in the commission portal's look (portal.css): a sidebar that shrinks
// to icons and becomes the header on a phone, and the bar across the top of each page. In order:
// Dashboard, Announcements, Calendar, then Services, Charters, Candidacy and Political Party. Like
// the commission portal's, those four are main tabs with a chevron: each opens its own panel of
// subtabs in the sidebar, with "All tabs" to go back.

/** Opening Announcements marks them read; this tells the sidebar, so its count goes without a reload. */
export const NOTICES_READ_EVENT = "filing-notices-read";

type NavTab = { href: string; label: string; icon: PortalIcon };
type NavGroup = { label: string; icon: PortalIcon; base: string; items: NavTab[] };

const isActive = (href: string, pathname: string) => (href === "/filing" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

export type SidebarAccount = { name: string; email: string; role: string; summary: string; party: boolean; candidacy: boolean; /** Asked to join a party, waiting for its contact person. */ requested: boolean };

/** The main tabs with subtabs, in the sidebar's order. Candidacy's and Political Party's depend on what the account has filed. */
function navGroups(account: SidebarAccount): NavGroup[] {
  return [
    {
      label: "Services", icon: Grip, base: "/filing/services",
      items: [
        { href: "/filing/services/consultation", label: "Book a consultation", icon: CalendarCheck },
        { href: "/filing/services/commissioner", label: "Request a commissioner", icon: Ticket },
        { href: "/filing/services/petition", label: "File a petition", icon: Stamp },
      ],
    },
    {
      label: "Charters", icon: BookOpenText, base: "/filing/charters",
      items: [
        { href: "/filing/charters/constitution", label: "Constitution", icon: BookOpenText },
        { href: "/filing/charters/elections-code", label: "Elections Code", icon: Gavel },
      ],
    },
    {
      label: "Candidacy", icon: FileText, base: "/filing/candidacy",
      items: account.candidacy
        ? [
          { href: "/filing/candidacy", label: "Candidate profile", icon: FileCheck2 },
          { href: "/filing/candidacy/documents", label: "Upload documents", icon: FolderOpen },
          { href: "/filing/candidacy/materials", label: "Campaign materials", icon: GalleryHorizontalEnd },
          { href: "/filing/candidacy/schedule", label: "Campaign schedule", icon: CalendarDays },
        ]
        : [{ href: "/filing/candidacy", label: "File a candidacy", icon: FolderPlus }],
    },
    {
      label: "Political Party", icon: Flag, base: "/filing/party",
      items: account.party
        ? [
          { href: "/filing/party", label: "Party information", icon: ShieldCheck },
          ...partyRequirementGroups.map((group) => ({ href: `/filing/party/documents/${group.key}`, label: group.label, icon: group.key === "forms" ? FileText : group.key === "ids" ? ScanText : BookOpenText })),
          { href: "/filing/party/members", label: "Members", icon: Users },
        ]
        : [{ href: "/filing/party", label: account.requested ? "Your request to join" : "Join or register a party", icon: UserRoundPlus }],
    },
  ];
}

function NavLink({ tab, active, count = 0, subtab = false }: { tab: NavTab; active: boolean; count?: number; subtab?: boolean }) {
  const [engaged, setEngaged] = useState(false);
  return (
    <Link href={tab.href} title={tab.label} className={`portal-nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} aria-label={count > 0 ? `${tab.label}, ${count} unread` : undefined}
      onMouseEnter={() => setEngaged(true)} onMouseLeave={() => setEngaged(false)} onFocus={() => setEngaged(true)} onBlur={() => setEngaged(false)}>
      {active && <span className={`portal-nav-highlight${subtab ? " is-subtab" : ""}`} aria-hidden="true" />}
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
  // Read on the Announcements page: the count goes now, and stays gone until there's something new.
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
  const groups = navGroups(account);
  // The open panel follows the page: a page under one of the main tabs opens its subtabs.
  const pageGroup = groups.find((group) => isActive(group.base, pathname))?.label ?? null;
  const [panel, setPanel] = useState<{ pathname: string; group: string | null }>({ pathname, group: pageGroup });
  const current = panel.pathname === pathname ? panel.group : pageGroup;
  if (panel.pathname !== pathname) setPanel({ pathname, group: pageGroup });
  const selected = groups.find((group) => group.label === current) ?? null;
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const reducedMotion = useReducedMotion();
  const openPanel = (group: string | null) => {
    setPanel({ pathname, group });
    requestAnimationFrame(() => panelRef.current?.focus());
  };
  const subtabActive = (href: string) => pathname === href;

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
          <motion.div key={selected?.label ?? "root"} ref={panelRef} id={`${id}-panel`} className="portal-nav-panel" tabIndex={-1} role="group" aria-label={selected?.label ?? "All tabs"} initial={reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .16 }}>
            {selected ? (
              <>
                <button type="button" className="portal-nav-back" aria-label="Back to all tabs" title={collapsed ? "Back to all tabs" : undefined} onClick={() => openPanel(null)}><ChevronLeft size={17} aria-hidden="true" /><span className="portal-nav-label">All tabs</span></button>
                <span className="portal-nav-section portal-nav-panel-title">{selected.label}</span>
                {selected.items.map((tab) => <NavLink key={tab.href} tab={tab} subtab active={subtabActive(tab.href)} />)}
              </>
            ) : (
              <>
                <NavLink tab={{ href: "/filing", label: "Dashboard", icon: LayoutDashboard }} active={pathname === "/filing"} />
                <NavLink tab={{ href: "/filing/announcements", label: "Announcements", icon: Radio }} active={isActive("/filing/announcements", pathname)} count={count} />
                <NavLink tab={{ href: "/filing/calendar", label: "Calendar", icon: Calendar }} active={isActive("/filing/calendar", pathname)} />
                {groups.map((group) => {
                  const active = group.label === pageGroup;
                  return (
                    <button key={group.label} type="button" className={`portal-nav-parent${active ? " is-current-group" : ""}`} aria-label={`Open ${group.label} tabs`} aria-controls={`${id}-panel`} title={collapsed ? group.label : undefined} onClick={() => openPanel(group.label)}>
                      {active && <span className="portal-nav-highlight" aria-hidden="true" />}
                      <NavSymbol icon={group.icon} active={active} />
                      <span className="portal-nav-label">{group.label}</span>
                      <ChevronRight className="portal-nav-chevron" size={15} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  );
                })}
              </>
            )}
          </motion.div>
        </div>
      </nav>
      <div className="portal-sidebar-foot">
        <div className="portal-mobile-notifications"><NotificationBell filing mobile /></div>
        <ProfileMenu account={account} />
      </div>
    </aside>
  );
}

const pageNames: Record<string, string[]> = {
  "/filing/announcements": ["Announcements"],
  "/filing/calendar": ["Calendar"],
  "/filing/services/consultation": ["Services", "Book a consultation"],
  "/filing/services/commissioner": ["Services", "Request a commissioner"],
  "/filing/services/petition": ["Services", "File a petition"],
  "/filing/charters/constitution": ["Charters", "Constitution"],
  "/filing/charters/elections-code": ["Charters", "Elections Code"],
  "/filing/party": ["Political Party"],
  "/filing/party/members": ["Political Party", "Members"],
  ...Object.fromEntries(partyRequirementGroups.map((group) => [`/filing/party/documents/${group.key}`, ["Political Party", group.label]])),
  "/filing/candidacy": ["Candidacy", "Candidate profile"],
  "/filing/candidacy/documents": ["Candidacy", "Upload documents"],
  "/filing/candidacy/materials": ["Candidacy", "Campaign materials"],
  "/filing/candidacy/schedule": ["Candidacy", "Campaign schedule"],
};

/** The commission portal’s header contents, with the filing portal's announcements and no online indicator. */
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
      <div className="portal-topbar-tools"><NotificationBell filing /><ManilaClock /></div>
    </div>
  );
}
