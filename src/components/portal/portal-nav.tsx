"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useId, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SearchIcon as Search, CloseIcon as X } from "@/components/action-icons";
import { Settings2, NavSymbol, type PortalIcon as Icon } from "./portal-nav-icons";
import { groupIcons, tabIcons } from "./portal-tab-icons";
import { navigationTabKeys, tabGroups, tabHref, type TabKey } from "@/lib/portal/access";
import type { AttentionCounts } from "@/lib/portal/attention-types";
import { directoryReturnHref } from "@/lib/portal/directory-return";
import { fromLettersTracker, LETTERS_TRACKER_HREF } from "@/lib/portal/letters-return";
import { fromSecretariatSettings, SECRETARIAT_OFFICES_HREF } from "@/lib/portal/secretariat-return";
/** `item` is the top bar's word for one of the tab's own pages, such as an application under Applications ("Edit" if not given). */
type Tab = { key: TabKey | "access-control"; href: string; label: string; icon: Icon; item?: string };
/** A main tab opens its own sidebar panel. */
type Group = { label: string; icon: Icon; items: Entry[] };
type Entry = Tab | Group;
/** A run of tabs, under a small heading if it has a `label`. */
type Section = { label?: string; entries: Entry[] };

// The tabs themselves, their order and their main tabs come from src/lib/portal/access.ts, which
// also decides who may open each. Here they get what the sidebar adds: an icon, and the top bar's
// word for a page inside them.

const tabItems: Partial<Record<TabKey, string>> = { "apps/email": "Email", "documents/approval": "Review", events: "Details", "charters/constitution": "Revision", "charters/elections-code": "Revision", "charters/magna-carta": "Revision", "recruitment/applications": "Review", "polpar/registrations": "Review", "candidacy/filings": "Review", accounts: "Manage", maintenance: "Test" };

/** Pages inside a tab that have a name of their own in the top bar. */
const namedPages: Record<string, string> = { "/portal/accounts/access-control": "Access Control", "/portal/accounts/expiration": "Expiration", "/portal/apps/email/outbox": "Outbox", "/portal/apps/email/automatic": "Automatic" };

const isGroup = (entry: Entry): entry is Group => "items" in entry;

/** Nested groups share the same leaf tabs and permissions as Access Control. */
function tabPaths(entries: Entry[], groups: Group[] = []): Array<{ tab: Tab; groups: Group[] }> {
  return entries.flatMap(entry => isGroup(entry) ? tabPaths(entry.items, [...groups, entry]) : [{ tab: entry, groups }]);
}
function groupPaths(entries: Entry[], parents: Group[] = []): Array<{ group: Group; parents: Group[] }> {
  return entries.flatMap(entry => isGroup(entry) ? [{ group: entry, parents }, ...groupPaths(entry.items, [...parents, entry])] : []);
}

const sections = tabGroups.reduce<Array<Section & { key: string | null }>>((list, group) => {
  const items: Tab[] = group.tabs.flatMap((tab): Tab[] => [
    { key: tab.key, href: tabHref(tab.key), label: tab.label, icon: tabIcons[tab.key], item: tabItems[tab.key] },
    ...(tab.key === "accounts" ? [{ key: "access-control" as const, href: "/portal/accounts/access-control", label: "Access Control", icon: Settings2 }] : []),
  ]);
  let section = list.at(-1);
  if (!section || !group.section || section.key !== group.section) {
    section = { key: group.section, label: group.section ?? undefined, entries: [] };
    list.push(section);
  }
  const entries: Entry[] = group.label ? [{ label: group.label, icon: groupIcons[group.label], items }] : items;
  if ("parent" in group) {
    let parent = section.entries.find((entry): entry is Group => isGroup(entry) && entry.label === group.parent);
    if (!parent) {
      parent = { label: group.parent, icon: groupIcons[group.parent], items: [] };
      section.entries.push(parent);
    }
    parent.items.push(...entries);
  } else section.entries.push(...entries);
  return list;
}, []);

