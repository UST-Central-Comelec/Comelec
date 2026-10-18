import "server-only";

import { addAccountNotice } from "@/lib/filing-portal/accounts";
import { fullName, type PublicAccount } from "@/lib/filing-portal/types";
import { later, sendAutomatic } from "@/lib/notifications/notify";
import { addNotice, getMember } from "@/lib/party-portal/store";
import { unitName, type Party } from "@/lib/party-portal/types";
import { candidacyRequirementLabel } from "./content";
import { candidacyDecisionEmail, candidacyFeedbackEmail, candidacyWithdrawnEmail, endorsementDecisionEmail, endorsementRequestEmail } from "./emails";
import { candidacyStatusLabel, type Candidacy, type CandidacyStatus } from "./types";

// What happens around a change to a candidacy: a line in the candidate's Notifications (and the
// party's, for what concerns it), and the email that goes with it, sent once the response has gone.

const firstName = (person: { firstName: string }) => person.firstName.split(" ")[0] || person.firstName;

/** A member filed under the party: its contact person is asked to endorse them. */
export async function noticeEndorsementRequest(party: Party, candidacy: Candidacy, candidate: PublicAccount) {
  const name = fullName(candidate);
  await addNotice({ partyId: party.id, kind: "candidate-request", title: `${name} asks the party to endorse their candidacy`, body: `Running for ${candidacy.position}. Endorse or decline under Members.`, href: "/filing/party/members", actor: name, forContact: true });
  const contact = party.contactMemberId ? await getMember(party.contactMemberId) : null;
  if (contact?.status === "active") later(() => sendAutomatic("candidacy-endorsement-request", () => endorsementRequestEmail({ firstName: firstName(contact), email: contact.email }, { name, email: candidate.email }, party, candidacy)));
}

/** The party's contact person answered: the candidate hears of it, and the party sees who it endorsed. */
export async function noticeEndorsementDecision(party: Party, candidacy: Candidacy, candidate: PublicAccount, endorsed: boolean, by: string) {
  await addAccountNotice({ accountId: candidate.id, kind: endorsed ? "endorsed" : "not-endorsed", title: endorsed ? `${party.name} endorsed your candidacy` : `${party.name} didn’t endorse your candidacy`, body: endorsed ? `Your filing now goes to the ${unitName(candidacy.college)} for review.` : "Talk to the party’s contact person, or file again as an independent before the period closes.", href: "/filing/candidacy", actor: by });
  if (endorsed) await addNotice({ partyId: party.id, kind: "candidate-endorsed", title: `${fullName(candidate)} is endorsed for ${candidacy.position}`, actor: by, href: "/filing/party/members" });
  later(() => sendAutomatic("candidacy-endorsement-decision", () => endorsementDecisionEmail({ firstName: firstName(candidate), email: candidate.email }, party, candidacy, endorsed)));
}

/** The unit approved a document, or asked for changes. */
export async function noticeCandidacyFeedback(candidacy: Candidacy, candidate: PublicAccount, requirement: string, approved: boolean, feedback: string) {
  const label = candidacyRequirementLabel(requirement);
  await addAccountNotice({ accountId: candidate.id, kind: approved ? "document-approved" : "document-changes", title: approved ? `${label} was approved` : `Changes asked on ${label}`, body: feedback, href: "/filing/candidacy/documents", actor: unitName(candidacy.college) });
  later(() => sendAutomatic("candidacy-feedback", () => candidacyFeedbackEmail({ firstName: firstName(candidate), email: candidate.email }, candidacy, requirement, approved, feedback)));
}

/** The unit decided on the candidacy. */
export async function noticeCandidacyDecision(candidacy: Candidacy, candidate: PublicAccount, decision: Exclude<CandidacyStatus, "withdrawn">, remarks: string) {
  await addAccountNotice({ accountId: candidate.id, kind: "candidacy-decision", title: decision === "pending" ? "Your candidacy was reopened for review" : `Your candidacy: ${candidacyStatusLabel[decision].toLowerCase()}`, body: remarks, href: "/filing/candidacy", actor: unitName(candidacy.college) });
  later(() => sendAutomatic("candidacy-decision", () => candidacyDecisionEmail({ firstName: firstName(candidate), email: candidate.email }, candidacy, decision, remarks)));
}

/** The unit recorded the candidate's withdrawal. A party candidate's party sees it too. */
export async function noticeCandidacyWithdrawn(candidacy: Candidacy, candidate: PublicAccount, reason: string) {
  const unit = unitName(candidacy.college);
  await addAccountNotice({ accountId: candidate.id, kind: "candidacy-withdrawn", title: `The ${unit} recorded your withdrawal as a candidate for ${candidacy.position}`, body: reason, actor: unit, href: "/filing" });
  if (candidacy.partyId && candidacy.endorsement === "endorsed") await addNotice({ partyId: candidacy.partyId, kind: "candidate-withdrawn", title: `${fullName(candidate)} withdrew as a candidate for ${candidacy.position}`, actor: unit, href: "/filing/party/members" });
  later(() => sendAutomatic("candidacy-withdrawn", () => candidacyWithdrawnEmail({ firstName: firstName(candidate), email: candidate.email }, candidacy, reason)));
}
