import { SlidingSubtabs } from "../sliding-subtabs";

/** Political Party → Applicants: the parties registering, and the filing portal's accounts. */
export function PartyApplicantsTabs({ current }: { current: "parties" | "accounts" }) {
  return <SlidingSubtabs items={[
    { key: "parties", label: "Parties", href: "/portal/polpar/registrations" },
    { key: "accounts", label: "Accounts", href: "/portal/polpar/registrations/accounts" },
  ]} active={current} label="Political Party applicants" scope="polpar-applicants" className="fr-subtabs" />;
}

/** Filing of Candidacy → Applicants: the filings, and the filing portal's accounts. */
export function CandidacyApplicantsTabs({ current }: { current: "filings" | "accounts" }) {
  return <SlidingSubtabs items={[
    { key: "filings", label: "Filings", href: "/portal/candidacy/filings" },
    { key: "accounts", label: "Accounts", href: "/portal/candidacy/filings/accounts" },
  ]} active={current} label="Filing of Candidacy applicants" scope="candidacy-applicants" className="fr-subtabs" />;
}

/** One record's own tabs (a party's documents, members…), held in the address as `?view=`. */
export function RecordTabs({ base, items, current, label, scope }: { base: string; items: Array<{ key: string; label: string }>; current: string; label: string; scope: string }) {
  return <SlidingSubtabs items={items.map((item, index) => ({ key: item.key, label: item.label, href: index === 0 ? base : `${base}?view=${item.key}` }))} active={current} label={label} scope={scope} className="fr-subtabs" />;
}
