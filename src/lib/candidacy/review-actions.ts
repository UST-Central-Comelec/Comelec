"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { getAccount } from "@/lib/filing-portal/accounts";
import { canReadParty } from "@/lib/polpar/store";
import { text } from "@/lib/portal/form";
import { noticeCandidacyDecision, noticeCandidacyFeedback } from "./notify";
import { decideCandidacy, getCandidacy, getCandidacyDocumentById, reviewCandidacyDocument } from "./store";
import { reachesUnit } from "./types";

// The Comelec unit's side (Filing of Candidacy → Filings): reviewing a candidate's documents one by
// one, and deciding whether they're qualified. A Local unit reviews only its own college's filings.

export type ReviewState = { error?: string; fieldErrors?: Record<string, string>; saved?: string } | undefined;

async function candidacyFor(id: string) {
  const user = await requireEditor("candidacy/filings");
  const candidacy = await getCandidacy(id);
  if (!candidacy || !canReadParty(user, candidacy.college) || !reachesUnit(candidacy)) notFound();
  const candidate = await getAccount(candidacy.accountId);
  if (!candidate) notFound();
  return { user, candidacy, candidate };
}

export async function reviewCandidacyDocumentAction(candidacyId: string, documentId: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, candidacy, candidate } = await candidacyFor(candidacyId);
  const document = await getCandidacyDocumentById(documentId);
  if (!document || document.candidacyId !== candidacy.id) notFound();
  const decision = text(form, "decision");
  const feedback = text(form, "feedback");
  if (decision !== "approved" && decision !== "changes") return { error: "Choose Approve or Ask for changes.", fieldErrors: { decision: "Choose one." } };
  if (decision === "changes" && !feedback) return { error: "Say what to change, so the candidate knows what to fix.", fieldErrors: { feedback: "Say what to change." } };
  if (feedback.length > 3000) return { error: "Keep the feedback under 3,000 characters.", fieldErrors: { feedback: "Use 3,000 characters or fewer." } };
  if (!document.files.length) return { error: "This document has no files to review yet." };
  const saved = await reviewCandidacyDocument(document.id, decision, feedback, user.email);
  if (!saved) return { error: "Couldn’t save the review. Try again." };
  await noticeCandidacyFeedback(candidacy, candidate, document.requirement, decision === "approved", feedback);
  revalidatePath(`/portal/candidacy/filings/${candidacy.id}`);
  return { saved: decision === "approved" ? "Approved. The candidate has been notified." : "Sent back with your feedback. The candidate has been notified." };
}

export async function decideCandidacyAction(candidacyId: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, candidacy, candidate } = await candidacyFor(candidacyId);
  const decision = text(form, "decision");
  const remarks = text(form, "remarks");
  if (decision !== "pending" && decision !== "qualified" && decision !== "disqualified") return { error: "Choose a decision.", fieldErrors: { decision: "Choose one." } };
  if (decision === "disqualified" && !remarks) return { error: "Say why the candidate isn’t qualified.", fieldErrors: { remarks: "Say why." } };
  if (remarks.length > 3000) return { error: "Keep the remarks under 3,000 characters.", fieldErrors: { remarks: "Use 3,000 characters or fewer." } };
  if (decision === candidacy.status && remarks === candidacy.decisionRemarks) return { saved: "Nothing changed." };
  const saved = await decideCandidacy(candidacy.id, decision, remarks, user.email);
  if (!saved) return { error: "Couldn’t save the decision. Try again." };
  await noticeCandidacyDecision(saved, candidate, decision, remarks);
  revalidatePath("/portal/candidacy/filings");
  revalidatePath(`/portal/candidacy/filings/${candidacy.id}`);
  return { saved: decision === "pending" ? "Reopened for review. The candidate has been notified." : `The candidate is ${decision}. They’ve been notified.` };
}
