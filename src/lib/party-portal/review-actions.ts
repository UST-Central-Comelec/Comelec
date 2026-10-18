"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { listPartyCandidates } from "@/lib/candidacy/store";
import { documentProgress, fullName, isReadyToDecide, stillToApprove } from "@/lib/filing-portal/types";
import { canReadParty } from "@/lib/polpar/store";
import { text } from "@/lib/portal/form";
import { noticeContactChanged, noticeDecision, noticeFeedback, noticeMemberRemoved, noticePartyWithdrawn, noticeSanction } from "./notify";
import { decideParty, getMember, getParty, getSubmissionById, listMembers, listSubmissions, removeMember, reviewSubmission, setContactPerson, setPartySanction, withdrawParty } from "./store";
import { partyRequirements, partyStatusLabel, type Party } from "./types";

// The Comelec unit's side (PolPaR → Applicants): reviewing a party's documents one by one, deciding
// on the party (accrediting with documents outstanding takes an override and remarks), suspending
// or blacklisting it, and managing its people: removing a member, handing on the contact person's
// role, withdrawing the registration. A Local unit acts only on its own college's parties. Every change
// notifies the party (and emails it) through ./notify.ts.

export type ReviewState = { error?: string; fieldErrors?: Record<string, string>; saved?: string } | undefined;
export type ActionResult = { ok?: string; error?: string };

async function partyFor(id: string) {
  const user = await requireEditor("polpar/registrations");
  const party = await getParty(id);
  if (!party || !canReadParty(user, party.college)) notFound();
  return { user, party };
}

function refresh(partyId: string) {
  revalidatePath("/portal/polpar/registrations", "layout");
  revalidatePath("/portal/polpar/accredited-parties");
  revalidatePath(`/portal/polpar/registrations/parties/${partyId}`);
}

const closed = "This registration has been decided. Reopen it for review first, then change the document’s review.";
const sanctioned = (party: Party) => `The party is ${party.sanction}. Lift the ${party.sanction === "blacklisted" ? "blacklisting" : "suspension"} first.`;

/**
 * Approves a document, or sends it back with what to change. Changes need feedback. Only while
 * the party is pending review, and only over the files the reviewer saw (`seen`, the document's
 * updatedAt when the page loaded).
 */
export async function reviewPartyDocument(partyId: string, submissionId: string, seen: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, party } = await partyFor(partyId);
  const submission = await getSubmissionById(submissionId);
  if (!submission || submission.partyId !== party.id) notFound();
  if (party.sanction) return { error: sanctioned(party) };
  if (party.status !== "pending") return { error: closed };
  const decision = text(form, "decision");
  const feedback = text(form, "feedback");
  if (decision !== "approved" && decision !== "changes") return { error: "Choose Approve or Return for revisions.", fieldErrors: { decision: "Choose one." } };
  if (decision === "changes" && !feedback) return { error: "Say what to revise, so the party knows what to fix.", fieldErrors: { feedback: "Say what to revise." } };
  if (feedback.length > 3000) return { error: "Keep the feedback under 3,000 characters.", fieldErrors: { feedback: "Use 3,000 characters or fewer." } };
  if (!submission.files.length) return { error: "This document has no files to review yet." };
  if (submission.status === "draft") return { error: "The party took this document back to change it. You can review it once they send it again." };
  if (decision === submission.status && feedback === submission.feedback) return { saved: "Nothing changed." };
  const saved = await reviewSubmission(submission.id, decision, feedback, user.email, seen);
  if (!saved) {
    refresh(party.id);
    const now = await getSubmissionById(submission.id);
    return { error: now?.status === "draft" ? "The party took this document back to change it. The page now shows where it stands." : "This document changed since you opened it. Look over its files again, then review it." };
  }
  await noticeFeedback(party, submission.requirement, decision === "approved", feedback);
  refresh(party.id);
  return { saved: decision === "approved" ? "Approved. The party’s members have been notified." : "Returned for revisions. The party’s members have been notified." };
}

/**
 * Accredits or declines the party, or reopens it for review. Declining needs a reason. Accrediting
 * needs every required document approved and none waiting for review, unless the commissioner
 * overrides it, which needs remarks saying why; the record keeps that it was overridden.
 */
export async function decidePartyRegistration(partyId: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, party } = await partyFor(partyId);
  if (party.status === "withdrawn") return { error: "This registration was withdrawn, so it can’t be decided." };
  if (party.sanction) return { error: sanctioned(party) };
  const decision = text(form, "decision");
  const remarks = text(form, "remarks");
  let override = false;
  if (decision !== "pending" && decision !== "accredited" && decision !== "declined") return { error: "Choose a decision.", fieldErrors: { decision: "Choose one." } };
  if (decision === "declined" && !remarks) return { error: "Say why the party isn’t accredited.", fieldErrors: { remarks: "Say why." } };
  if (remarks.length > 3000) return { error: "Keep the remarks under 3,000 characters.", fieldErrors: { remarks: "Use 3,000 characters or fewer." } };
  if (decision === party.status && remarks === party.decisionRemarks) return { saved: "Nothing changed." };
  if (decision === "accredited") {
    if (!party.contactMemberId) return { error: "The party has no contact person. Make one of its members the contact person first." };
    const progress = documentProgress(partyRequirements, await listSubmissions(party.id));
    if (!isReadyToDecide(progress)) {
      if (form.get("override") !== "on") return { error: progress.waiting ? `Review the ${progress.waiting === 1 ? "document" : `${progress.waiting} documents`} waiting first, or tick “Accredit with documents outstanding”.` : `Approve every required document before accrediting the party, or tick “Accredit with documents outstanding”. ${stillToApprove(progress)}` };
      if (!remarks) return { error: "Say why it’s accredited with documents outstanding.", fieldErrors: { remarks: "Say why it’s accredited anyway." } };
      override = true;
    }
  }
  const saved = await decideParty(party.id, decision, remarks, user.email, override);
  if (!saved) return { error: "Couldn’t save the decision. Try again." };
  await noticeDecision(saved, decision, remarks);
  refresh(party.id);
  return { saved: decision === "pending" ? "Reopened for review. The party’s members have been notified, and they can change its documents again." : `The party is ${partyStatusLabel[decision].toLowerCase()}${override ? " with documents outstanding" : ""}. Its members have been notified.` };
}