function openSections(open: readonly TabKey[], showAccessControl: boolean): Section[] {
  const filter = (entries: Entry[]): Entry[] => entries.flatMap((entry): Entry[] => {
    if (!isGroup(entry)) return (entry.key === "access-control" ? showAccessControl : navigationTabKeys.includes(entry.key) && open.includes(entry.key)) ? [entry] : [];
    const items = filter(entry.items);
    return items.length ? [{ ...entry, items }] : [];
  });
  return sections.flatMap((section): Section[] => {
    const entries = filter(section.entries);
    return entries.length ? [{ ...section, entries }] : [];
  });
}
const isActive = (href: string, pathname: string) => {
  if (href === "/portal/accounts" && pathname.startsWith("/portal/accounts/access-control")) return false;
  return href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
};

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
  for (const { tab, groups } of tabPaths(sections.flatMap((section) => section.entries))) {
    if (!isActive(tab.href, pathname)) continue;
    const within = pathname !== tab.href;
    const eventSection = tab.key === "events" ? pathname.match(/^\/portal\/events\/([^/]+)\/(registrants|analytics|rsvp|evaluation|attendance|deployment)$/) : null;
    if (eventSection) return [
      ...groups.map(group => ({ label: group.label })),
      { label: tab.label, href: tab.href },
      { label: "Details", href: `/portal/events/${eventSection[1]}` },
      { label: ({ registrants: "Registrants", analytics: "Analytics", rsvp: "RSVP Form", evaluation: "Evaluation Form", attendance: "Attendance", deployment: "Deployment" } as Record<string, string>)[eventSection[2]] },
    ];
    return [
      ...groups.map(group => ({ label: group.label })),
      within ? { label: tab.label, href: tab.href } : { label: tab.label },
      ...(within ? [{ label: namedPages[pathname] ?? (pathname.endsWith("/new") ? "New" : viewOnly && tab.key !== "events" ? "View" : pathname.endsWith("/edit") ? "Edit" : (tab.item ?? "Edit")) }] : []),
    ];
  }
  return [];
}

