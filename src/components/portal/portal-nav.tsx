"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { CalendarDays, ChevronDown, ClipboardList, FileText, Hash, Inbox, LayoutDashboard, Newspaper, Settings2, ShieldCheck, Users } from "lucide-react";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" }>;
type Tab = { href: string; label: string; icon: Icon };
/** A main tab with subtabs. Clicking it opens the first subtab. */
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
];

const executiveEntries: Entry[] = [{ href: "/portal/accounts", label: "Accounts", icon: ShieldCheck }];

const isGroup = (entry: Entry): entry is Group => "items" in entry;
const isActive = (href: string, pathname: string) => (href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

/**
 * `isExecutive` only decides what's shown; the account pages check the role on the server.
 * When `collapsed`, the sidebar is a strip of icons: labels show as tooltips, and a group's
 * subtabs show in a flyout on hover or keyboard focus instead of expanding in place.
 */
export function PortalNav({ isExecutive, collapsed }: { isExecutive: boolean; collapsed: boolean }) {
  const pathname = usePathname();
  const shown = isExecutive ? [...entries, ...executiveEntries] : entries;
  const activeGroup = shown.find((entry) => isGroup(entry) && entry.items.some((item) => isActive(item.href, pathname)))?.label ?? null;

  // The group you're in starts open; moving to another page resets it to that page's group.
  const [openGroup, setOpenGroup] = useState(activeGroup);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpenGroup(activeGroup);
  }

  return (
    <nav className="portal-nav" aria-label="Portal">
      {shown.map((entry) => {
        if (!isGroup(entry)) return <NavLink key={entry.href} tab={entry} active={isActive(entry.href, pathname)} />;

        const { label, icon: GroupIcon, items } = entry;
        const within = activeGroup === label;
        const open = openGroup === label;
        const subId = `portal-nav-${label.toLowerCase()}`;
        return (
          <div key={label} className={`portal-nav-group${open ? " is-open" : ""}${within ? " is-within" : ""}`}>
            <Link
              href={items[0].href}
              className="portal-nav-parent"
              aria-expanded={collapsed ? undefined : open}
              aria-controls={subId}
              onClick={(event) => {
                if (collapsed) return;
                // Already on one of its pages: just fold or unfold the subtabs.
                if (within) {
                  event.preventDefault();
                  setOpenGroup(open ? null : label);
                } else {
                  setOpenGroup(label);
                }
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
