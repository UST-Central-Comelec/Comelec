"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { CalendarDays, ChevronDown, ClipboardList, FileText, Flag, Hash, Inbox, LayoutDashboard, Newspaper, Settings2, ShieldCheck, Users, Vote } from "lucide-react";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" }>;
type Tab = { href: string; label: string; icon: Icon };
/** A main tab with subtabs. Clicking it folds the subtabs open or shut (in the icon strip, it opens the first subtab). */
type Group = { label: string; icon: Icon; items: Tab[] };
type Entry = Tab | Group;

const entries: Entry[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/news", label: "News", icon: Newspaper },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/members", label: "Directory", icon: Users },
  {
    label: "Recruitment",
    icon: ClipboardList,
    items: [
      { href: "/portal/recruitment/applications", label: "Applications", icon: Inbox },
      { href: "/portal/recruitment/interviews", label: "Interviews", icon: CalendarDays },
      { href: "/portal/recruitment/slots", label: "Slots", icon: Hash },
      { href: "/portal/recruitment/settings", label: "Settings", icon: Settings2 },
    ],
  },
  {
    label: "PolPaR",
    icon: Flag,
    items: [
      { href: "/portal/polpar/registrations", label: "Registrations", icon: Inbox },
      { href: "/portal/polpar/settings", label: "Settings", icon: Settings2 },
    ],
  },
  {
    label: "Filing of Candidacy",
    icon: Vote,
    items: [
      { href: "/portal/candidacy/filings", label: "Filings", icon: Inbox },
      { href: "/portal/candidacy/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

const executiveEntries: Entry[] = [{ href: "/portal/accounts", label: "Accounts", icon: ShieldCheck }];

const isGroup = (entry: Entry): entry is Group => "items" in entry;

/**
 * The tabs a Local account sees: its college's people, not the commission-wide settings. Groups
 * keep only these subtabs. The pages check this on the server too.
 */
const localTabs = new Set(["/portal/members", "/portal/recruitment/applications", "/portal/polpar/registrations", "/portal/candidacy/filings"]);

function localEntries(list: Entry[]): Entry[] {
  return list.flatMap((entry): Entry[] => {
    if (!isGroup(entry)) return localTabs.has(entry.href) ? [entry] : [];
    const items = entry.items.filter((item) => localTabs.has(item.href));
    return items.length ? [{ ...entry, items }] : [];
  });
}
const isActive = (href: string, pathname: string) => (href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

/**
 * `isExecutive` and `isLocal` only decide what's shown; the pages check the role and affiliation on the server.
 * When `collapsed`, the sidebar is a strip of icons: labels show as tooltips, and a group's
 * subtabs show in a flyout on hover or keyboard focus instead of expanding in place.
 */
export function PortalNav({ isExecutive, isLocal, collapsed }: { isExecutive: boolean; isLocal: boolean; collapsed: boolean }) {
  const pathname = usePathname();
  const shown = isLocal ? localEntries(entries) : isExecutive ? [...entries, ...executiveEntries] : entries;
  const activeGroup = shown.find((entry) => isGroup(entry) && entry.items.some((item) => isActive(item.href, pathname)))?.label ?? null;

  // A group opened or closed by hand stays that way from page to page. Groups you haven't touched
  // follow the page: only the one you're in is open.
  const [locked, setLocked] = useState<Record<string, boolean>>({});

  return (
    <nav className="portal-nav" aria-label="Portal">
      {shown.map((entry) => {
        if (!isGroup(entry)) return <NavLink key={entry.href} tab={entry} active={isActive(entry.href, pathname)} />;

        const { label, icon: GroupIcon, items } = entry;
        const within = activeGroup === label;
        const open = locked[label] ?? within;
        const subId = `portal-nav-${label.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <div key={label} className={`portal-nav-group${open ? " is-open" : ""}${within ? " is-within" : ""}`}>
            <Link
              href={items[0].href}
              className="portal-nav-parent"
              aria-expanded={collapsed ? undefined : open}
              aria-controls={subId}
              onClick={(event) => {
                // In the icon strip it goes to the first subtab; the flyout covers the rest.
                if (collapsed) return;
                event.preventDefault();
                setLocked((current) => ({ ...current, [label]: !open }));
              }}
            >
              <GroupIcon size={17} strokeWidth={1.7} aria-hidden="true" />
              <span className="portal-nav-label">{label}</span>
              <ChevronDown className="portal-nav-chevron" size={15} strokeWidth={1.8} aria-hidden="true" />
            </Link>
            {/* Closed subtabs are inert so Tab skips them; in the icon strip they're a hover/focus flyout instead. */}
            <div className="portal-nav-sub" id={subId} inert={!collapsed && !open}>
              <div className="portal-nav-sub-inner">
                <span className="portal-nav-flyout-title" aria-hidden="true">{label}</span>
                {items.map((item) => <NavLink key={item.href} tab={item} active={isActive(item.href, pathname)} />)}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function NavLink({ tab: { href, label, icon: TabIcon }, active }: { tab: Tab; active: boolean }) {
  return (
    <Link href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
      <TabIcon size={17} strokeWidth={1.7} aria-hidden="true" />
      <span className="portal-nav-label">{label}</span>
    </Link>
  );
}
