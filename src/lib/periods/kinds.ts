// The three things every unit of the commission opens and closes for itself: Recruitment
// (commissioner applications), Political Party Registration and Filing of Candidacy. The Central
// Comelec has its own of each, and so has every college's Local Comelec unit, set from that unit's
// Settings subtab and stored in public.unit_periods (supabase/migrations/0027_unit_periods.sql).
//
// While one is open it's also listed with the events, on the website's Events page and in the
// portal's Events tab, under the event details the unit gave it (./listing.ts).
//
// Free of server-only imports: the forms and the lists read the same wording.

import type { Affiliation } from "@/lib/data/types";
import type { TabKey } from "@/lib/portal/access";

/** A unit of the commission: the Central Comelec, or the Local Comelec unit of `college`. */
export type Unit = { organizer: Affiliation; college: string | null };

export const CENTRAL_UNIT: Unit = { organizer: "central", college: null };

export const localUnit = (college: string): Unit => ({ organizer: "local", college });

export const sameUnit = (a: Unit, b: Unit) => a.organizer === b.organizer && (a.college ?? "") === (b.college ?? "");

/** How a unit is keyed in public.unit_periods: its college, or nothing for the Central Comelec. */
export const unitKey = (unit: Unit) => (unit.organizer === "local" ? (unit.college ?? "") : "");

export const unitFromKey = (key: string): Unit => (key ? localUnit(key) : CENTRAL_UNIT);

export type PeriodKind = "recruitment" | "party-registration" | "candidacy";

export const periodKinds: Record<PeriodKind, {
  /** What it's called, and its listing's name until the unit gives it one. */
  title: string;
  /** The portal section it's set in. */
  section: string;
  /** "applications": what people submit, for the portal's wording. */
  noun: string;
  /** Where the public applies or files. */
  href: string;
  /** Its Settings subtab, and the tab as access control knows it (src/lib/portal/access.ts). */
  settingsHref: string;
  tab: TabKey;
  /** The website's status tag while it's open. */
  openLabel: string;
  /** The button on its listing, which leads to `href` for the listing's own unit (applyHref). */
  action: string;
  /** Under that button on the listing's own page. */
  fine: string;
}> = {
  recruitment: {
    title: "Commissioner Applications",
    section: "Recruitment",
    noun: "applications",
    href: "/apply",
    settingsHref: "/portal/recruitment/settings",
    tab: "recruitment/settings",
    openLabel: "Applications open",
    action: "Apply",
    fine: "You’ll verify your UST Google account first, then fill in the application.",
  },
  "party-registration": {
    title: "Political Party Registration",
    section: "Political Party",
    noun: "registrations",
    href: "/party-registration",
    settingsHref: "/portal/polpar/settings",
    tab: "polpar/settings",
    openLabel: "Registration open",
    action: "Apply",
    fine: "The registration page says which units are taking registrations, and until when.",
  },
  candidacy: {
    title: "Filing of Candidacy",
    section: "Filing of Candidacy",
    noun: "filings",
    href: "/candidacy",
    settingsHref: "/portal/candidacy/settings",
    tab: "candidacy/settings",
    openLabel: "Filing open",
    action: "Apply",
    fine: "The filing page says which units are taking certificates of candidacy, and until when.",
  },
};

export const isPeriodKind = (value: unknown): value is PeriodKind => typeof value === "string" && Object.hasOwn(periodKinds, value);

// A listing's id --------------------------------------------------------------------------------
// "recruitment--central", "candidacy--faculty-of-pharmacy". An event's own id is a slug made from its
// name, which never has two hyphens in a row, so the two can't be mistaken for each other.

const slug = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const unitSlug = (unit: Unit) => (unit.organizer === "local" ? slug(unit.college ?? "") : "central");

export const listingId = (kind: PeriodKind, unit: Unit) => `${kind}--${unitSlug(unit)}`;

/** The kind a listing's id names, and its unit's slug; null for an event's own id. */
export function parseListingId(id: string): { kind: PeriodKind; matches: (unit: Unit) => boolean } | null {
  const [kind, unit, ...rest] = id.split("--");
  if (!isPeriodKind(kind) || !unit || rest.length) return null;
  return { kind, matches: (candidate) => unitSlug(candidate) === unit };
}

/**
 * Where a listing's Apply button leads: the public page, for that listing's unit (?unit=, its college,
 * or "central"). The Apply form then starts on that unit; the filing pages put it first.
 */
export const applyHref = (kind: PeriodKind, unit: Unit) => `${periodKinds[kind].href}?unit=${encodeURIComponent(unit.organizer === "local" && unit.college ? unit.college : "central")}`;

/** The unit a public page was sent to with ?unit=; null when none or not one the commission has. */
export function unitFromParam(value: unknown, units: readonly string[]): Unit | null {
  if (value === "central") return CENTRAL_UNIT;
  return typeof value === "string" && units.includes(value) ? localUnit(value) : null;
}

/** A unit's Settings subtab for `kind`. Another unit's is reached with ?unit=. */
export const settingsHref = (kind: PeriodKind, unit: Unit) => (unit.organizer === "local" && unit.college ? `${periodKinds[kind].settingsHref}?unit=${encodeURIComponent(unit.college)}` : periodKinds[kind].settingsHref);
