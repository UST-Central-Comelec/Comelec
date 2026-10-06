"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Grip, BookOpenText, Briefcase, Calendar, CalendarCheck, CalendarDays, ChartColumn, ChevronDown, CirclePlus, FolderPlus, MailCheck, Flag, Gavel, Hash, Inbox, LayoutDashboard, ListChecks, Radio, ScanText, ScrollText, Send, Settings2, ShieldCheck, Stamp, Ticket, UserCog, UserRoundPlus, Users, Vote, Wrench, NavSymbol, type PortalIcon as Icon } from "./portal-nav-icons";
import { tabGroups, tabHref, type GroupLabel, type TabKey } from "@/lib/portal/access";
/** `item` is the top bar's word for one of the tab's own pages, such as an application under Applications ("Edit" if not given). */
type Tab = { key: TabKey; href: string; label: string; icon: Icon; item?: string };
/** A main tab with subtabs. Clicking it folds the subtabs open or shut (in the icon strip, it opens the first subtab). */
type Group = { label: string; icon: Icon; items: Tab[] };
type Entry = Tab | Group;
/** A run of tabs, under a small heading if it has a `label`. */
type Section = { label?: string; entries: Entry[] };

// The tabs themselves, their order and their main tabs come from src/lib/portal/access.ts, which
// also decides who may open each. Here they get what the sidebar adds: an icon, and the top bar's
// word for a page inside them.
const tabIcons: Record<TabKey, Icon> = {
  dashboard: LayoutDashboard,
  "apps/inbox": MailCheck,
  "apps/secretariat": Briefcase,
  "apps/email": Send,
  "apps/calendar": Calendar,
  "apps/tickets": Ticket,
  "apps/approvals": Stamp,
  news: Radio,
  statistics: ChartColumn,
  events: CalendarCheck,
  members: Users,
  documents: FolderPlus,
  "codes/constitution": BookOpenText,
  "codes/elections-code": Gavel,
  "petitions/submissions": Inbox,
  "petitions/settings": Settings2,
  "recruitment/applications": Inbox,
  "recruitment/interviews": CalendarDays,
  "recruitment/slots": Hash,
  "recruitment/settings": Settings2,
  "polpar/registrations": Inbox,
  "polpar/requirements": ListChecks,
  "polpar/settings": Settings2,
  "candidacy/filings": Inbox,
  "candidacy/requirements": ListChecks,
  "candidacy/settings": Settings2,
  accounts: UserCog,
  maintenance: Wrench,
  logs: ScrollText,
};

const groupIcons: Record<GroupLabel, Icon> = {
  Apps: Grip,
  Publications: CirclePlus,
  "Petitions & Cases": ScanText,
  Recruitment: UserRoundPlus,
  "Political Party": Flag,
  "Filing of Candidacy": Vote,
  Administrative: ShieldCheck,
};

const tabItems: Partial<Record<TabKey, string>> = { "apps/email": "Email", "apps/approvals": "Review", events: "Details", "codes/constitution": "Revision", "codes/elections-code": "Revision", "recruitment/applications": "Review", accounts: "Manage", maintenance: "Test" };

/** Pages inside a tab that have a name of their own in the top bar. */
const namedPages: Record<string, string> = { "/portal/accounts/access-control": "Access Control", "/portal/accounts/expiration": "Expiration", "/portal/apps/email/outbox": "Outbox", "/portal/apps/email/automatic": "Automatic" };

const isGroup = (entry: Entry): entry is Group => "items" in entry;

// Runs of main tabs under the same heading ("Website") make one section.
const sections = tabGroups.reduce<Array<Section & { key: string | null }>>((list, group) => {
  const items: Tab[] = group.tabs.map((tab) => ({ key: tab.key, href: tabHref(tab.key), label: tab.label, icon: tabIcons[tab.key], item: tabItems[tab.key] }));
  const entries: Entry[] = group.label ? [{ label: group.label, icon: groupIcons[group.label], items }] : items;
  const last = list.at(-1);
  if (last && group.section && last.key === group.section) last.entries.push(...entries);
  else list.push({ key: group.section, label: group.section ?? undefined, entries });
  return list;
}, []);

/**
 * The tabs open to this account. Main tabs keep only their open subtabs, and sections left with
 * nothing are dropped. The pages check this on the server too.
 */
