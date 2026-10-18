import type { CodeKey } from "@/lib/codes/options";
import { Building2, CalendarDays, ChartColumn, FileText, Flag, Gavel, Landmark, Lightbulb, LogIn, Mail, MessageSquareWarning, Network, Newspaper, Radar, Scale, ScrollText, Stamp, UserPlus, Users, UsersRound, Vote, type LucideIcon } from "lucide-react";

// What the navbar links to (src/components/site-header.tsx): its five tabs and the menu under each,
// the live readings along the menu's foot, and what the search knows about.

/** The periods the commission opens and closes from the portal. */
export type StatusKey = "applications" | "candidacy" | "parties";

/** Whether a period is open, and the day it closes ("Oct 29") when it has one. Read in the site layout. */
export type PeriodReading = { open: boolean; closes: string | null };

export type NavStatus = Record<StatusKey, PeriodReading> & { documents?: Partial<Record<CodeKey, boolean>> };

export type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  /** Marks the link with a green dot while this period is open. */
  status?: StatusKey;
  /** Other words people search for it by. */
  keywords?: string;
  /** Visible placeholder; no navigation until the document opens. */
  disabled?: boolean;
  document?: CodeKey;
};

export type NavSection = {
  id: string;
  label: string;
  /** The menu's headline: plain words, then the accent in the serif italic, as on the home page. */
  title: string;
  accent: string;
  blurb: string;
  /** Where the section itself lives; the tabs only open their menus. */
  cta: { label: string; href: string };
  /** The paths this section covers, for marking the tab of the page you're on. */
  paths: string[];
  items: NavItem[];
};

const contactDirectory = { label: "Contact Directory", href: "/about#contact" };

const filingServiceItems: NavItem[] = [
  { label: "Filing portal", href: "/filing", description: "Sign in with your UST account to manage your filings and service requests", icon: LogIn, keywords: "sign in login account party candidate documents" },
  { label: "Book a consultation", href: "/filing/services/consultation", description: "Request an appointment with your Comelec unit", icon: CalendarDays, keywords: "appointment meeting booking" },
  { label: "Request a commissioner", href: "/filing/services/commissioner", description: "Ask a commissioner to attend your activity", icon: UserPlus, keywords: "observer witness activity" },
  { label: "File a petition", href: "/filing/services/petition", description: "Submit an election petition and follow its progress", icon: MessageSquareWarning, keywords: "cases concerns complaint protest report evidence" },
];

export const sections: NavSection[] = [
  {
    id: "news",
    label: "News",
    title: "Signal,",
    accent: "not noise.",
    blurb: "News, statistics, events and explainers, straight from the commission.",
    cta: contactDirectory,
    paths: ["/news", "/statistics", "/events", "/explainer"],
    items: [
      { label: "Latest news", href: "/news", description: "Press releases, announcements and publications", icon: Newspaper, keywords: "updates press release statement media announcement publication newsroom" },
      { label: "Statistics", href: "/statistics", description: "Election figures, in tables you can download", icon: ChartColumn, keywords: "numbers data figures turnout voters results table csv" },
      { label: "Events & Activities", href: "/events", description: "Upcoming events and activities, with online registration", icon: CalendarDays, keywords: "calendar schedule dates register registration waitlist forum seminar" },
      { label: "Election Explainer", href: "/explainer", description: "Clear guides for every Thomasian voter", icon: Lightbulb, keywords: "guide how to vote faq" },
    ],
  },
  {
    id: "archive",
    label: "Archive",
    title: "The process,",
    accent: "on the record.",
    blurb: "Every order, memorandum and resolution the commission issues, open to anyone.",
    cta: contactDirectory,
    paths: ["/archive"],
    items: [
      { label: "Executive Orders", href: "/archive?type=executive-order", description: "Review official directives from the commission", icon: ScrollText, keywords: "eo directive" },
      { label: "Memorandums", href: "/archive?type=memorandum", description: "Read formal notices and election guidance", icon: FileText, keywords: "memo notice" },
      { label: "Resolutions", href: "/archive?type=resolution", description: "Browse adopted decisions and rulings", icon: Gavel, keywords: "decision ruling" },
      { ...filingServiceItems[3], label: "Cases & Concerns" },
    ],
  },
  {
    id: "voter-info",
    label: "Voter Info",
    title: "The rules,",
    accent: "in plain sight.",
    blurb: "The Constitution, Elections Code and official proclamations that govern a Thomasian election.",
    cta: contactDirectory,
    paths: ["/constitution", "/elections-code", "/magna-carta"],
    items: [
      { label: "Constitution", href: "/constitution", document: "constitution", description: "Read the rules that guide student elections", icon: Landmark, keywords: "charter" },
      { label: "Elections Code", href: "/elections-code", document: "elections-code", description: "Understand the code behind the electoral process", icon: Scale, keywords: "rules law omnibus usec 2011 students election code" },
      { label: "Magna Carta", href: "/magna-carta", document: "magna-carta", description: "Read the Magna Carta", icon: ScrollText },
      { label: "Proclamation", href: "/archive?type=proclamation", description: "View official proclamations from the commission", icon: Stamp, keywords: "results winners official" },
    ],
  },
  {
    id: "commission",
    label: "The Commission",
    title: "The commission,",
    accent: "in the open.",
    blurb: "The students entrusted with running fair, credible elections for the Thomasian community.",
    cta: contactDirectory,
    paths: ["/about"],
    items: [
      { label: "Central Comelec", href: "/about#central-comelec", description: "The central body overseeing student elections", icon: Building2, keywords: "commissioners officers" },
      { label: "Local Comelec", href: "/about#local-comelec", description: "Local election bodies serving each college", icon: Network, keywords: "college faculty unit" },
      { label: "En Banc", href: "/about#en-banc", description: "Meet the commission’s collective decision-making body", icon: Users },
      { label: "Chamber of Chairpersons", href: "/about#chamber-of-chairpersons", description: "The chairpersons of every college’s Local Comelec", icon: UsersRound },
      { label: "Contact the commission", href: contactDirectory.href, description: "Find the commission’s contact details and email address", icon: Mail, keywords: "contact directory email office address" },
    ],
  },
  {
    id: "apply",
    label: "Apply",
    title: "Your voice",
    accent: "moves UST.",
    blurb: "Serve on the commission, run for office or register a party, all online.",
    cta: contactDirectory,
    paths: ["/apply", "/candidacy", "/party-registration"],
    items: [
      { label: "Become a Commissioner", href: "/apply", description: "Join the commission and serve the Thomasian community", icon: UserPlus, status: "applications", keywords: "recruitment join volunteer" },
      { label: "Filing of Candidacy", href: "/candidacy", description: "File your candidacy for the student elections", icon: Vote, status: "candidacy", keywords: "run candidate coc certificate" },
      { label: "Political Party Registration", href: "/party-registration", description: "Register a political party with the commission", icon: Flag, status: "parties", keywords: "polpar" },
      { label: "Track your submission", href: "/apply/track", description: "Track registrations, RSVPs, commissioner applications and portal access requests, or request an edit", icon: Radar, keywords: "status reference code registration rsvp application access request edit correction" },
      filingServiceItems[0],
    ],
  },
];

