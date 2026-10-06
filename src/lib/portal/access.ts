// What the portal opens to whom. An account's kind (personal or official), affiliation and
// position put it in a level, and each level has the tabs it may open. The defaults are below; the
// Central Executive Board can change them, level by level, under Accounts → Access Control (saved in
// public.portal_access, read by ./access-store.ts).
//
// One tab isn't any level's to be given: Approvals, under Apps, is the Central Executive Board's
// alone (isBoardTab), so it's never in another level's defaults and can't be switched on for one.
//
// Opening a tab is the first of three checks. A Local account only ever sees its own college's
// records inside a tab, whatever its level (isLocal and canSeeCollege in src/lib/auth/session.ts,
// canManageAccount in ./account-scope.ts). And Advisers and Admins only read what they open:
// every Server Action refuses them (requireEditor in src/lib/auth/session.ts).
//
// Free of server-only imports: the sidebar and the settings form read the same list.

import type { AccountAffiliation, AccountKind, AccountPosition } from "@/lib/data/types";

/**
 * Every tab, in the sidebar's order, under its main tab. `local` marks the tabs a Local account can
 * be given: the apps, the tabs with a college's own records to show (its events, its people, its
 * applicants), and the Settings of Recruitment, Political Party and Filing of Candidacy, which every
 * unit has its own of (src/lib/periods/kinds.ts). The rest hold commission-wide content and
 * settings, so only Central accounts (and the Office for Student Affairs) can be given them.
 */
export const tabGroups = [
  { label: null, section: null, tabs: [{ key: "dashboard", label: "Dashboard", local: true }] },
  {
    label: "Apps",
    section: null,
    tabs: [
      { key: "apps/inbox", label: "Inbox", local: true },
      { key: "apps/secretariat", label: "Secretariat", local: true },
      { key: "apps/email", label: "Email Sender", local: true },
      { key: "apps/calendar", label: "Calendar", local: true },
      { key: "apps/tickets", label: "Tickets", local: true },
      { key: "apps/approvals", label: "Approvals", local: false },
    ],
  },
  {
    label: "Publications",
    section: "Website",
    tabs: [
      { key: "news", label: "News", local: false },
      { key: "statistics", label: "Statistics", local: false },
      { key: "events", label: "Events", local: true },
      { key: "members", label: "Directory", local: true },
      { key: "documents", label: "Documents", local: false },
      { key: "codes/constitution", label: "Constitution", local: false },
      { key: "codes/elections-code", label: "Elections Code", local: false },
    ],
  },
  {
    label: "Petitions & Cases",
    section: "Website",
    tabs: [
      { key: "petitions/submissions", label: "Submissions", local: true },
      { key: "petitions/settings", label: "Settings", local: false },
    ],
  },
  {
    label: "Recruitment",
    section: "Website",
    tabs: [
      { key: "recruitment/applications", label: "Applicants", local: true },
      { key: "recruitment/interviews", label: "Interviews", local: false },
      { key: "recruitment/slots", label: "Slots", local: false },
      { key: "recruitment/settings", label: "Settings", local: true },
    ],
  },
  {
    label: "Political Party",
    section: "Website",
    tabs: [
      { key: "polpar/registrations", label: "Applicants", local: true },
      { key: "polpar/requirements", label: "Requirements", local: false },
      { key: "polpar/settings", label: "Settings", local: true },
    ],
  },
  {
    label: "Filing of Candidacy",
    section: "Website",
    tabs: [
      { key: "candidacy/filings", label: "Applicants", local: true },
      { key: "candidacy/requirements", label: "Requirements", local: false },
      { key: "candidacy/settings", label: "Settings", local: true },
    ],
  },
  {
    label: "Administrative",
    section: null,
    tabs: [
      { key: "accounts", label: "Accounts", local: true },
      { key: "maintenance", label: "Maintenance", local: false },
      { key: "logs", label: "Logs", local: false },
    ],
  },
] as const;

export type TabGroup = (typeof tabGroups)[number];
export type GroupLabel = NonNullable<TabGroup["label"]>;
export type TabKey = TabGroup["tabs"][number]["key"];

const tabs = tabGroups.flatMap((group) => group.tabs.map((tab) => ({ ...tab, group: group.label as GroupLabel | null })));

export const tabKeys: readonly TabKey[] = tabs.map((tab) => tab.key);

export const isTabKey = (value: unknown): value is TabKey => typeof value === "string" && (tabKeys as readonly string[]).includes(value);

/** A tab as it's named outside the sidebar: "Recruitment → Settings", "Dashboard". */
export const tabName = (key: TabKey) => {
  const tab = tabs.find((item) => item.key === key)!;
  return tab.group ? `${tab.group} → ${tab.label}` : tab.label;
};

/** The tab's address in the portal. */
export const tabHref = (key: TabKey) => (key === "dashboard" ? "/portal" : `/portal/${key}`);

const localTabs = new Set<TabKey>(tabs.filter((tab) => tab.local).map((tab) => tab.key));

/** Whether a Local account can be given this tab at all. */
export const isLocalTab = (key: TabKey) => localTabs.has(key);

/** The tabs only the Central Executive Board has: where what the legal officers write is signed. */
const boardTabs = new Set<TabKey>(["apps/approvals"]);

/** Whether this tab is the Central Executive Board's alone, so no other level can be given it. */
export const isBoardTab = (key: TabKey) => boardTabs.has(key);

