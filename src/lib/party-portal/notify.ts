import "server-only";

import { later, sendAutomatic, sendEach } from "@/lib/notifications/notify";
import { feedbackEmail, joinDecisionEmail, joinRequestEmail, partyDecisionEmail, requirementLabel } from "./emails";
import { addNotice, getMember, listMembers } from "./store";
import { fullName } from "@/lib/filing-portal/types";
import { partyStatusLabel, unitName, type Party, type PartyMember, type PartyStatus } from "./types";

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
  await addNotice({ partyId: party.id, kind: "document-sent", title: `${requirementLabel(requirement)} was sent for review`, actor: by, href: "/filing/party" });
}

/** The unit approved a document, or asked for changes: every member hears of it. */
export async function noticeFeedback(party: Party, requirement: string, approved: boolean, feedback: string) {
  const label = requirementLabel(requirement);
  await addNotice({ partyId: party.id, kind: approved ? "document-approved" : "document-changes", title: approved ? `${label} was approved` : `Changes asked on ${label}`, body: feedback, actor: unitName(party.college), href: "/filing/party" });
  const members = await activeMembers(party.id);
  later(() => sendEach("party-feedback", members.map((member) => feedbackEmail({ firstName: firstName(member), email: member.email }, party, requirement, approved, feedback))));
}

/** The unit decided on the party itself. */
export async function noticeDecision(party: Party, decision: Exclude<PartyStatus, "withdrawn">, remarks: string) {
  await addNotice({ partyId: party.id, kind: "party-decision", title: decision === "pending" ? "The registration was reopened for review" : `The party is ${partyStatusLabel[decision].toLowerCase()}`, body: remarks, actor: unitName(party.college), href: "/filing/party" });
  const members = await activeMembers(party.id);
  later(() => sendEach("party-decision", members.map((member) => partyDecisionEmail({ firstName: firstName(member), email: member.email }, party, decision, remarks))));
}