/** The complete public footer directory, with filing services grouped in their own column. */
export const footerSections: Pick<NavSection, "id" | "label" | "items">[] = [
  ...sections.map(section => ({ ...section, items: section.items.filter(item => !filingServiceItems.some(service => service.href === item.href)) })),
  { id: "services", label: "Services", items: filingServiceItems },
];

/** The section whose pages `pathname` belongs to, if any. */
export const sectionFor = (pathname: string) => sections.find((section) => section.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)))?.id ?? null;

/** Whether a menu link is the page you're on. Links into a page (a filter, an anchor) never are. */
export const isCurrent = (href: string, pathname: string) => href === pathname;

/** "01", "02": how the menus number things. */
export const two = (value: number) => String(value).padStart(2, "0");

/** The readings along the menu's foot, as on the home page's HUD. `closed` is how each reads when it isn't open. */
export const readings: Array<{ key: StatusKey; label: string; href: string; closed: string }> = [
  { key: "applications", label: "Commissioner applications", href: "/apply", closed: "Closed" },
  { key: "candidacy", label: "Filing of candidacy", href: "/candidacy", closed: "Not open" },
  { key: "parties", label: "Party registration", href: "/party-registration", closed: "Not open" },
];

/** A period as the menu reads it: "Open until Oct 29", "Open", or `closed`. */
export const readingText = ({ open, closes }: PeriodReading, closed: string) => (open ? (closes ? `Open until ${closes}` : "Open") : closed);

/** What the search offers before anything is typed. */
export const topSearches: Array<{ label: string; href: string; document?: CodeKey }> = [
  { label: "Election calendar", href: "/events" },
  { label: "Official results", href: "/archive?type=proclamation" },
  { label: "Elections Code", href: "/elections-code", document: "elections-code" },
  { label: "Latest news", href: "/news" },
  { label: "File a petition", href: "/filing/services/petition" },
  { label: "Contact the commission", href: "/about#contact" },
];

/** What the search box types into itself while it's empty: "Search Comelec", "Search election updates", … */
export const searchPrompts = ["Comelec", "election updates", "official results", "Elections Code"];

type SearchEntry = NavItem & { section: string };

/** Every menu link, for the search to look through. */
const searchIndex: SearchEntry[] = footerSections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));

/**
 * The menu links matching every word of `query`, best first: a word that starts the link's name
 * counts for most, then one starting a word in it, then one inside it, then one in its section's
 * name or its keywords, and last one in its description.
 */
export function isNavItemAvailable(item: Pick<NavItem, "document">, status?: NavStatus) {
  return !item.document || (status?.documents?.[item.document] ?? item.document !== "magna-carta");
}

export function searchLinks(query: string, limit = 7, status?: NavStatus) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: Array<{ entry: SearchEntry; score: number }> = [];
  for (const entry of searchIndex) {
    if (entry.disabled || !isNavItemAvailable(entry, status)) continue;
    const name = entry.label.toLowerCase();
    const about = `${entry.section} ${entry.keywords ?? ""}`.toLowerCase();
    const description = entry.description.toLowerCase();
    let score = 0;
    for (const word of words) {
      const points = name.startsWith(word) ? 6 : name.split(/\s+/).some((part) => part.startsWith(word)) ? 5 : name.includes(word) ? 4 : about.includes(word) ? 2 : description.includes(word) ? 1 : 0;
      if (!points) {
        score = 0;
        break;
      }
      score += points;
    }
    if (score) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(({ entry }) => entry);
}
