"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState, type ComponentType } from "react";
import { Briefcase, Calendar, CalendarCheck, CalendarDays, ChartColumn, ChevronDown, ClipboardList, FileText, Flag, Globe, Hash, Inbox, LayoutDashboard, LayoutGrid, ListChecks, Newspaper, Scale, ScrollText, Send, Settings2, ShieldCheck, Ticket, UserCog, Users, Vote, Wrench } from "lucide-react";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" }>;
/** `item` is the top bar's word for one of the tab's own pages, such as an application under Applications ("Edit" if not given). */
type Tab = { href: string; label: string; icon: Icon; item?: string };
/** A main tab with subtabs. Clicking it folds the subtabs open or shut (in the icon strip, it opens the first subtab). */
type Group = { label: string; icon: Icon; items: Tab[] };
type Entry = Tab | Group;
/** A run of tabs, under a small heading if it has a `label`. */
type Section = { label?: string; entries: Entry[] };

const sections: Section[] = [
  { entries: [{ href: "/portal", label: "Dashboard", icon: LayoutDashboard }] },
  {
    entries: [
      {
        label: "Apps",
        icon: LayoutGrid,
        items: [
          { href: "/portal/apps/secretariat", label: "Secretariat", icon: Briefcase },
          { href: "/portal/apps/email", label: "Email Sender", icon: Send },
          { href: "/portal/apps/calendar", label: "Calendar", icon: Calendar },
          { href: "/portal/apps/tickets", label: "Tickets", icon: Ticket },
        ],
      },
    ],
  },
  {
    label: "Website",
    entries: [
      {
        label: "Publications",
        icon: Globe,
        items: [
          { href: "/portal/news", label: "News", icon: Newspaper },
          { href: "/portal/statistics", label: "Statistics", icon: ChartColumn },
          { href: "/portal/events", label: "Events", icon: CalendarCheck, item: "Event" },
          { href: "/portal/members", label: "Directory", icon: Users },
          { href: "/portal/documents", label: "Documents", icon: FileText },
        ],
      },
      {
        label: "Petitions & Cases",
        icon: Scale,
        items: [
          { href: "/portal/petitions/submissions", label: "Submissions", icon: Inbox },
          { href: "/portal/petitions/settings", label: "Settings", icon: Settings2 },
        ],
      },
      {
        label: "Recruitment",
        icon: ClipboardList,
        items: [
          { href: "/portal/recruitment/applications", label: "Applicants", icon: Inbox, item: "Review" },
          { href: "/portal/recruitment/interviews", label: "Interviews", icon: CalendarDays },
          { href: "/portal/recruitment/slots", label: "Slots", icon: Hash },
          { href: "/portal/recruitment/settings", label: "Settings", icon: Settings2 },
        ],
      },
      {
        label: "Political Party",
        icon: Flag,
        items: [
          { href: "/portal/polpar/registrations", label: "Applicants", icon: Inbox },
          { href: "/portal/polpar/requirements", label: "Requirements", icon: ListChecks },
          { href: "/portal/polpar/settings", label: "Settings", icon: Settings2 },
        ],
      },
      {
        label: "Filing of Candidacy",
        icon: Vote,
        items: [
          { href: "/portal/candidacy/filings", label: "Applicants", icon: Inbox },
          { href: "/portal/candidacy/requirements", label: "Requirements", icon: ListChecks },
          { href: "/portal/candidacy/settings", label: "Settings", icon: Settings2 },
        ],
      },
    ],
  },
];

const executiveSection: Section = {
  entries: [
    {
      label: "Administrative",
      icon: ShieldCheck,
      items: [
        { href: "/portal/accounts", label: "Accounts", icon: UserCog, item: "Manage" },
        { href: "/portal/maintenance", label: "Maintenance", icon: Wrench, item: "Test" },
        { href: "/portal/logs", label: "Logs", icon: ScrollText },
      ],
    },
  ],
};

const isGroup = (entry: Entry): entry is Group => "items" in entry;

/**
 * The tabs a Local account sees: its college's people, not the commission-wide settings. Groups
 * keep only these subtabs, and sections left with nothing are dropped. The pages check this on the server too.
 */
const localTabs = new Set(["/portal/events", "/portal/members", "/portal/recruitment/applications", "/portal/polpar/registrations", "/portal/candidacy/filings"]);

function localSections(list: Section[]): Section[] {
  return list.flatMap((section): Section[] => {
    const entries = section.entries.flatMap((entry): Entry[] => {
      if (!isGroup(entry)) return localTabs.has(entry.href) ? [entry] : [];
      const items = entry.items.filter((item) => localTabs.has(item.href));
      return items.length ? [{ ...entry, items }] : [];
    });
    return entries.length ? [{ ...section, entries }] : [];
  });
}
const isActive = (href: string, pathname: string) => (href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

export type Crumb = { label: string; href?: string };

/**
 * Where `pathname` sits in the portal, for the top bar: its group, its tab, then "New" or the tab's
 * word for one of its own pages (or "Edit", for a page that has its own edit page). The last crumb is
 * the page itself, so it has no link.
 */
export function trail(pathname: string): Crumb[] {
  if (pathname === "/portal/account") return [{ label: "My account" }];
  for (const entry of [...sections, executiveSection].flatMap((section) => section.entries)) {
    for (const tab of isGroup(entry) ? entry.items : [entry]) {
      if (!isActive(tab.href, pathname)) continue;
      const within = pathname !== tab.href;
      return [
        ...(isGroup(entry) ? [{ label: entry.label }] : []),
        within ? { label: tab.label, href: tab.href } : { label: tab.label },
        ...(within ? [{ label: pathname.endsWith("/new") ? "New" : pathname.endsWith("/edit") ? "Edit" : (tab.item ?? "Edit") }] : []),
      ];
    }
  }
  return [];
}

/**
 * `isExecutive` and `isLocal` only decide what's shown; the pages check the role and affiliation on the server.
 * When `collapsed`, the sidebar is a strip of icons: labels show as tooltips, and a group's
 * subtabs show in a flyout on hover or keyboard focus instead of expanding in place.
 */
export function PortalNav({ isExecutive, isLocal, collapsed }: { isExecutive: boolean; isLocal: boolean; collapsed: boolean }) {
  const pathname = usePathname();
  const shown = isLocal ? localSections(sections) : isExecutive ? [...sections, executiveSection] : sections;
  const activeGroup = shown.flatMap((section) => section.entries).find((entry) => isGroup(entry) && entry.items.some((item) => isActive(item.href, pathname)))?.label ?? null;

  // A group opened or closed by hand stays that way from page to page. Groups you haven't touched
  // follow the page: only the one you're in is open.
  const [locked, setLocked] = useState<Record<string, boolean>>({});

  return (
    <nav className="portal-nav" aria-label="Portal">
      {shown.map((section, index) => (
        <Fragment key={index}>
          {section.label && <span className="portal-nav-section">{section.label}</span>}
          {section.entries.map((entry) => {
            if (!isGroup(entry)) return <NavLink key={entry.href} tab={entry} active={isActive(entry.href, pathname)} />;

            const { label, icon: GroupIcon, items } = entry;
            const within = activeGroup === label;
            const open = locked[label] ?? within;
            const subId = `portal-nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
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
        </Fragment>
      ))}
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