export const accessLevels = {
  "central-board": "Central Executive Board",
  "local-board": "Local Executive Board",
  "central-associate": "Central Executive Associate",
  "local-associate": "Local Executive Associate",
  deputy: "Deputies",
  "central-adviser": "Central Advisers",
  "local-adviser": "Local Advisers",
  admin: "Admins",
  "central-official": "Central Official Account",
  "local-official": "Local Official Accounts",
} as const;

export type AccessLevel = keyof typeof accessLevels;

export const isAccessLevel = (value: unknown): value is AccessLevel => typeof value === "string" && value in accessLevels;

/** The level that's always open to everything, and the only one that sees and changes the others' access. */
export const FULL_ACCESS = "central-board" satisfies AccessLevel;

export type EditableLevel = Exclude<AccessLevel, typeof FULL_ACCESS>;

export const editableLevels = (Object.keys(accessLevels) as AccessLevel[]).filter((level): level is EditableLevel => level !== FULL_ACCESS);

/**
 * The levels that switch the automatic emails off and on (Apps → Email Sender → Automatic). The
 * switches are the whole commission's, so they aren't every Email Sender's to change: only the
 * Central Executive Board's and the Central Comelec's official account's. The rest see how they stand.
 */
export const switchesEmails = (level: AccessLevel) => level === FULL_ACCESS || level === "central-official";

/** Advisers and Admins: they open their tabs to read them, and change nothing. */
export const isViewerLevel = (level: AccessLevel) => level === "central-adviser" || level === "local-adviser" || level === "admin";

type Leveled = { kind: AccountKind; affiliation: AccountAffiliation; position: AccountPosition };

/**
 * A unit's official account has a level of its own. Admins are one level and so are Deputies,
 * Central or Local; the other positions split by affiliation.
 */
export function accessLevelOf({ kind, affiliation, position }: Leveled): AccessLevel {
  const unit = affiliation === "local" ? "local" : "central";
  if (kind === "official") return `${unit}-official`;
  if (affiliation === "osa" || position === "admin") return "admin";
  if (position === "deputy") return "deputy";
  return `${unit}-${position === "executive-board" ? "board" : position === "adviser" ? "adviser" : "associate"}`;
}

/** Whether every account at this level is Local, so the Central-only tabs can't be switched on for it. */
export const isLocalLevel = (level: AccessLevel) => level.startsWith("local-");

const administrative = new Set<TabKey>(tabs.filter((tab) => tab.group === "Administrative").map((tab) => tab.key));
const deputyGroups: readonly (GroupLabel | null)[] = ["Recruitment", "Political Party", "Filing of Candidacy"];
/** Every tab a level other than the Central Executive Board can have. */
const grantable = tabKeys.filter((key) => !isBoardTab(key));
const everythingBut = (...left: Array<TabKey | Set<TabKey>>) => grantable.filter((key) => !left.some((item) => (typeof item === "string" ? item === key : item.has(key))));

/**
 * What each level opens until it's changed under Accounts → Access Control:
 *   Executive Board: everything;
 *   Executive Associates: everything but the Administrative tab;
 *   Deputies: Recruitment, Political Party and Filing of Candidacy;
 *   Advisers and Admins: everything, to read;
 *   Official accounts: what their unit's Executive Board has, but for Approvals.
 * A Local account gets the part of its level's tabs that a Local account can have (tabsFor). Of
 * the apps, Local commissioners get Secretariat, Calendar and Tickets; the Email Sender is for a
 * Local unit's official account.
 */
export const defaultTabs: Record<AccessLevel, readonly TabKey[]> = {
  "central-board": tabKeys,
  "local-board": everythingBut("apps/email"),
  "central-associate": everythingBut(administrative),
  "local-associate": everythingBut(administrative, "apps/email"),
  deputy: ["apps/inbox", ...tabs.filter((tab) => deputyGroups.includes(tab.group)).map((tab) => tab.key)],
  "central-adviser": grantable,
  "local-adviser": everythingBut("apps/email"),
  admin: grantable,
  "central-official": grantable,
  "local-official": grantable,
};

/** A level's changes from its defaults: only the tabs switched the other way. */
export type TabOverrides = Partial<Record<TabKey, boolean>>;
export type AccessOverrides = Partial<Record<EditableLevel, TabOverrides>>;

/** The tabs switched on for a level, before the Local limit: its defaults with its saved changes over them. */
export function levelTabs(level: AccessLevel, overrides: AccessOverrides = {}): TabKey[] {
  if (level === FULL_ACCESS) return [...tabKeys];
  const changes = overrides[level] ?? {};
  return grantable.filter((key) => changes[key] ?? defaultTabs[level].includes(key));
}

/** The tabs an account may open. */
export function tabsFor(account: Leveled, overrides: AccessOverrides = {}): TabKey[] {
  const open = levelTabs(accessLevelOf(account), overrides);
  return account.affiliation === "local" ? open.filter(isLocalTab) : open;
}

/** The changes that turn a level's defaults into `chosen`, to save. Tabs a Local level can't have, and the board's own, are never recorded. */
export function overridesFor(level: EditableLevel, chosen: readonly TabKey[]): TabOverrides {
  const changes: TabOverrides = {};
  for (const key of grantable) {
    if (isLocalLevel(level) && !isLocalTab(key)) continue;
    const on = chosen.includes(key);
    if (on !== defaultTabs[level].includes(key)) changes[key] = on;
  }
  return changes;
}

/** Where someone lands: the Dashboard if they have it, otherwise their first tab, otherwise their own account page. */
export const homeOf = (open: readonly TabKey[]) => (open.length ? tabHref(tabKeys.find((key) => open.includes(key))!) : "/portal/account");
