import "server-only";

import { later, sendAutomatic, sendEach } from "@/lib/notifications/notify";
import { addAccountNotice } from "@/lib/filing-portal/accounts";
import { feedbackEmail, joinDecisionEmail, joinRequestEmail, membershipEmail, partyDecisionEmail, partySanctionEmail, requirementLabel } from "./emails";
import { addNotice, getMember, listMembers } from "./store";
import { fullName } from "@/lib/filing-portal/types";
import { partyRequirementHref, partyStatusLabel, unitName, type Party, type PartyMember, type PartySanction, type PartyStatus } from "./types";

// What happens around a change to a party's registration in the filing portal: a line in the
// party's Notifications, and the email that goes with it (sent once the response has gone, so a
// slow mail server never holds up or fails what the person did).

const firstName = (member: PartyMember) => member.firstName.split(" ")[0] || member.firstName;
const activeMembers = async (partyId: string) => (await listMembers(partyId)).filter((member) => member.status === "active");

/** Someone asked to join: the contact person hears of it. */
export async function noticeJoinRequest(party: Party, requester: PartyMember) {
  const name = fullName(requester);
  await addNotice({ partyId: party.id, kind: "member-request", title: `${name} asked to join the party`, body: "Approve or decline them under Members.", href: "/filing/party/members", actor: name, forContact: true });
  const contact = party.contactMemberId ? await getMember(party.contactMemberId) : null;
  if (contact?.status === "active") later(() => sendAutomatic("party-join-request", () => joinRequestEmail({ firstName: firstName(contact), email: contact.email }, { name, email: requester.email, college: requester.college }, party)));
}

/** The contact person answered a request to join. */
export async function noticeJoinDecision(party: Party, member: PartyMember, approved: boolean, by: string) {
  if (approved) await addNotice({ partyId: party.id, kind: "member-joined", title: `${fullName(member)} joined the party`, actor: by, href: "/filing/party/members" });
  later(() => sendAutomatic("party-join-decision", () => joinDecisionEmail({ firstName: firstName(member), email: member.email }, party, approved)));
}

/** A member sent a document for review: the party sees it was sent, and by whom. */
export async function noticeSent(party: Party, requirement: string, by: string) {
  await addNotice({ partyId: party.id, kind: "document-sent", title: `${requirementLabel(requirement)} was sent for review`, actor: by, href: partyRequirementHref(requirement) });
}

/** The unit approved a document, or asked for changes: every member hears of it. */
export async function noticeFeedback(party: Party, requirement: string, approved: boolean, feedback: string) {
  const label = requirementLabel(requirement);
  await addNotice({ partyId: party.id, kind: approved ? "document-approved" : "document-changes", title: approved ? `${label} was approved` : `Changes asked on ${label}`, body: feedback, actor: unitName(party.college), href: partyRequirementHref(requirement) });
  const members = await activeMembers(party.id);
  later(() => sendEach("party-feedback", members.map((member) => feedbackEmail({ firstName: firstName(member), email: member.email }, party, requirement, approved, feedback))));
}

/** The unit decided on the party itself. */
export async function noticeDecision(party: Party, decision: Exclude<PartyStatus, "withdrawn">, remarks: string) {
  await addNotice({ partyId: party.id, kind: "party-decision", title: decision === "pending" ? "The registration was reopened for review" : `The party is ${partyStatusLabel[decision].toLowerCase()}`, body: remarks, actor: unitName(party.college), href: "/filing/party" });
  const members = await activeMembers(party.id);
  later(() => sendEach("party-decision", members.map((member) => partyDecisionEmail({ firstName: firstName(member), email: member.email }, party, decision, remarks))));
}

/** The unit removed a member, or a request to join: they hear of it on their own account, and the party sees who left. */
export async function noticeMemberRemoved(party: Party, member: PartyMember, reason: string) {
  const unit = unitName(party.college);
  if (member.accountId) await addAccountNotice({ accountId: member.accountId, kind: "member-removed", title: `The ${unit} removed you from ${party.name}`, body: reason, actor: unit, href: "/filing" });
  if (member.status === "active") await addNotice({ partyId: party.id, kind: "member-removed", title: `${fullName(member)} is no longer a member`, body: `Removed by the ${unit}.`, actor: unit, href: "/filing/party/members" });
  later(() => sendAutomatic("party-membership", () => membershipEmail({ firstName: firstName(member), email: member.email }, party, { kind: "removed", reason })));
}

/** The unit handed the contact person's role to another member. */
export async function noticeContactChanged(party: Party, member: PartyMember) {
  const unit = unitName(party.college);
  await addNotice({ partyId: party.id, kind: "contact-changed", title: `${fullName(member)} is now the party’s contact person`, body: "They approve who joins and endorse the party’s candidates.", actor: unit, href: "/filing/party/members" });
  later(() => sendAutomatic("party-membership", () => membershipEmail({ firstName: firstName(member), email: member.email }, party, { kind: "contact" })));
}

/**
 * The unit withdrew the registration. Its members are out of the party now, so each hears of it on
 * their own account; the candidates who were waiting on its endorsement hear that it won't come.
 */
export async function noticePartyWithdrawn(party: Party, members: PartyMember[], waitingCandidates: Array<{ accountId: string; position: string }>, reason: string) {
  const unit = unitName(party.college);
  await addNotice({ partyId: party.id, kind: "party-withdrawn", title: "The registration was withdrawn", body: reason, actor: unit });
  for (const member of members) if (member.accountId) await addAccountNotice({ accountId: member.accountId, kind: "party-withdrawn", title: `${party.name}’s registration was withdrawn`, body: reason || `Withdrawn by the ${unit}. You can join or register another party while registration is open.`, actor: unit, href: "/filing" });
  for (const candidate of waitingCandidates) await addAccountNotice({ accountId: candidate.accountId, kind: "not-endorsed", title: `${party.name} can’t endorse your candidacy`, body: "Its registration was withdrawn. To run as an independent, withdraw this filing, then file again before the period closes.", actor: unit, href: "/filing/candidacy" });
  const active = members.filter((member) => member.status === "active");
  later(() => sendEach("party-membership", active.map((member) => membershipEmail({ firstName: firstName(member), email: member.email }, party, { kind: "withdrawn", reason }))));
}

/** The unit suspended or blacklisted the party (`sanction`), or lifted it (null, with what it was). Every member hears of it. */
export async function noticeSanction(party: Party, sanction: PartySanction | null, lifted: PartySanction | null, reason: string) {
  const unit = unitName(party.college);
  await addNotice({ partyId: party.id, kind: sanction ? `party-${sanction}` : "party-sanction-lifted", title: sanction ? `The party is ${sanction}` : `The ${lifted === "blacklisted" ? "blacklisting" : "suspension"} was lifted`, body: reason, actor: unit, href: "/filing/party" });
  const members = await activeMembers(party.id);
  later(() => sendEach("party-decision", members.map((member) => partySanctionEmail({ firstName: firstName(member), email: member.email }, party, sanction, lifted, reason))));
}
