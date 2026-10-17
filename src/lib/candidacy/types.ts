import type { FilingDocument } from "@/lib/filing-portal/types";

// Filing of Candidacy (supabase/migrations/20261017210000_candidacy_filing.sql), as the pages use
// it. Free of server-only imports.

export type CandidacyStatus = "pending" | "qualified" | "disqualified" | "withdrawn";
/** none: an independent candidate; waiting: for the party's contact person; endorsed or declined by them. */
export type Endorsement = "none" | "waiting" | "endorsed" | "declined";

export type Candidacy = {
  id: string;
  accountId: string;
  /** The unit it's filed with: "" for the Central Comelec, else a Local unit's college. */
  college: string;
  position: string;
  partyId: string | null;
  partyName: string | null;
  endorsement: Endorsement;
  endorsedBy: string | null;
  endorsedAt: string | null;
  dateOfBirth: string;
  residence: string;
  status: CandidacyStatus;
  decisionRemarks: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type CandidacyDocument = FilingDocument & { candidacyId: string };

export const candidacyStatusLabel: Record<CandidacyStatus, string> = { pending: "Pending review", qualified: "Qualified", disqualified: "Disqualified", withdrawn: "Withdrawn" };
export const candidacyStatusTone: Record<CandidacyStatus, string> = { pending: "is-gold", qualified: "is-ok", disqualified: "is-warn", withdrawn: "" };

export const endorsementLabel: Record<Endorsement, string> = { none: "Independent", waiting: "Waiting for the party’s endorsement", endorsed: "Endorsed by the party", declined: "Not endorsed by the party" };

/** The unit sees a filing once it's independent, or its party has endorsed it. */
export const reachesUnit = (candidacy: Pick<Candidacy, "endorsement">) => candidacy.endorsement === "none" || candidacy.endorsement === "endorsed";

/** "President, Central Student Council" style: the office and whose council it's on. */
export const councilOf = (college: string) => (college ? `${college} Student Council` : "Central Student Council");
