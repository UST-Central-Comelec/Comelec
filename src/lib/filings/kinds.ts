// Political Party Registration (PolPaR) and Filing of Candidacy: the public page and portal section
// for each. Whether each is open is set in the portal and stored in public.filing_periods
// (supabase/migrations/0015_filing_periods.sql).

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
}> = {
  "party-registration": {
    title: "Political Party Registration",
    section: "PolPaR",
    noun: "registrations",
    href: "/party-registration",
    portalHref: "/portal/polpar",
  },
  candidacy: {
    title: "Filing of Candidacy",
    section: "Filing of Candidacy",
    noun: "filings",
    href: "/candidacy",
    portalHref: "/portal/candidacy",
  },
};

export const isFilingKind = (value: unknown): value is FilingKind => typeof value === "string" && value in filingKinds;
