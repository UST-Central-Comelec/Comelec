import type { ReactNode } from "react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { candidacyRequirements } from "@/lib/candidacy/content";
import { candidacyStatusLabel, candidacyStatusTone, type Candidacy } from "@/lib/candidacy/types";
import type { FilingDocument } from "@/lib/filing-portal/types";
import { partyRequirementGroups, partyRequirements, partyStanding, unitName, type Party, type PartyRequirementGroup } from "@/lib/party-portal/types";

// The top of the filing portal's Political Party and Candidacy pages: the title, where it stands,
// and the page's own action. Their subtabs are in the sidebar (./shell.tsx).


const partyPages = { information: "Party information", members: "Members", ...Object.fromEntries(partyRequirementGroups.map((group) => [group.key, group.label])) } as Record<"information" | PartyRequirementGroup | "members", string>;

export function PartyHead({ party, documents, current, action }: { party: Party; documents: FilingDocument[]; current: "information" | PartyRequirementGroup | "members"; action?: ReactNode }) {
  const standing = partyStanding(party);
  const approved = documents.filter((item) => item.status === "approved").length;
  return (
    <>
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Political Party · {partyPages[current]}</p>
          <TitleWithInfo info={`Your party’s registration with the ${unitName(party.college)}. Every member sees the same documents and feedback: upload each requirement’s files, then send it for review. The unit approves it, or returns it for revisions. The contact person approves who joins and endorses the party’s candidates.`}>{current === "information" ? party.name : partyPages[current]}</TitleWithInfo>
          <p className="portal-muted">{current === "information" ? "" : `${party.name} · `}{party.reference} · <span className={`portal-tag ${standing.tone}`}>{standing.label}</span> · {approved} of {partyRequirements.length} documents approved · {unitName(party.college)}</p>
        </div>
        {action}
      </header>
    </>
  );
}

const candidacyPages = { profile: "Candidate profile", documents: "Upload documents", materials: "Campaign materials", schedule: "Campaign schedule" } as const;

export function CandidacyHead({ candidacy, documents, current, action }: { candidacy: Candidacy; documents: FilingDocument[]; current: keyof typeof candidacyPages; action?: ReactNode }) {
  const approved = documents.filter((item) => item.status === "approved").length;
  const unit = unitName(candidacy.college);
  const info = current === "materials"
    ? `Every campaign material is approved by the ${unit} before it’s used: streamers and tarpaulins, posters, sample ballots and handbills, electronic materials, and the pages where you campaign (Elections Code, Article VII, Sections 5, 8 and 11). Send each with a copy of it; the unit approves it, asks for changes, or doesn’t approve it.`
    : current === "schedule"
      ? `Your campaign schedule: where and when you’ll campaign, each activity approved by the ${unit} (Article VII, Sections 1.3 and 7). Add or change an activity at least five hours ahead, not counting midnight to 6 a.m.; nothing goes on a no-campaign day.`
      : `Your certificate of candidacy and its documents. ${candidacy.partyId ? "Running under a party, your filing reaches the unit once the party’s contact person endorses you. " : ""}Upload each document, then send it for review; the ${unit} approves it or returns it for revisions, then decides whether you’re qualified.`;
  return (
    <>
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Candidacy · {candidacyPages[current]}</p>
          <TitleWithInfo info={info}>{candidacyPages[current]}</TitleWithInfo>
          <p className="portal-muted">{candidacy.reference} · <span className={`portal-tag ${candidacyStatusTone[candidacy.status]}`}>{candidacyStatusLabel[candidacy.status]}</span> · {candidacy.position} · {approved} of {candidacyRequirements.length} documents approved</p>
        </div>
        {action}
      </header>
    </>
  );
}
