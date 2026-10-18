import type { CandidacyStatus, Endorsement } from "@/lib/candidacy/types";
import type { PartySanction, PartyStatus } from "@/lib/party-portal/types";
import { isReadyToDecide, type DocumentProgress } from "./types";

// Where each application stands for the commission, past its status: a pending one needs the
// unit's review, is back with the filer for revisions, is ready to decide, or is still being put
// together. The Applicants lists filter by these, and each row says what comes next. Free of
// server-only imports.

export type Stage = { key: string; label: string; tone: string; next: string };

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** A pending application's stage, from its documents. */
function documentStage(progress: DocumentProgress, filer: string, ready: string): Stage {
  if (progress.waiting) return { key: "review", label: "Needs review", tone: "is-gold", next: `${plural(progress.waiting, "document")} to review` };
  if (progress.changes) return { key: "returned", label: "Returned for revisions", tone: "is-warn", next: `Waiting for ${filer} to revise ${plural(progress.changes, "document")}` };
  if (isReadyToDecide(progress)) return { key: "ready", label: ready, tone: "is-gold", next: "Every required document is approved" };
  const sent = progress.total - progress.drafts;
  return { key: "progress", label: "Filing documents", tone: "", next: sent ? `${sent} of ${progress.total} sent so far` : "Nothing sent yet" };
}

export const partyStageKeys = ["review", "returned", "ready", "progress", "accredited", "declined", "suspended", "blacklisted", "withdrawn"] as const;
export type PartyStageKey = (typeof partyStageKeys)[number];

export function partyStage(party: { status: PartyStatus; sanction: PartySanction | null; decisionOverride: boolean }, progress: DocumentProgress): Stage & { key: PartyStageKey } {
  if (party.sanction === "blacklisted") return { key: "blacklisted", label: "Blacklisted", tone: "is-danger", next: "Barred: its name stays taken" };
  if (party.sanction === "suspended") return { key: "suspended", label: "Suspended", tone: "is-warn", next: "Can’t field candidates until it’s lifted" };
  if (party.status === "accredited") return { key: "accredited", label: "Accredited", tone: "is-ok", next: party.decisionOverride ? "Accredited with documents outstanding" : "Can field candidates" };
  if (party.status === "declined") return { key: "declined", label: "Declined", tone: "is-warn", next: "Its records and members stay" };
  if (party.status === "withdrawn") return { key: "withdrawn", label: "Withdrawn", tone: "", next: "Its members and name are free" };
  return documentStage(progress, "the party", "Ready to accredit") as Stage & { key: PartyStageKey };
}

export const filingStageKeys = ["endorsement", "not-endorsed", "review", "returned", "ready", "progress", "qualified", "disqualified", "withdrawn"] as const;
export type FilingStageKey = (typeof filingStageKeys)[number];

export function filingStage(filing: { status: CandidacyStatus; endorsement: Endorsement; partyName: string | null; decisionOverride: boolean }, progress: DocumentProgress): Stage & { key: FilingStageKey } {
  if (filing.status === "withdrawn") return { key: "withdrawn", label: "Withdrawn", tone: "", next: "They can file again while filing is open" };
  if (filing.endorsement === "waiting") return { key: "endorsement", label: "Waiting for the party", tone: "", next: `${filing.partyName ?? "The party"} hasn’t endorsed them yet` };
  if (filing.endorsement === "declined") return { key: "not-endorsed", label: "Not endorsed", tone: "is-warn", next: "They can withdraw and file as an independent" };
  if (filing.status === "qualified") return { key: "qualified", label: "Qualified", tone: "is-ok", next: filing.decisionOverride ? "Qualified with documents outstanding" : "On the ballot" };
  if (filing.status === "disqualified") return { key: "disqualified", label: "Disqualified", tone: "is-warn", next: "Decided" };
  return documentStage(progress, "the candidate", "Ready to decide") as Stage & { key: FilingStageKey };
}