function openSections(open: readonly TabKey[]): Section[] {
  return sections.flatMap((section): Section[] => {
    const entries = section.entries.flatMap((entry): Entry[] => {
      if (!isGroup(entry)) return open.includes(entry.key) ? [entry] : [];
      const items = entry.items.filter((item) => open.includes(item.key));
      return items.length ? [{ ...entry, items }] : [];
    });
    return entries.length ? [{ ...section, entries }] : [];
  });
}
const isActive = (href: string, pathname: string) => (href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

export type Crumb = { label: string; href?: string };

/**
 * Where `pathname` sits in the portal, for the top bar: its group, its tab, then "New" or the tab's
 * word for one of its own pages (or "Edit", for a page that has its own edit page; "View" for an
 * Adviser or Admin, who only reads). The last crumb is the page itself, so it has no link.
 */
export function trail(pathname: string, viewOnly = false): Crumb[] {
  if (pathname === "/portal/privacy") return [{ label: "Privacy statement" }];
  if (pathname === "/portal/notifications") return [{ label: "Notifications" }];
  if (pathname === "/portal/account") return [{ label: "My account" }];
  for (const entry of sections.flatMap((section) => section.entries)) {
    for (const tab of isGroup(entry) ? entry.items : [entry]) {
      if (!isActive(tab.href, pathname)) continue;
      const within = pathname !== tab.href;
      const eventSection = tab.key === "events" ? pathname.match(/^\/portal\/events\/([^/]+)\/(registrants|analytics)$/) : null;
      if (eventSection) return [
        ...(isGroup(entry) ? [{ label: entry.label }] : []),
        { label: tab.label, href: tab.href },
        { label: "Details", href: `/portal/events/${eventSection[1]}` },
        { label: eventSection[2] === "registrants" ? "Registrants" : "Analytics" },
      ];
      return [
        ...(isGroup(entry) ? [{ label: entry.label }] : []),
        within ? { label: tab.label, href: tab.href } : { label: tab.label },
        ...(within ? [{ label: namedPages[pathname] ?? (pathname.endsWith("/new") ? "New" : viewOnly && tab.key !== "events" ? "View" : pathname.endsWith("/edit") ? "Edit" : (tab.item ?? "Edit")) }] : []),
      ];
    }
  }
  return [];
}

/**
 * `tabs` (the ones open to this account) only decides what's shown; the pages check access on the server.
 * When `collapsed`, the sidebar is a strip of icons: labels show as tooltips, and a group's
 * subtabs show in a flyout on hover or keyboard focus instead of expanding in place.
 */
export function PortalNav({ tabs, collapsed }: { tabs: readonly TabKey[]; collapsed: boolean }) {
  const pathname = usePathname();
  const shown = openSections(tabs);
  const activeGroup = shown.flatMap((section) => section.entries).find((entry) => isGroup(entry) && entry.items.some((item) => isActive(item.href, pathname)))?.label ?? null;

  // One expanded group at a time. Navigation opens the destination's group, including Back/Forward.
  const [expanded, setExpanded] = useState<{ pathname: string; group: string | null }>({ pathname, group: activeGroup });
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  if (expanded.pathname !== pathname) {
    setExpanded({ pathname, group: activeGroup });
  }

  return (
    <LayoutGroup id="portal-sidebar">
      <motion.nav layoutScroll className="portal-nav" aria-label="Portal">
        {shown.map((section, index) => (
          <Fragment key={index}>
            {section.label && <span className="portal-nav-section">{section.label}</span>}
            {section.entries.map((entry) => {
              if (!isGroup(entry)) return <NavLink key={entry.href} tab={entry} active={isActive(entry.href, pathname)} />;
  
              const { label, icon, items } = entry;
              const within = activeGroup === label;
              const open = expanded.group === label;
              const subId = `portal-nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
              return (
                <div key={label} className={`portal-nav-group${open ? " is-open" : ""}${within ? " is-within" : ""}`}>
                  <Link
                    href={items[0].href}
                    className={`portal-nav-parent${within ? " is-current-group" : ""}`}
                    onMouseEnter={() => setHoveredGroup(label)}
                    onMouseLeave={() => setHoveredGroup(null)}
                    onFocus={() => setFocusedGroup(label)}
                    onBlur={() => setFocusedGroup(null)}
                    aria-expanded={collapsed ? undefined : open}
                    aria-controls={subId}
                    onClick={(event) => {
                      // In the icon strip it goes to the first subtab; the flyout covers the rest.
                      if (collapsed) return;
                      event.preventDefault();
                      setExpanded({ pathname, group: open ? null : label });
                    }}
                  >
                    {within && <NavHighlight />}
                    <NavSymbol icon={icon} active={within} engaged={hoveredGroup === label || focusedGroup === label} />
                    <span className="portal-nav-label">{label}</span>
                    <ChevronDown className="portal-nav-chevron" size={15} strokeWidth={1.8} aria-hidden="true" />
                  </Link>
                  {/* Closed subtabs are inert so Tab skips them; in the icon strip they're a hover/focus flyout instead. */}
                  <div className="portal-nav-sub" id={subId} inert={!collapsed && !open}>
                    <div className="portal-nav-sub-inner">
                      <span className="portal-nav-flyout-title" aria-hidden="true">{label}</span>
                      {items.map((item) => <NavLink key={item.href} tab={item} active={isActive(item.href, pathname)} subtab />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </motion.nav>
    </LayoutGroup>
  );
}

function NavHighlight({ subtab = false }: { subtab?: boolean }) {
  const reducedMotion = useReducedMotion();
  return <motion.span layoutId={subtab ? "active-subtab" : "active-tab"} className={`portal-nav-highlight${subtab ? " is-subtab" : ""}`} initial={false} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34 }} aria-hidden="true" />;
}

function NavLink({ tab: { href, label, icon }, active, subtab = false }: { tab: Tab; active: boolean; subtab?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Link href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {active && <NavHighlight subtab={subtab} />}
      <NavSymbol icon={icon} active={active} engaged={hovered || focused} />
      <span className="portal-nav-label">{label}</span>
    </Link>
  );
}