/** Main tabs and their subtabs occupy separate panels, using the same access-filtered map. */
export function PortalNav({ tabs, collapsed, showAccessControl = false, onExpand, counts = {} }: { tabs: readonly TabKey[]; collapsed: boolean; showAccessControl?: boolean; onExpand?: () => void; counts?: AttentionCounts }) {
  const countOf = (tab: Tab) => tab.key === "access-control" ? 0 : counts[tab.key] ?? 0;
  const groupCount = (group: Group) => tabPaths(group.items).reduce((total, { tab }) => total + countOf(tab), 0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const directoryReturn = isActive("/portal/accounts", pathname) && tabs.includes("members") ? directoryReturnHref(searchParams.get("returnTo")) : null;
  // An event opened from the Letters Tracker returns there.
  const lettersReturn = pathname.startsWith("/portal/events/") && fromLettersTracker(searchParams.get("from")) && tabs.includes("secretariat/letters-tracker");
  // The Database opened from Secretariat → Settings returns there.
  const secretariatReturn = isActive("/portal/database", pathname) && fromSecretariatSettings(searchParams.get("from")) && tabs.includes("secretariat/settings");
  const shown = openSections(tabs, showAccessControl);
  const entries = shown.flatMap((section) => section.entries);
  const activeGroups = tabPaths(entries).find(({ tab }) => isActive(tab.href, pathname))?.groups ?? [];
  const activeGroup = activeGroups[0]?.label ?? null;
  const [navigation, setNavigation] = useState<{ pathname: string; group: string | null; query: string }>({ pathname, group: activeGroup, query: "" });
  const current = navigation.pathname === pathname ? navigation : { pathname, group: activeGroup, query: "" };
  if (navigation.pathname !== pathname) setNavigation(current);
  const selectedPath = groupPaths(entries).find(({ group }) => group.label === current.group);
  const selected = selectedPath?.group;
  const backGroup = selectedPath?.parents.at(-1)?.label ?? null;
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const reducedMotion = useReducedMotion();
  const words = current.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const results = shown.flatMap(section => tabPaths(section.entries).filter(({ tab, groups }) =>
    words.every(word => `${section.label ?? ""} ${groups.map(group => group.label).join(" ")} ${tab.label}`.toLocaleLowerCase().includes(word)))
    .map(({ tab, groups }) => ({ tab, group: groups[0]?.label ?? null, context: groups.map(group => group.label).join(" · ") })));

  const openPanel = (group: string | null) => {
    setNavigation({ ...current, pathname, group, query: "" });
    requestAnimationFrame(() => panelRef.current?.focus());
  };
  const panelName = searching ? "Search results" : selected?.label ?? "All tabs";
  const administrative = entries.find((entry): entry is Group => isGroup(entry) && entry.label === "Administrative");
  const renderEntry = (entry: Entry, pinned = false) => {
    if (!isGroup(entry)) return <NavLink key={entry.href} tab={entry} active={isActive(entry.href, pathname)} count={countOf(entry)} />;
    const active = activeGroups.some(group => group.label === entry.label);
    const count = groupCount(entry);
    if (!pinned && selected?.label === "Legals") {
      const subpanel = `${id}-${entry.label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
      return <div key={entry.label} className="portal-nav-dropdown">
        <div id={`${subpanel}-heading`} role="heading" aria-level={3} className={`portal-nav-parent is-static${active ? " is-current-group" : ""}`} title={collapsed ? entry.label : undefined}>
          {active && <NavHighlight />}
          <NavSymbol icon={entry.icon} active={active} />
          <span className="portal-nav-label">{entry.label}</span>
          <UnreadBadge count={count} />
        </div>
        <div id={subpanel} className="portal-nav-subtabs" role="group" aria-labelledby={`${subpanel}-heading`}>
          {tabPaths(entry.items).map(({ tab }) => <NavLink key={tab.href} tab={tab} subtab active={isActive(tab.href, pathname)} count={countOf(tab)} />)}
        </div>
      </div>;
    }
    return <button key={entry.label} type="button" className={`portal-nav-parent${active ? " is-current-group" : ""}`} aria-label={`Open ${entry.label} tabs${count > 0 ? `, ${count} items needing attention` : ""}`} aria-controls={`${id}-panel`} title={collapsed ? entry.label : undefined} onClick={() => openPanel(entry.label)}>
      {active && <NavHighlight />}
      <NavSymbol icon={entry.icon} active={active} />
      <span className="portal-nav-label">{entry.label}</span>
      <UnreadBadge count={count} />
      <ChevronRight className="portal-nav-chevron" size={15} strokeWidth={1.8} aria-hidden="true" />
    </button>;
  };


  return (
    <LayoutGroup id="portal-sidebar">
      <motion.nav layoutScroll className="portal-nav" aria-label="Portal">
        <div className="portal-nav-scroll">
          <div className="portal-nav-search">
            {collapsed ? <button type="button" className="portal-nav-search-open" aria-label="Search navigation" title="Search navigation" onClick={() => { onExpand?.(); requestAnimationFrame(() => searchRef.current?.focus()); }}><Search size={17} aria-hidden="true" /></button> : (
              <div className="portal-nav-search-field">
                <Search size={15} aria-hidden="true" />
                <input ref={searchRef} type="search" aria-label="Search navigation" placeholder="Search tabs…" value={current.query} onChange={(event) => setNavigation({ ...current, query: event.target.value })} onKeyDown={(event) => { if (event.key === "Escape") setNavigation({ ...current, query: "" }); }} autoComplete="off" />
                {current.query && <button type="button" aria-label="Clear navigation search" onClick={() => { setNavigation({ ...current, query: "" }); searchRef.current?.focus(); }}><X size={14} aria-hidden="true" /></button>}
              </div>
            )}
          </div>
          <motion.div key={searching ? "search" : selected?.label ?? "root"} ref={panelRef} id={`${id}-panel`} className="portal-nav-panel" tabIndex={-1} role="group" aria-label={panelName} initial={reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .16 }}>
            {searching ? (
              <>
                <span className="portal-nav-section" role="status">{results.length} {results.length === 1 ? "result" : "results"}</span>
                {results.length ? results.map(({ tab, group, context }) => <NavLink key={tab.href} tab={tab} active={isActive(tab.href, pathname)} count={countOf(tab)} context={context || undefined} onNavigate={() => setNavigation({ pathname, group, query: "" })} />) : <p className="portal-nav-empty" role="status">No matching tabs.</p>}
              </>
            ) : selected ? (
              <>
                {directoryReturn && selected.label === "Administrative" ? (
                  <Link className="portal-nav-back" href={directoryReturn} aria-label="Back to Directory" title={collapsed ? "Back to Directory" : undefined}><ChevronLeft size={17} aria-hidden="true" /><span className="portal-nav-label">Directory</span></Link>
                ) : secretariatReturn && selected.label === "Administrative" ? (
                  <Link className="portal-nav-back" href={SECRETARIAT_OFFICES_HREF} aria-label="Back to Secretariat" title={collapsed ? "Back to Secretariat" : undefined}><ChevronLeft size={17} aria-hidden="true" /><span className="portal-nav-label">Secretariat</span></Link>
                ) : lettersReturn && selected.label === "Secretariat" ? (
                  <Link className="portal-nav-back" href={LETTERS_TRACKER_HREF} aria-label="Back to Letters Tracker" title={collapsed ? "Back to Letters Tracker" : undefined}><ChevronLeft size={17} aria-hidden="true" /><span className="portal-nav-label">Letters Tracker</span></Link>
                ) : (
                  <button type="button" className="portal-nav-back" aria-label={backGroup ? `Back to ${backGroup}` : "Back to all tabs"} title={collapsed ? (backGroup ? `Back to ${backGroup}` : "Back to all tabs") : undefined} onClick={() => openPanel(backGroup)}><ChevronLeft size={17} aria-hidden="true" /><span className="portal-nav-label">{backGroup ?? "All tabs"}</span></button>
                )}
                <span className="portal-nav-section portal-nav-panel-title">{selected.label}</span>
                {selected.items.map(entry => renderEntry(entry))}
              </>
            ) : shown.map((section, index) => (
              <Fragment key={index}>
                {section.label && <span className="portal-nav-section">{section.label}</span>}
                {section.entries.filter(entry => entry !== administrative).map(entry => renderEntry(entry))}
              </Fragment>
            ))}
          </motion.div>
        </div>
        {administrative && <div className="portal-nav-administrative">{renderEntry(administrative, true)}</div>}
      </motion.nav>
    </LayoutGroup>
  );
}

function NavHighlight({ subtab = false }: { subtab?: boolean }) {
  const reducedMotion = useReducedMotion();
  return <motion.span layoutId={subtab ? "active-subtab" : "active-tab"} className={`portal-nav-highlight${subtab ? " is-subtab" : ""}`} initial={false} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34 }} aria-hidden="true" />;
}

function NavLink({ tab: { href, label, icon }, active, subtab = false, context, onNavigate, count = 0 }: { tab: Tab; active: boolean; subtab?: boolean; context?: string; onNavigate?: () => void; count?: number }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Link href={href} title={context ? `${context}: ${label}` : label} onClick={onNavigate} className={`portal-nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} aria-label={count > 0 ? `${label}, ${count} items needing attention` : undefined} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {active && <NavHighlight subtab={subtab} />}
      <NavSymbol icon={icon} active={active} engaged={hovered || focused} />
      <span className="portal-nav-label">{label}{context && <small className="portal-nav-search-context">{context}</small>}</span>
      <UnreadBadge count={count} />
    </Link>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return count > 0 ? <span className="portal-nav-unread" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null;
}
