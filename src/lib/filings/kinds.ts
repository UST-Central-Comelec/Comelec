// Political Party Registration (PolPaR) and Filing of Candidacy: the public page and portal section
// for each. Whether each is open is every unit's own to set, in the portal
// (src/lib/periods/kinds.ts, public.unit_periods).

import type { TabKey } from "@/lib/portal/access";

export type FilingKind = "party-registration" | "candidacy";

export const filingKinds: Record<FilingKind, {
  /** "Political Party Registration": the public page's title. */
  title: string;
  /** "PolPaR": the portal section. */
  section: string;
  /** "registrations": what people submit, for the portal's wording. */
  noun: string;
  /** The public page. */
  href: string;
  /** The portal section; its subtabs sit under it. */
  portalHref: string;
  /** Its subtabs, as access control knows them (src/lib/portal/access.ts). */
  tabs: { submissions: TabKey; settings: TabKey };
}> = {
  "party-registration": {
    title: "Political Party Registration",
    section: "PolPaR",
    noun: "registrations",
    href: "/party-registration",
    portalHref: "/portal/polpar",
    tabs: { submissions: "polpar/registrations", settings: "polpar/settings" },
  },
  candidacy: {
    title: "Filing of Candidacy",
    section: "Filing of Candidacy",
    noun: "filings",
    href: "/candidacy",
    portalHref: "/portal/candidacy",
    tabs: { submissions: "candidacy/filings", settings: "candidacy/settings" },
  },
};

export const isFilingKind = (value: unknown): value is FilingKind => typeof value === "string" && value in filingKinds;
