"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { canReadParty } from "@/lib/polpar/store";
import { text } from "@/lib/portal/form";
import { noticeDecision, noticeFeedback } from "./notify";
import { decideParty, getParty, getSubmissionById, reviewSubmission } from "./store";

// The Comelec unit's side (PolPaR → Applicants): reviewing a party's documents one by one, and
// deciding on the party. A Local unit reviews only its own college's parties.

export type ReviewState = { error?: string; fieldErrors?: Record<string, string>; saved?: string } | undefined;

async function partyFor(id: string) {
  const user = await requireEditor("polpar/registrations");
  const party = await getParty(id);
  if (!party || !canReadParty(user, party.college)) notFound();
  return { user, party };
}

/** Approves a document, or sends it back with what to change. Changes need feedback. */
export async function reviewPartyDocument(partyId: string, submissionId: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, party } = await partyFor(partyId);
  const submission = await getSubmissionById(submissionId);
  if (!submission || submission.partyId !== party.id) notFound();
  const decision = text(form, "decision");
  const feedback = text(form, "feedback");
  if (decision !== "approved" && decision !== "changes") return { error: "Choose Approve or Ask for changes.", fieldErrors: { decision: "Choose one." } };
  if (decision === "changes" && !feedback) return { error: "Say what to change, so the party knows what to fix.", fieldErrors: { feedback: "Say what to change." } };
  if (feedback.length > 3000) return { error: "Keep the feedback under 3,000 characters.", fieldErrors: { feedback: "Use 3,000 characters or fewer." } };
  if (!submission.files.length) return { error: "This document has no files to review yet." };
  const saved = await reviewSubmission(submission.id, decision, feedback, user.email);
  if (!saved) return { error: "Couldn’t save the review. Try again." };
  await noticeFeedback(party, submission.requirement, decision === "approved", feedback);
  revalidatePath(`/portal/polpar/registrations/parties/${party.id}`);
  return { saved: decision === "approved" ? "Approved. The party’s members have been notified." : "Sent back with your feedback. The party’s members have been notified." };
}

/** Accredits or declines the party, or reopens it for review. Declining needs a reason. */
export async function decidePartyRegistration(partyId: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, party } = await partyFor(partyId);
  const decision = text(form, "decision");
  const remarks = text(form, "remarks");
  if (decision !== "pending" && decision !== "accredited" && decision !== "declined") return { error: "Choose a decision.", fieldErrors: { decision: "Choose one." } };
  if (decision === "declined" && !remarks) return { error: "Say why the party isn’t accredited.", fieldErrors: { remarks: "Say why." } };
  if (remarks.length > 3000) return { error: "Keep the remarks under 3,000 characters.", fieldErrors: { remarks: "Use 3,000 characters or fewer." } };
  if (decision === party.status && remarks === party.decisionRemarks) return { saved: "Nothing changed." };
  const saved = await decideParty(party.id, decision, remarks, user.email);
  if (!saved) return { error: "Couldn’t save the decision. Try again." };
  await noticeDecision(saved, decision, remarks);
  revalidatePath("/portal/polpar/registrations");
  revalidatePath(`/portal/polpar/registrations/parties/${party.id}`);
  return { saved: decision === "pending" ? "Reopened for review. The party’s members have been notified." : `The party is ${decision}. Its members have been notified.` };
}