/** Removes a member, or a request to join. Never the contact person: hand their role to someone else first. */
export async function removePartyMember(partyId: string, memberId: string, reason: string): Promise<ActionResult> {
  const { user, party } = await partyFor(partyId);
  if (party.status === "withdrawn") return { error: "This registration was withdrawn, so its members already left." };
  const member = await getMember(memberId);
  if (!member || member.partyId !== party.id) return { error: "That person isn’t in this party." };
  if (member.role === "contact") return { error: "Make another member the contact person first, then remove them." };
  const note = reason.trim().slice(0, 1000);
  const removed = await removeMember(party.id, member.id, user.email, note);
  if (!removed) return { error: "They were already removed, or their request was answered. The page now shows where they stand." };
  await noticeMemberRemoved(party, member, note);
  refresh(party.id);
  return { ok: member.status === "requested" ? `${fullName(member)}’s request to join was removed, and they’ve been emailed.` : `${fullName(member)} was removed from the party, and they’ve been emailed.` };
}

/** Hands the contact person's role to an active member. */
export async function makePartyContact(partyId: string, memberId: string): Promise<ActionResult> {
  const { party } = await partyFor(partyId);
  if (party.status === "withdrawn") return { error: "This registration was withdrawn, so it has no contact person." };
  const member = await getMember(memberId);
  if (!member || member.partyId !== party.id) return { error: "That person isn’t in this party." };
  if (party.contactMemberId === member.id) return { ok: `${fullName(member)} is already the contact person.` };
  const changed = await setContactPerson(party.id, member.id);
  if (changed === "inactive") return { error: "Only an approved member can be the contact person. The page now shows who’s in the party." };
  await noticeContactChanged(changed, member);
  refresh(party.id);
  return { ok: `${fullName(member)} is now the contact person. The party has been notified, and they’ve been emailed.` };
}

/**
 * Withdraws the registration: the party's name is free again, its members are out (they can join
 * or register another party), and candidates waiting on its endorsement are told it won't come.
 */
export async function withdrawPartyRegistration(partyId: string, reason: string): Promise<ActionResult> {
  const { user, party } = await partyFor(partyId);
  if (party.sanction === "blacklisted") return { error: "A blacklisted party’s registration can’t be withdrawn: that would free its name. Lift the blacklisting first." };
  const note = reason.trim().slice(0, 3000);
  if (!note) return { error: "Say why the registration is withdrawn. Its members will read it." };
  const [members, candidates] = await Promise.all([listMembers(party.id), listPartyCandidates(party.id)]);
  const withdrawn = await withdrawParty(party.id, user.email, note);
  if (!withdrawn) return { error: "This registration was already withdrawn." };
  await noticePartyWithdrawn(withdrawn, members, candidates.filter((item) => item.endorsement === "waiting").map((item) => ({ accountId: item.accountId, position: item.position })), note);
  refresh(party.id);
  return { ok: `${party.name}’s registration is withdrawn. Its ${members.length === 1 ? "member has" : "members have"} been notified.` };
}

/**
 * Suspends or blacklists the party, with a reason its members read. Only an accredited party can be
 * suspended; any but a withdrawn one can be blacklisted. Either stops it taking members, endorsing
 * or fielding candidates, and changing its documents, until it's lifted.
 */
export async function sanctionParty(partyId: string, sanction: "suspended" | "blacklisted", reason: string): Promise<ActionResult> {
  const { user, party } = await partyFor(partyId);
  if (party.status === "withdrawn") return { error: "This registration was withdrawn, so it can’t be sanctioned." };
  if (party.sanction) return { error: `The party is already ${party.sanction}.` };
  if (sanction === "suspended" && party.status !== "accredited") return { error: "Only an accredited party can be suspended. Decline or blacklist it instead." };
  const note = reason.trim().slice(0, 3000);
  if (!note) return { error: `Say why the party is ${sanction}. Its members will read it.` };
  const saved = await setPartySanction(party.id, sanction, note, user.email);
  if (!saved) return { error: "The party’s standing changed meanwhile. The page now shows where it stands." };
  await noticeSanction(saved, sanction, null, note);
  refresh(party.id);
  return { ok: `${party.name} is ${sanction}. Its members have been notified.` };
}

/** Lifts a suspension or blacklisting: the party stands as it did before. */
export async function liftPartySanction(partyId: string, note: string): Promise<ActionResult> {
  const { user, party } = await partyFor(partyId);
  if (!party.sanction) return { error: "The party isn’t suspended or blacklisted." };
  const said = note.trim().slice(0, 3000);
  const saved = await setPartySanction(party.id, null, said, user.email);
  if (!saved) return { error: "The party’s standing changed meanwhile. The page now shows where it stands." };
  await noticeSanction(saved, null, party.sanction, said);
  refresh(party.id);
  return { ok: `${party.sanction === "blacklisted" ? "Blacklisting" : "Suspension"} lifted. ${party.name} stands as it did before, and its members have been notified.` };
}
